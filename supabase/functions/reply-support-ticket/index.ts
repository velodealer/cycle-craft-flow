// Admin reply to a website enquiry: emails the sender and records the reply.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { emailServiceClient, sendDirect } from '../_shared/email.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
      .select('role, name')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!profile || !['admin', 'owner'].includes(String(profile.role))) {
      return json({ error: 'Only admins and owners can reply to enquiries' }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const ticketId = String(payload.ticket_id ?? '').trim();
    const body = String(payload.body ?? '').trim().slice(0, 10000);
    if (!ticketId) return json({ error: 'Missing ticket' }, 400);
    if (body.length < 2) return json({ error: 'Please write a reply' }, 400);

    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, name, email, subject')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket) return json({ error: 'Enquiry not found' }, 404);

    const html = `
      <p>Hi ${escape(String(ticket.name).split(' ')[0] || '')},</p>
      <p style="white-space:pre-wrap">${escape(body)}</p>
      <p>— ${escape(String(profile.name ?? 'VeloDealer'))}, VeloDealer</p>
    `;
    const result = await sendDirect(supabase, String(ticket.email), `Re: ${ticket.subject}`, html);
    if (!result.sent) return json({ ok: false, error: result.reason }, 400);

    await supabase.from('support_ticket_replies').insert({
      ticket_id: ticket.id,
      body,
      sent_by: userData.user.id,
      sent_by_name: profile.name ?? null,
    });
    await supabase.from('support_tickets').update({ status: 'open' }).eq('id', ticket.id);

    return json({ ok: true });
  } catch (e) {
    console.error('reply-support-ticket error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
