import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

/** Emails an invoice to its customer (or `to`). Never throws. */
export async function emailInvoice(invoiceId: string, to?: string): Promise<{ ok: boolean; to?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-invoice-email', { body: { invoice_id: invoiceId, ...(to ? { to } : {}) } });
    if (error) {
      const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      let msg = details;
      try { const p = JSON.parse(details); msg = typeof p.error === 'string' ? p.error : JSON.stringify(p.error); } catch { /* raw */ }
      return { ok: false, error: msg };
    }
    return { ok: true, to: (data as any)?.to };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export const invoicePath = (id: string) => `/invoices/${id}`;
