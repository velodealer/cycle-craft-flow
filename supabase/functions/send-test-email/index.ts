// Sends a test notification email so admins can verify the Resend setup.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { emailServiceClient, loadEmailSettings, appUrl, sendNotification } from '../_shared/email.ts';
import { testEmail } from '../_shared/email-templates.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = emailServiceClient();
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing Authorization header' }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Invalid or expired session' }, 401);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!profile || !['admin', 'owner'].includes(String(profile.role))) {
      return json({ error: 'Only admins and owners can send a test email' }, 403);
    }

    const settings = await loadEmailSettings(supabase);
    const { subject, html } = testEmail(appUrl(settings));
    const result = await sendNotification(supabase, 'test', subject, html);
    if (!result.sent) return json({ ok: false, error: result.reason }, 400);
    return json({ ok: true, recipients: result.recipients });
  } catch (e) {
    console.error('send-test-email error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
