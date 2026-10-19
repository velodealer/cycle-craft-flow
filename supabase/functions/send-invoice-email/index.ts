// Emails a sale invoice to the customer via Resend (direct API).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { emailServiceClient, loadEmailSettings, appUrl, DEFAULT_FROM } from '../_shared/email.ts';
import { fetchQboInvoicePdf, fetchQboInvoiceLink } from '../_shared/quickbooks-invoice-doc.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({ invoice_id: z.string().uuid(), to: z.string().email().max(255).optional() });

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const gbp = (n: number) => `£${(Number(n) || 0).toFixed(2)}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = emailServiceClient();
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing Authorization header' }, 401);
    const { data: u, error: ue } = await supabase.auth.getUser(token);
    if (ue || !u.user) return json({ error: 'Invalid or expired session' }, 401);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const { data: profile } = await supabase.from('profiles').select('role, business_id').eq('user_id', u.user.id).maybeSingle();
    if (!profile || ['mechanic', 'detailer', 'investor', 'social_manager'].includes(String(profile.role))) {
      return json({ error: 'You do not have permission to send invoices' }, 403);
    }

    const { data: inv, error: ie } = await supabase
      .from('invoices')
      .select('*, bikes:bike_id(reference, make, model, year, size, colour, frame_number, serial_number, finance_scheme), external_owners:external_customer_id(name, email, address), parts:part_id(brand, description)')
      .eq('id', parsed.data.invoice_id)
      .maybeSingle();
    if (ie) return json({ error: ie.message }, 500);
    if (!inv || inv.business_id !== profile.business_id) return json({ error: 'Invoice not found' }, 404);

    const to = parsed.data.to || inv.external_owners?.email;
    if (!to) return json({ error: 'This customer has no email address' }, 400);

    const { data: biz } = await supabase.from('businesses').select('name, contact_email').eq('id', inv.business_id).maybeSingle();
    const settings = await loadEmailSettings(supabase, inv.business_id);
    if (settings.enabled === false) return json({ error: 'Email sending is switched off in Settings' }, 400);
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500);

    if (!inv.quickbooks_invoice_id) {
      return json({ error: 'This invoice is not in QuickBooks yet — sync it to QuickBooks first, then email it' }, 409);
    }
    let pdf: string;
    try { pdf = await fetchQboInvoicePdf(supabase as any, inv.quickbooks_invoice_id); }
    catch (e) { return json({ error: (e as Error).message }, 502); }
    const qbo = await fetchQboInvoiceLink(supabase as any, inv.quickbooks_invoice_id);
    const docNo = qbo.docNumber || inv.invoice_number;
    const bizName = biz?.name || 'VeloDealer';
    const b = inv.bikes;
    const item = b
      ? [b.year, b.make, b.model].filter(Boolean).join(' ') + (b.reference ? ` (${b.reference})` : '')
      : inv.parts ? [inv.parts.brand, inv.parts.description].filter(Boolean).join(' — ') : 'Sale';
    const date = inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('en-GB') : '';
    const customer = inv.external_owners?.name || inv.customer_name || '';

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;background:#f6f6f6;margin:0;padding:24px">
<div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;border-radius:6px">
<h2 style="margin:0 0 16px">${esc(bizName)}</h2>
<p>Hi ${esc(customer || 'there')},</p>
<p>Thank you for your purchase${b ? ` of the ${esc(item)}` : ''}. Your invoice ${esc(docNo)}${date ? ` dated ${esc(date)}` : ''} for <strong>${gbp(inv.gross)}</strong> is attached as a PDF.</p>
${qbo.link ? `<p><a href="${esc(qbo.link)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none">View invoice online</a></p>` : ''}
<p style="font-size:12px;color:#999;margin-top:24px">${esc(bizName)}${biz?.contact_email ? ` · ${esc(biz.contact_email)}` : ''}</p>
</div></body></html>`;

    const baseFrom = (settings.from_address || DEFAULT_FROM).trim();
    const addr = baseFrom.match(/<([^>]+)>/)?.[1] || baseFrom;
    const from = `${bizName.replace(/[<>"]/g, '')} <${addr}>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from, to: [to], subject: `Invoice ${docNo} from ${bizName}`, html,
        attachments: [{ filename: `Invoice-${String(docNo).replace(/[^A-Za-z0-9-]/g, '')}.pdf`, content: pdf }],
        ...(biz?.contact_email ? { reply_to: biz.contact_email } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend request failed [${res.status}]: ${body}`);
      return json({ error: `Email provider error ${res.status}: ${body}` }, 502);
    }
    if (inv.bike_id) {
      await supabase.from('bike_activity').insert({
        bike_id: inv.bike_id, business_id: inv.business_id, kind: 'sale', action: 'invoice_emailed',
        summary: `Invoice ${inv.invoice_number} emailed to ${to}`, detail: { invoice_id: inv.id, to }, actor_id: u.user.id,
      } as any).then(({ error }) => error && console.error('activity log failed', error.message));
    }
    void appUrl;
    return json({ ok: true, to });
  } catch (e) {
    console.error('send-invoice-email error', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
