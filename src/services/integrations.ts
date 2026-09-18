import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface Integration {
  id: string;
  name: string;
  display_name: string;
  api_key: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  settings: Json;
  created_at: string;
  updated_at: string;
}


// Get Cycle Courier Co integration
export const getCycleCourierIntegration = async (): Promise<Integration | null> => {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('name', 'cycle_courier_co')
    .maybeSingle();

  if (error) {
    console.error('Error fetching integration:', error);
    throw error;
  }

  return data;
};

export interface BpsReceiverSettings {
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    postcode: string;
    country: string;
  };
}

// Save Cycle Courier Co webhook secret + delivery address settings
export const saveCycleCourierSettings = async (
  webhookSecret: string,
  bpsReceiver: BpsReceiverSettings,
  existingIntegration?: Integration | null
): Promise<Integration> => {
  if (existingIntegration) {
    const { data, error } = await supabase
      .from('integrations')
      .update({
        webhook_secret: webhookSecret,
        is_active: true,
        settings: { bps_receiver: bpsReceiver } as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingIntegration.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating integration:', error);
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('integrations')
    .insert({
      name: 'cycle_courier_co',
      display_name: 'Cycle Courier Co',
      webhook_secret: webhookSecret,
      is_active: true,
      settings: { bps_receiver: bpsReceiver } as unknown as Json,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating integration:', error);
    throw error;
  }

  return data;
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
