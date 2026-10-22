// Emails each dealership's owners/admins about QuickBooks/Xero postings that failed.
// New failures: one email per item. Still failing after a day: one daily summary.
// Runs on a schedule; uses the service role and groups strictly by business_id.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { emailServiceClient, loadEmailSettings, appUrl, sendNotification } from '../_shared/email.ts';

type Item = { key: string; business_id: string; system: string; what: string; label: string; error: string | null; link: string };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const DAY = 24 * 3600 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = emailServiceClient();
  const items: Item[] = [];
  const add = (business_id: string, system: string, what: string, id: string, label: string, error: string | null, link: string) =>
    items.push({ key: `${system}:${what}:${id}`, business_id, system, what, label, error, link });

  const [inv, bikes, parts] = await Promise.all([
    db.from('invoices').select('id, business_id, invoice_number, sync_status, sync_error, xero_sync_status, xero_sync_error')
      .or('sync_status.eq.failed,xero_sync_status.eq.failed').limit(1000),
    db.from('bikes').select('id, business_id, reference, make, model, purchase_sync_status, purchase_sync_error, xero_purchase_sync_status, xero_purchase_sync_error, break_qb_sync_status, break_qb_sync_error, break_xero_sync_status, break_xero_sync_error')
      .or('purchase_sync_status.eq.failed,xero_purchase_sync_status.eq.failed,break_qb_sync_status.eq.failed,break_xero_sync_status.eq.failed').limit(1000),
    db.from('parts').select('id, business_id, description, brand, fit_qb_sync_status, fit_qb_sync_error, fit_xero_sync_status, fit_xero_sync_error')
      .or('fit_qb_sync_status.eq.failed,fit_xero_sync_status.eq.failed').limit(1000),
  ]);
  const err = inv.error || bikes.error || parts.error;
  if (err) return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });

  for (const i of (inv.data ?? []) as any[]) {
    const l = i.invoice_number || 'Invoice';
    if (i.sync_status === 'failed') add(i.business_id, 'QuickBooks', 'Invoice', i.id, l, i.sync_error, `/invoices/${i.id}`);
    if (i.xero_sync_status === 'failed') add(i.business_id, 'Xero', 'Invoice', i.id, l, i.xero_sync_error, `/invoices/${i.id}`);
  }
  for (const b of (bikes.data ?? []) as any[]) {
    const l = [b.reference, b.make, b.model].filter(Boolean).join(' · ');
    const k = `/bikes/${b.id}`;
    if (b.purchase_sync_status === 'failed') add(b.business_id, 'QuickBooks', 'Stock in', b.id, l, b.purchase_sync_error, k);
    if (b.xero_purchase_sync_status === 'failed') add(b.business_id, 'Xero', 'Stock in', b.id, l, b.xero_purchase_sync_error, k);
    if (b.break_qb_sync_status === 'failed') add(b.business_id, 'QuickBooks', 'Bike break', b.id, l, b.break_qb_sync_error, k);
    if (b.break_xero_sync_status === 'failed') add(b.business_id, 'Xero', 'Bike break', b.id, l, b.break_xero_sync_error, k);
  }
  for (const p of (parts.data ?? []) as any[]) {
    if (p.fit_qb_sync_status === 'failed') add(p.business_id, 'QuickBooks', 'Part fitted', p.id, ([p.brand, p.description].filter(Boolean).join(' ') || 'Part'), p.fit_qb_sync_error, '/parts');
    if (p.fit_xero_sync_status === 'failed') add(p.business_id, 'Xero', 'Part fitted', p.id, ([p.brand, p.description].filter(Boolean).join(' ') || 'Part'), p.fit_xero_sync_error, '/parts');
  }

  const { data: alerted } = await db.from('sync_failure_alerts').select('business_id, alert_key, first_alerted_at, last_reminded_at');
  const known = new Map<string, any>((alerted ?? []).map((a: any) => [`${a.business_id}|${a.alert_key}`, a]));
  const failingNow = new Set(items.map((i) => `${i.business_id}|${i.key}`));

  // Forget items that are fixed, so a future failure alerts again.
  for (const [k, a] of known) {
    if (!failingNow.has(k)) await db.from('sync_failure_alerts').delete().eq('business_id', a.business_id).eq('alert_key', a.alert_key);
  }

  const byBiz = new Map<string, Item[]>();
  for (const i of items) if (i.business_id) byBiz.set(i.business_id, [...(byBiz.get(i.business_id) ?? []), i]);

  let newSent = 0, summaries = 0;
  for (const [biz, list] of byBiz) {
    const base = appUrl(await loadEmailSettings(db, biz));
    const now = Date.now();

    for (const i of list.filter((x) => !known.has(`${biz}|${x.key}`))) {
      const html = `<p><strong>${esc(i.what)} for ${esc(i.label)}</strong> didn't reach ${i.system}.</p>
<p>Reason: ${esc((i.error || 'No reason given').slice(0, 500))}</p>
<p><a href="${base}${i.link}">Open it</a> or press Retry on the <a href="${base}/dashboard">dashboard</a>.</p>`;
      const r = await sendNotification(db, 'sync_failed', `${i.system} sync failed: ${i.label}`, html, biz);
      // Record even when emails are switched off, so turning them on later doesn't flood old items.
      await db.from('sync_failure_alerts').insert({ business_id: biz, alert_key: i.key, last_reminded_at: new Date().toISOString() });
      if (r.sent) newSent++;
    }

    const stale = list.filter((x) => {
      const a = known.get(`${biz}|${x.key}`);
      return a && now - Date.parse(a.last_reminded_at || a.first_alerted_at) >= DAY - 10 * 60 * 1000;
    });
    if (stale.length) {
      const rows = stale.map((i) => `<li><a href="${base}${i.link}">${esc(i.what)} · ${esc(i.label)}</a> (${i.system}): ${esc((i.error || '').slice(0, 200))}</li>`).join('');
      const r = await sendNotification(db, 'sync_failed', `${stale.length} accounting sync${stale.length > 1 ? 's' : ''} still failing`,
        `<p>These still haven't reached your accounts:</p><ul>${rows}</ul><p>Press Retry on the <a href="${base}/dashboard">dashboard</a>.</p>`, biz);
      await db.from('sync_failure_alerts').update({ last_reminded_at: new Date().toISOString() })
        .eq('business_id', biz).in('alert_key', stale.map((s) => s.key));
      if (r.sent) summaries++;
    }
  }

  return new Response(JSON.stringify({ ok: true, failing: items.length, new_emails: newSent, summaries }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
