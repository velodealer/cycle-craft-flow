import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface XeroAccountMap { stock?: string; parts_stock?: string; cogs?: string; sales?: string; vat?: string; purchase_funding?: string }
export interface XeroTaxMap { standard_sales?: string; margin_sales?: string }
export interface XeroStatus {
  configured: boolean;
  connected: boolean;
  tenant_id: string | null;
  tenant_name: string | null;
  connected_at: string | null;
  accounts: XeroAccountMap;
  tax_types: XeroTaxMap;
  auth_error: string | null;
  health: { missing_accounts: string[]; missing_tax_types: string[]; checked_at: string } | null;
  redirect_uri: string;
  can_manage: boolean;
}
export interface XeroAccount { code: string; name: string; type: string; class: string; system: string | null }
export interface XeroTaxRate { type: string; name: string; rate: number | null }
export interface XeroTenant { id: string; name: string }

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let message = details;
    try { message = JSON.parse(details).error || details; } catch { /* raw */ }
    throw new Error(message);
  }
  return data as T;
}

const x = <T,>(action: string, extra: Record<string, unknown> = {}) => invoke<T>('xero-oauth', { action, ...extra });

export const getXeroStatus = () => x<XeroStatus>('status');
export const getXeroAuthUrl = () => x<{ url: string }>('auth_url', { origin: window.location.origin });
export const listXeroTenants = () => x<{ tenants: XeroTenant[] }>('tenants');
export const chooseXeroTenant = (tenantId: string) => x<{ ok: true }>('choose_tenant', { tenant_id: tenantId });
export const listXeroAccounts = () => x<{ accounts: XeroAccount[] }>('accounts');
export const listXeroTaxRates = () => x<{ tax_rates: XeroTaxRate[] }>('tax_rates');
export const saveXeroAccounts = (accounts: XeroAccountMap) => x<{ ok: true }>('save_accounts', { accounts });
export const saveXeroTaxRates = (taxTypes: XeroTaxMap) => x<{ ok: true }>('save_tax_rates', { tax_types: taxTypes });
export const checkXeroHealth = () => x<{ health: XeroStatus['health'] }>('health');
export const disconnectXero = () => x<{ ok: true }>('disconnect');

type SyncResult = { ok: boolean; skipped?: string; error?: string };

/** Posts a sale to Xero. Never throws; skipped when the dealership hasn't connected Xero. */
export async function trySyncXeroInvoice(invoiceId: string): Promise<SyncResult> {
  try {
    return await invoke<{ ok: true; skipped?: string }>('xero-sync-invoice', { invoice_id: invoiceId });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Posts a bike's stock-in to Xero. Never throws; skipped when Xero isn't connected. */
export async function tryPostXeroPurchase(bikeId: string): Promise<SyncResult> {
  try {
    return await invoke<{ ok: true; skipped?: string }>('xero-sync-purchase', { bike_id: bikeId });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Posts a bike break's stock reclassification to Xero. Never throws. */
export async function tryPostBreakToXero(bikeId: string): Promise<SyncResult> {
  try {
    return await invoke<{ ok: true; skipped?: string }>('xero-break-bike', { bike_id: bikeId });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function tryPostFitPartToXero(partId: string): Promise<SyncResult> {
  try {
    return await invoke<{ ok: true; skipped?: string }>('xero-fit-part', { part_id: partId });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Reverses a fit when the part goes back to stock (Dr parts stock / Cr stock at its stock value). */
export async function tryPostUnfitPartToXero(partId: string): Promise<SyncResult> {
  try {
    return await invoke<{ ok: true; skipped?: string }>('xero-fit-part', { part_id: partId, reverse: true });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
