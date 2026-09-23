import { supabase } from '@/integrations/supabase/client';

export interface InspectABikeStatus {
  configured: boolean;
  connected: boolean;
  needs_reconnect: boolean;
  account_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  callback_url: string;
  webhook_url: string;
  has_webhook_secret: boolean;
}

async function callOauth<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('inspectabike-oauth', { body });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export const getInspectABikeStatus = () =>
  callOauth<InspectABikeStatus>({ action: 'status' });

export const getInspectABikeAuthUrl = () =>
  callOauth<{ url: string }>({ action: 'auth_url', origin: window.location.origin });

export const disconnectInspectABike = () =>
  callOauth<{ ok: boolean }>({ action: 'disconnect' });

/**
 * Make sure a bike has an inspection on the dealer's InspectABike account.
 * Fire-and-forget: never blocks or alerts the user when the dealer has not
 * connected an account yet.
 */
export async function ensureInspectionQuietly(bikeId: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('inspections')
      .select('id, external_inspection_id')
      .eq('bike_id', bikeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.external_inspection_id) return;

    await supabase.functions.invoke('inspectabike-create', { body: { bike_id: bikeId } });
  } catch (e) {
    console.warn('Automatic InspectABike inspection skipped:', e);
  }
}

/** Pull the real error message out of an edge function failure. */
export async function functionErrorMessage(error: any, data?: any): Promise<string> {
  if (data?.error) return String(data.error);
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return String(body.error);
  } catch { /* ignore */ }
  return error?.message || 'InspectABike request failed';
}
