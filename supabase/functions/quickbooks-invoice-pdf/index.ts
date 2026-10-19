// Returns QuickBooks' own PDF and links for a VeloDealer invoice.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { serviceClient, requireUser } from '../_shared/quickbooks.ts';
import { fetchQboInvoicePdf, fetchQboInvoiceLink, qboInvoiceAppUrl } from '../_shared/quickbooks-invoice-doc.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = serviceClient();
  let user;
  try { user = await requireUser(req, supabase); } catch (e) { return json({ error: (e as Error).message }, 401); }
  try {
    const parsed = z.object({ invoice_id: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { data: profile } = await supabase.from('profiles').select('business_id, role').eq('user_id', user.id).maybeSingle();
    const { data: inv } = await supabase.from('invoices').select('business_id, quickbooks_invoice_id, sync_status, sync_error').eq('id', parsed.data.invoice_id).maybeSingle();
    if (!inv || !profile || inv.business_id !== profile.business_id) return json({ error: 'Invoice not found' }, 404);
    if (!inv.quickbooks_invoice_id) {
      return json({ error: inv.sync_error ? `Not in QuickBooks yet: ${inv.sync_error}` : 'This invoice has not been sent to QuickBooks yet', not_synced: true }, 409);
    }
    const [pdf, link] = await Promise.all([
      fetchQboInvoicePdf(supabase, inv.quickbooks_invoice_id),
      fetchQboInvoiceLink(supabase, inv.quickbooks_invoice_id),
    ]);
    return json({ pdf_base64: pdf, app_url: qboInvoiceAppUrl(inv.quickbooks_invoice_id), customer_link: link.link, doc_number: link.docNumber });
  } catch (e) {
    console.error('quickbooks-invoice-pdf error', (e as Error).message);
    return json({ error: (e as Error).message }, 502);
  }
});
