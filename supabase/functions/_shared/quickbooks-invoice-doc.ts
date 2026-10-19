// QuickBooks' own invoice document: PDF, staff link and (when enabled) customer pay link.
import { getQboAuth, qboApiBase, qboEnv, qboFetch, saveSettings, serviceClient } from './quickbooks.ts';

type Client = ReturnType<typeof serviceClient>;

export function qboInvoiceAppUrl(qboInvoiceId: string) {
  const host = qboEnv() === 'production' ? 'https://app.qbo.intuit.com' : 'https://app.sandbox.qbo.intuit.com';
  return `${host}/app/invoice?txnId=${encodeURIComponent(qboInvoiceId)}`;
}

function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function pdfWith(accessToken: string, realmId: string, id: string) {
  return await fetch(`${qboApiBase()}/v3/company/${realmId}/invoice/${encodeURIComponent(id)}/pdf?minorversion=70`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/pdf' },
  });
}

/** Downloads QuickBooks' PDF for an invoice as base64. Throws with the QuickBooks status/body on failure. */
export async function fetchQboInvoicePdf(supabase: Client, qboInvoiceId: string): Promise<string> {
  let auth = await getQboAuth(supabase);
  let res = await pdfWith(auth.accessToken, auth.realmId, qboInvoiceId);
  if (res.status === 401) {
    await saveSettings(supabase, { access_token: undefined, access_token_expires_at: undefined });
    auth = await getQboAuth(supabase);
    res = await pdfWith(auth.accessToken, auth.realmId, qboInvoiceId);
  }
  if (!res.ok) {
    const body = await res.text();
    console.error(`QuickBooks PDF failed [${res.status}]: ${body}`);
    throw new Error(`QuickBooks PDF failed [${res.status}]: ${body}`);
  }
  return toBase64(new Uint8Array(await res.arrayBuffer()));
}

/** Customer-facing QuickBooks link; only exists when online payments are switched on in QuickBooks. */
export async function fetchQboInvoiceLink(supabase: Client, qboInvoiceId: string): Promise<{ link: string | null; docNumber: string | null }> {
  try {
    const auth = await getQboAuth(supabase);
    const r = await qboFetch(auth.accessToken, auth.realmId, `/invoice/${encodeURIComponent(qboInvoiceId)}?include=invoiceLink&minorversion=70`);
    return { link: r?.Invoice?.InvoiceLink || null, docNumber: r?.Invoice?.DocNumber || null };
  } catch {
    return { link: null, docNumber: null };
  }
}
