// Public contact form: stores a support ticket and alerts the team by email.
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
    const name = clean(payload.name, 120);
    const email = clean(payload.email, 200);
    const company = clean(payload.company, 160);
    const subject = clean(payload.subject, 200);
    const message = clean(payload.message, 5000);

    const errors: string[] = [];
    if (name.length < 2) errors.push('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Please enter a valid email address.');
    if (subject.length < 2) errors.push('Please enter a subject.');
    if (message.length < 10) errors.push('Please enter a longer message.');
    if (errors.length) return json({ error: errors.join(' ') }, 400);

    const supabase = emailServiceClient();
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({ name, email, company: company || null, subject, message, source: 'contact_form' })
      .select('id')
      .single();
    if (error) {
      console.error('submit-contact: insert failed', error.message);
      return json({ error: 'Could not save your message. Please try again.' }, 500);
    }

    const settings = await loadEmailSettings(supabase);
    const base = appUrl(settings);
    const html = `
      <h2>New enquiry from the website</h2>
      <p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p>
      ${company ? `<p><strong>Company:</strong> ${escape(company)}</p>` : ''}
      <p><strong>Subject:</strong> ${escape(subject)}</p>
      <p style="white-space:pre-wrap">${escape(message)}</p>
      <p><a href="${base}/settings?tab=inbox">Open the inbox to reply</a></p>
    `;
    await sendNotification(supabase, 'support_ticket', `New enquiry: ${subject}`, html);

    return json({ ok: true, id: ticket.id });
  } catch (e) {
    console.error('submit-contact error', (e as Error).message);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
