// Emails super admins about new dealers awaiting approval, deletion requests and new errors.
// Runs hourly; platform_alert_log records what was sent so nothing is emailed twice.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { emailServiceClient, DEFAULT_APP_URL, sendNotification } from '../_shared/email.ts';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const db = emailServiceClient();
  const base = DEFAULT_APP_URL;
  const { data: cfg } = await db.from('platform_alert_settings').select('*').eq('id', true).maybeSingle();
  const on = (k: string) => (cfg as any)?.[k] !== false;
  const { data: logRows } = await db.from('platform_alert_log').select('alert_key, sent_at');
  const log = new Map<string, string>((logRows ?? []).map((r: any) => [r.alert_key, r.sent_at]));
  const mark = (keys: string[]) =>
    keys.length ? db.from('platform_alert_log').upsert(keys.map((alert_key) => ({ alert_key, sent_at: new Date().toISOString() }))) : null;
  const out = { dealers: 0, deletions: 0, errors: 0 };

  // 1. New dealers awaiting approval
  const { data: biz } = await db.from('businesses').select('id, name, contact_email, created_at').eq('status', 'pending');
  for (const b of (biz ?? []) as any[]) {
    const key = `dealer:${b.id}`;
    if (log.has(key)) continue;
    if (on('dealer_signup')) {
      const r = await sendNotification(db, 'dealer_signup', `New dealership awaiting approval: ${b.name}`,
        `<p><strong>${esc(b.name)}</strong> has signed up and is waiting for approval.</p>
<p>Contact: ${esc(b.contact_email || 'not given')}<br>Signed up: ${esc(new Date(b.created_at).toUTCString())}</p>
<p><a href="${base}/admin/dealerships">Review it in Admin → Dealerships</a></p>`);
      if (r.sent) out.dealers++;
    }
    await mark([key]);
  }

  // 2. Deletion requests
  const { data: dels } = await db.from('data_deletion_requests')
    .select('id, business_id, requester_email, reason, created_at, businesses(name)').eq('status', 'pending');
  for (const d of (dels ?? []) as any[]) {
    const key = `deletion:${d.id}`;
    if (log.has(key)) continue;
    if (on('deletion_request')) {
      const r = await sendNotification(db, 'deletion_request', `Deletion requested: ${d.businesses?.name ?? 'a dealership'}`,
        `<p><strong>${esc(d.businesses?.name ?? 'A dealership')}</strong> has asked for its data to be deleted.</p>
<p>Requested by: ${esc(d.requester_email || 'unknown')}<br>Reason: ${esc(d.reason || 'none given')}</p>
<p><a href="${base}/admin/deletions">Review it in Admin → Deletions</a></p>`);
      if (r.sent) out.deletions++;
    }
    await mark([key]);
  }

  // 3. Error digest (new errors since the last digest)
  const since = log.get('errors:last') ?? new Date(Date.now() - 3600_000).toISOString();
  const now = new Date().toISOString();
  const { data: errs } = await db.from('system_error_logs')
    .select('source, message, url, business_id, businesses(name)')
    .gt('created_at', since).lte('created_at', now).order('created_at', { ascending: false }).limit(1000);
  if ((errs ?? []).length && on('system_errors')) {
    const groups = new Map<string, { e: any; n: number }>();
    for (const e of errs as any[]) {
      const k = `${e.business_id}|${e.source}|${e.message}`;
      const g = groups.get(k);
      g ? g.n++ : groups.set(k, { e, n: 1 });
    }
    const rows = [...groups.values()].slice(0, 30).map(({ e, n }) =>
      `<li><strong>${esc(e.businesses?.name ?? 'Unknown dealership')}</strong> · ${esc(e.source)}${e.url ? ` · ${esc(e.url)}` : ''}: ${esc(String(e.message).slice(0, 200))}${n > 1 ? ` <em>(×${n})</em>` : ''}</li>`).join('');
    const total = errs!.length;
    const r = await sendNotification(db, 'system_errors', `${total} new error${total > 1 ? 's' : ''} on VeloDealer`,
      `<p>${total} new error${total > 1 ? 's' : ''} in the last hour:</p><ul>${rows}</ul>${groups.size > 30 ? `<p>…and ${groups.size - 30} more kinds.</p>` : ''}
<p><a href="${base}/admin/errors">Open Admin → Errors</a></p>`);
    if (r.sent) out.errors = total;
  }
  await db.from('platform_alert_log').upsert({ alert_key: 'errors:last', sent_at: now });

  return json({ ok: true, ...out });
});
