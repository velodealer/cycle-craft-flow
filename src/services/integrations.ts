import { supabase } from "@/integrations/supabase/client";

export interface Integration {
  id: string;
  name: string;
  display_name: string;
  has_webhook_secret: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}


// Browsers never read saved secrets; only these columns are readable.
const COLS = 'id, name, display_name, is_active, created_at, updated_at';

// Get Cycle Courier Co integration
export const getCycleCourierIntegration = async (): Promise<Integration | null> => {
  const { data: row, error } = await supabase
    .from('integrations')
    .select(COLS)
    .eq('name', 'cycle_courier_co')
    .maybeSingle();
  if (error) {
    console.error('Error fetching integration:', error);
    throw error;
  }
  if (!row) return null;
  const { data: info } = await supabase.rpc('get_integration_settings' as any, { _name: 'cycle_courier_co' });
  return { ...row, has_webhook_secret: Boolean((info as any)?.has_webhook_secret) } as Integration;
};

// Save Cycle Courier Co webhook secret. The shop address is held on the
// dealer's own Cycle Courier account and filled in by them at booking time.
export const saveCycleCourierSettings = async (
  webhookSecret: string,
  existingIntegration?: Integration | null
): Promise<Integration> => {
  if (existingIntegration) {
    const { data, error } = await supabase
      .from('integrations')
      .update({
        webhook_secret: webhookSecret,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingIntegration.id)
      .select(COLS)
      .single();

    if (error) {
      console.error('Error updating integration:', error);
      throw error;
    }

    return { ...data, has_webhook_secret: true } as Integration;
  }

  const { data, error } = await supabase
    .from('integrations')
    .insert({
      name: 'cycle_courier_co',
      display_name: 'Cycle Courier Co',
      webhook_secret: webhookSecret,
      is_active: true,
    })
    .select(COLS)
    .single();

  if (error) {
    console.error('Error creating integration:', error);
    throw error;
  }

  return { ...data, has_webhook_secret: true } as Integration;
};


export interface CycleCourierStatus {
  configured: boolean;
  connected: boolean;
  needs_reconnect: boolean;
  account_name: string | null;
  connected_at: string | null;
  last_error: string | null;
  callback_url: string;
}

const callOauth = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('cycle-courier-oauth', { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
};

export const getCycleCourierStatus = () =>
  callOauth<CycleCourierStatus>({ action: 'status' });

export const getCycleCourierAuthUrl = () =>
  callOauth<{ url: string }>({ action: 'auth_url', origin: window.location.origin });

export const disconnectCycleCourier = () =>
  callOauth<{ ok: boolean }>({ action: 'disconnect' });

// Deactivate Cycle Courier Co integration settings row
export const deactivateCycleCourierIntegration = async (
  integrationId: string
): Promise<void> => {
  const { error } = await supabase
    .from('integrations')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  if (error) {
    console.error('Error deactivating integration:', error);
    throw error;
  }
};

// Get webhook URL
export const getWebhookUrl = (): string => {
  return 'https://api.velodealer.com/functions/v1/cycle-courier-webhook';
};
