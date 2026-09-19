// Plain HTML builders for VeloDealer notification emails.

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '-';
  return `£${n.toFixed(2)}`;
}

export function layout(
  title: string,
  bodyHtml: string,
  ctaLabel?: string,
  ctaUrl?: string,
  footer = 'You are receiving this because you are set as a notification recipient in VeloDealer settings.',
): string {
  const logoUrl = 'https://velodealer.com/__l5e/assets-v1/9db65c55-64fa-4206-8c82-d9d54175705e/velodealer-lockup-light.svg';
  const cta = ctaLabel && ctaUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(ctaUrl)}" style="background:#ECA72C;color:#131A22;padding:10px 18px;border-radius:4px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(ctaLabel)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#E9EDF1;font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#131A22">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d8dde3;border-radius:4px;padding:28px">
    <img src="${logoUrl}" width="212" alt="VeloDealer" style="display:block;width:212px;height:auto;margin:0 0 24px" />
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
    ${bodyHtml}
    ${cta}
    <p style="margin:28px 0 0;font-size:12px;color:#5B6470">${escapeHtml(footer)}</p>
  </div></body></html>`;
}

export function passwordResetEmail(resetUrl: string) {
  const subject = 'Reset your VeloDealer password';
  const body = `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">We received a request to reset the password on your VeloDealer account.</p>
  <p style="margin:0;font-size:15px;line-height:1.5">Use the button below to choose a new password. The link can only be used once and expires shortly.</p>
  <p style="margin:20px 0 0;font-size:13px;color:#78716c;word-break:break-all">If the button does not work, paste this into your browser:<br>${escapeHtml(resetUrl)}</p>`;
  return {
    subject,
    html: layout(
      subject,
      body,
      'Choose a new password',
      resetUrl,
      'If you did not ask for a password reset you can safely ignore this email.',
    ),
  };
}

function rows(pairs: Array<[string, unknown]>): string {
  const cells = pairs
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
    .map(([k, v]) =>
      `<tr><td style="padding:6px 12px 6px 0;color:#78716c;font-size:14px">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<table style="border-collapse:collapse;width:100%">${cells}</table>`;
}

export function submissionEmail(sub: any, appUrl: string) {
  const title = 'New bike submission received';
  const body = rows([
    ['Customer', sub.customer_name],
    ['Email', sub.customer_email],
    ['Phone', sub.customer_phone],
    ['Bike', [sub.bike_make, sub.bike_model, sub.bike_year].filter(Boolean).join(' ')],
    ['Condition', sub.bike_condition],
    ['Asking price', sub.asking_price ? money(sub.asking_price) : null],
    ['Photos', Array.isArray(sub.photo_urls) && sub.photo_urls.length ? `${sub.photo_urls.length} attached` : 'None'],
  ]);
  return {
    subject: `New bike submission${sub.customer_name ? ` from ${sub.customer_name}` : ''}`,
    html: layout(title, body, 'View submissions', `${appUrl}/submissions`),
  };
}

export function faultsEmail(bike: any, faults: any[], appUrl: string) {
  const ref = bike?.reference || bike?.id || 'Bike';
  const list = faults.map((f) => {
    const costs = [
      f.parts_cost ? `parts ${money(f.parts_cost)}` : null,
      f.labour_cost ? `labour ${money(f.labour_cost)}` : null,
    ].filter(Boolean).join(', ');
    return `<li style="margin-bottom:8px;font-size:14px"><strong>${escapeHtml(f.title || f.description || 'Fault')}</strong>${costs ? ` — ${escapeHtml(costs)}` : ''}</li>`;
  }).join('');
  const total = faults.reduce((sum, f) => sum + Number(f.parts_cost || 0) + Number(f.labour_cost || 0), 0);
  const body = `${rows([
    ['Bike', [ref, bike?.make, bike?.model].filter(Boolean).join(' · ')],
    ['Faults awaiting approval', faults.length],
    ['Estimated total', money(total)],
  ])}<ul style="padding-left:18px;margin:16px 0 0">${list}</ul>`;
  return {
    subject: `${faults.length} repair${faults.length === 1 ? '' : 's'} awaiting approval — ${ref}`,
    html: layout('Repairs awaiting approval', body, 'Review repairs', `${appUrl}/repairs`),
  };
}

export function logisticsEmail(opts: {
  bike: any;
  direction: string;
  status: string;
  trackingNumber?: string | null;
  orderId?: string | null;
  appUrl: string;
}) {
  const ref = opts.bike?.reference || '';
  const label = opts.direction === 'outbound' ? 'Delivery to customer' : 'Collection from seller';
  const body = rows([
    ['Bike', [ref, opts.bike?.make, opts.bike?.model].filter(Boolean).join(' · ')],
    ['Movement', label],
    ['Status', opts.status],
    ['Tracking number', opts.trackingNumber],
    ['Order ID', opts.orderId],
  ]);
  return {
    subject: `${label} ${opts.status}${ref ? ` — ${ref}` : ''}`,
    html: layout('Transport update', body, 'Open logistics', `${opts.appUrl}/logistics`),
  };
}

export function testEmail(appUrl: string) {
  return {
    subject: 'VeloDealer test email',
    html: layout(
      'Test email',
      '<p style="font-size:14px;margin:0">If you can read this, VeloDealer can send email notifications through Resend.</p>',
      'Open VeloDealer',
      appUrl,
    ),
  };
}
