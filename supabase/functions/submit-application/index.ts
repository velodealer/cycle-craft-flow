// Public job application: stores the application and alerts the team by email.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { emailServiceClient, appUrl, loadEmailSettings, sendNotification } from '../_shared/email.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json().catch(() => ({}));
    const openingId = clean(payload.opening_id, 60) || null;
    const name = clean(payload.name, 120);
    const email = clean(payload.email, 200);
    const phone = clean(payload.phone, 60);
    const links = clean(payload.links, 600);
    const coverNote = clean(payload.cover_note, 8000);
    const cvPath = clean(payload.cv_path, 400);

    const errors: string[] = [];
    if (name.length < 2) errors.push('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Please enter a valid email address.');
    if (coverNote.length < 20) errors.push('Please tell us a little more about yourself.');
    if (!openingId) errors.push('Missing role.');
    if (errors.length) return json({ error: errors.join(' ') }, 400);

    const supabase = emailServiceClient();
    const { data: opening } = await supabase
      .from('job_openings')
      .select('id, title, is_open')
      .eq('id', openingId)
      .maybeSingle();
    if (!opening || opening.is_open === false) {
      return json({ error: 'This role is no longer accepting applications.' }, 400);
    }

    const { data: application, error } = await supabase
      .from('job_applications')
      .insert({
        opening_id: opening.id,
        role_title: opening.title,
        name,
        email,
        phone: phone || null,
        links: links || null,
        cover_note: coverNote,
        cv_path: cvPath || null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('submit-application: insert failed', error.message);
      return json({ error: 'Could not save your application. Please try again.' }, 500);
    }

    const settings = await loadEmailSettings(supabase);
    const base = appUrl(settings);
    const html = `
      <h2>New application: ${escape(String(opening.title))}</h2>
      <p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p>
      ${phone ? `<p><strong>Phone:</strong> ${escape(phone)}</p>` : ''}
      ${links ? `<p><strong>Links:</strong> ${escape(links)}</p>` : ''}
      <p style="white-space:pre-wrap">${escape(coverNote)}</p>
      <p>${cvPath ? 'A CV was attached.' : 'No CV was attached.'}</p>
      <p><a href="${base}/settings?tab=inbox">Open the inbox to review</a></p>
    `;
    await sendNotification(supabase, 'job_application', `New application: ${opening.title}`, html);

    return json({ ok: true, id: application.id });
  } catch (e) {
    console.error('submit-application error', (e as Error).message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
