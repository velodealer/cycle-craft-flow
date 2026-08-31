import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface QboAccountMap {
  stock?: string;
  cogs?: string;
  sales?: string;
  vat?: string;
  purchase_funding?: string;
}


export interface QboStatus {
  connected: boolean;
  environment: string;
  realm_id: string | null;
  accounts: QboAccountMap;
  tax_codes: QboTaxCodeMap;
  connected_at: string | null;
  redirect_uri: string;
}

export interface QboAccount {
  id: string;
  name: string;
  type: string;
  subType?: string;
  classification?: string;
}

export interface QboTaxCodeMap {
  standard_sales?: string;
  margin_sales?: string;
}

export interface QboTaxCode {
  id: string;
  name: string;
  rate: number | null;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = details;
    try {
      const parsed = JSON.parse(details);
      message = parsed.error || details;
    } catch { /* keep raw text */ }
    throw new Error(message);
  }
  return data as T;
}

export const getQuickBooksStatus = () => invoke<QboStatus>('quickbooks-oauth', { action: 'status' });
export const getQuickBooksAuthUrl = () => invoke<{ url: string }>('quickbooks-oauth', { action: 'auth_url' });
export const listQuickBooksAccounts = () => invoke<{ accounts: QboAccount[] }>('quickbooks-oauth', { action: 'accounts' });
export const saveQuickBooksAccounts = (accounts: QboAccountMap) =>
  invoke<{ ok: true }>('quickbooks-oauth', { action: 'save_accounts', accounts });
export const listQuickBooksTaxCodes = () =>
  invoke<{ tax_codes: QboTaxCode[] }>('quickbooks-oauth', { action: 'tax_codes' });
export const saveQuickBooksTaxCodes = (taxCodes: QboTaxCodeMap) =>
  invoke<{ ok: true }>('quickbooks-oauth', { action: 'save_tax_codes', tax_codes: taxCodes });
export const disconnectQuickBooks = () => invoke<{ ok: true }>('quickbooks-oauth', { action: 'disconnect' });

/** Readable QuickBooks Doc Numbers (max 21 chars) — must match the edge functions. */
export const stockInDocNumber = (bikeReference?: string | null) =>
  bikeReference ? `STK-IN-${bikeReference}`.slice(0, 21) : null;
export const stockOutDocNumber = (bikeReference?: string | null) =>
  bikeReference ? `STK-OUT-${bikeReference}`.slice(0, 21) : null;


export const syncBikePurchase = (bikeId: string) =>
  invoke<{ ok: true; journal_id?: string; skipped?: string }>('quickbooks-sync-purchase', { bike_id: bikeId });

export const syncInvoice = (invoiceId: string) =>
  invoke<{ ok: true; quickbooks_invoice_id?: string; margin_vat?: number }>('quickbooks-sync-invoice', {
    invoice_id: invoiceId,
  });

/** Fire-and-forget purchase posting: never blocks or breaks the calling UI flow. */
export async function tryPostPurchase(bikeId: string) {
  try {
    await syncBikePurchase(bikeId);
    return { ok: true as const };
  } catch (e) {
    console.warn('QuickBooks purchase posting failed', e);
    return { ok: false as const, error: (e as Error).message };
  }
}
