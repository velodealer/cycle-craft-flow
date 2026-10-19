import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { MirroredInvoice } from '@/components/invoice/InvoiceDocument';

type Ref = { token: string } | { invoice_id: string };

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('invoice-view', { body });
  if (error) {
    const t = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = t; try { msg = JSON.parse(t).error ?? t; } catch { /* raw */ }
    throw new Error(msg);
  }
  return data as T;
}

export const fetchInvoiceView = (ref: Ref) => call<MirroredInvoice>(ref);

export const publicInvoiceUrl = (token: string) => `${window.location.origin}/i/${token}`;

export async function downloadInvoicePdf(ref: Ref, fileName: string) {
  const { pdf_base64 } = await call<{ pdf_base64: string }>({ ...ref, pdf: true });
  const bytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName.replace(/[^A-Za-z0-9.-]/g, '');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
