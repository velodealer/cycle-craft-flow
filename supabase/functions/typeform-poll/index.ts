// Backup check: every 15 minutes, pull recent responses for every enabled
// Typeform form and file any the notification missed. Idempotent — responses
// already stored are skipped, so running it extra times is harmless.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { isScheduledCall } from '../_shared/scheduled.ts';
import { sendNotification, loadEmailSettings, appUrl } from '../_shared/email.ts';
import { submissionEmail } from '../_shared/email-templates.ts';
import { serviceClient, getTypeformAuth, typeformFetch } from '../_shared/typeform.ts';
import { extractFromFormResponse } from '../_shared/typeform-extract.ts';
import { rehostTypeformFiles } from '../_shared/typeform-files.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  if (!(await isScheduledCall(req, supabase))) return json({ error: 'Unauthorized' }, 401);

  let accessToken: string;
  try {
    accessToken = (await getTypeformAuth(supabase)).accessToken;
  } catch (e) {
    return json({ ok: true, skipped: 'not_connected', detail: (e as Error).message });
  }

  const { data: forms, error } = await supabase
    .from('typeform_forms')
    .select('form_id, field_map, business_id')
    .eq('enabled', true);
  if (error) return json({ error: error.message }, 500);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19);
  const results: Record<string, unknown> = {};

  for (const form of forms ?? []) {
    const formId = (form as any).form_id as string;
    const businessId = (form as any).business_id as string;
    const fieldMap = ((form as any).field_map ?? {}) as Record<string, string>;
    let imported = 0;
    try {
      const data = await typeformFetch(
        accessToken,
        `/forms/${formId}/responses?page_size=50&since=${encodeURIComponent(since)}`,
      );
      for (const item of (data?.items ?? []) as any[]) {
        const responseId = item?.response_id || item?.token;
        if (!responseId) continue;
        const { data: existing } = await supabase
          .from('typeform_submissions')
          .select('id')
          .eq('response_id', responseId)
          .maybeSingle();
        if (existing) continue;

        const formResponse = { ...item, form_id: formId };
        const extracted = extractFromFormResponse(formResponse, fieldMap);
        try {
          extracted.photo_urls = await rehostTypeformFiles(supabase, accessToken, responseId, extracted.photo_urls);
        } catch (err) {
          console.error('typeform-poll: photo copy failed', err);
        }
        const { error: insErr } = await supabase.from('typeform_submissions').insert({
          form_id: formId,
          response_id: responseId,
          submitted_at: item?.submitted_at ?? new Date().toISOString(),
          raw_payload: { event_type: 'polled', form_response: formResponse },
          ...extracted,
          status: 'new',
          business_id: businessId,
        });
        if (insErr) {
          // A webhook may have inserted the same response at the same moment.
          if (!insErr.message.includes('duplicate')) console.error('typeform-poll insert', insErr.message);
          continue;
        }
        imported++;
        try {
          const settings = await loadEmailSettings(supabase, businessId);
          const mail = submissionEmail(extracted, appUrl(settings));
          await sendNotification(supabase, 'submission_received', mail.subject, mail.html, businessId);
        } catch (err) {
          console.error('typeform-poll: notification email failed', err);
        }
      }
      results[formId] = { imported };
      if (imported) console.log(`typeform-poll: ${formId} imported ${imported} missed response(s)`);
    } catch (e) {
      console.error(`typeform-poll: ${formId} failed`, (e as Error).message);
      results[formId] = { error: (e as Error).message.slice(0, 200) };
    }
  }

  return json({ ok: true, forms: results });
});
