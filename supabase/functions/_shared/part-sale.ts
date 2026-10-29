// Records a part sold on a marketplace: invoice, part marked sold, accounting sync,
// delisted from every other channel, dealer emailed. Never throws.
import { sendNotification } from './email.ts';
import { logSystemError } from './system-error.ts';
import { delistPartEverywhere } from './part-listing.ts';

const esc = (v: unknown) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

async function callSync(fn: string, invoiceId: string) {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  if (!res.ok) throw new Error(`${fn} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export interface PartSaleInfo {
  channel: 'ebay' | 'shopify';
  orderId: string;
  total: number;
  currency: string;
  buyer: string;
  date?: string | null;
  ebayOrderRowId?: string;
}

export async function recordPartSale(supabase: any, businessId: string, part: any, sale: PartSaleInfo) {
  const label = [part.brand, part.description].filter(Boolean).join(' ');
  const where = sale.channel === 'ebay' ? 'eBay' : 'Shopify';
  const { total, currency, orderId } = sale;
  try {
    const { data: num, error: nErr } = await supabase.rpc('next_invoice_number', { _business_id: businessId });
    if (nErr) throw new Error(nErr.message);
    const secondhand = String(part.type ?? '').startsWith('secondhand');
    const scheme = secondhand ? 'margin_scheme' : 'vat_qualifying';
    const cost = Math.abs(Number(part.cost_price ?? 0));
    const vat = secondhand ? Math.max(0, total - cost) * 20 / 120 : total * 20 / 120;
    const when = sale.date ?? new Date().toISOString();
    const { data: inv, error: iErr } = await supabase.from('invoices').insert({
      business_id: businessId,
      invoice_number: num as string,
      part_id: part.id,
      type: 'part_sale',
      total: Number(total.toFixed(2)),
      gross: Number(total.toFixed(2)),
      sale_gross: Number(total.toFixed(2)),
      net: Number((total - vat).toFixed(2)),
      vat_rate: 20,
      finance_scheme: scheme,
      customer_name: sale.buyer,
      status: 'paid',
      issued_at: when,
      paid_at: when,
    }).select('id, invoice_number').single();
    if (iErr) throw new Error(iErr.message);
    await supabase.from('parts').update({ stock_status: 'sold', sale_price: total }).eq('id', part.id);
    if (sale.ebayOrderRowId) await supabase.from('ebay_orders').update({ invoice_id: inv.id }).eq('id', sale.ebayOrderRowId);

    const notes: string[] = [];
    try { await callSync('quickbooks-sync-invoice', inv.id); notes.push('Posted to QuickBooks.'); }
    catch (e) { notes.push(`QuickBooks not updated: ${esc((e as Error).message)}`); }
    try { await callSync('xero-sync-invoice', inv.id); }
    catch (e) { notes.push(`Xero not updated: ${esc((e as Error).message)}`); }
    for (const n of await delistPartEverywhere(supabase, part.id, sale.channel)) notes.push(esc(n));

    await sendNotification(supabase, 'ebay_sale', `Part sold on ${where}: ${label}`,
      `<p><strong>${esc(label)}</strong> sold on ${where} for ${esc(currency)} ${esc(total.toFixed(2))}.</p>
       <p>Order ${esc(orderId)} · ${esc(sale.buyer)}.</p>
       <p>Invoice ${esc(inv.invoice_number)} raised and the part marked sold. ${notes.join(' ')}</p>`,
      businessId);
  } catch (e) {
    console.error(`PART SALE NOT RECORDED: ${where} order ${orderId} part ${part.id}: ${(e as Error).message}`);
    await logSystemError(supabase, { source: sale.channel, message: `Part sale not recorded for ${where} order ${orderId}: ${(e as Error).message}`, businessId, detail: { operation: 'order_sync_part', part_id: part.id } });
  }
}
