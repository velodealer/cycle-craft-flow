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

// Generate a secure webhook secret
export const generateWebhookSecret = (): string => {
  const randomString = crypto.randomUUID().replace(/-/g, '');
  return `ccc_webhook_${randomString}`;
};

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

// Save or update Cycle Courier Co API key
export const saveCycleCourierApiKey = async (
  apiKey: string,
  existingIntegration?: Integration | null
): Promise<Integration> => {
  // Auto-generate webhook secret if creating new integration
  const webhookSecret = existingIntegration?.webhook_secret || generateWebhookSecret();

  if (existingIntegration) {
    // Update existing integration
    const { data, error } = await supabase
      .from('integrations')
      .update({
        api_key: apiKey,
        is_active: true,
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
  } else {
    // Create new integration
    const { data, error } = await supabase
      .from('integrations')
      .insert({
        name: 'cycle_courier_co',
        display_name: 'Cycle Courier Co',
        api_key: apiKey,
        webhook_secret: webhookSecret,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating integration:', error);
      throw error;
    }

    return data;
  }
};

// Test Cycle Courier Co connection
export const testCycleCourierConnection = async (apiKey: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('test-cycle-courier', {
      body: { apiKey },
    });

    if (error) {
      console.error('Error testing connection:', error);
      return false;
    }

    return data?.success || false;
  } catch (error) {
    console.error('Error testing connection:', error);
    return false;
  }
};

// Regenerate webhook secret
export const regenerateWebhookSecret = async (
  integrationId: string
): Promise<string> => {
  const newSecret = generateWebhookSecret();

  const { data, error } = await supabase
    .from('integrations')
    .update({
      webhook_secret: newSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId)
    .select('webhook_secret')
    .single();

  if (error) {
    console.error('Error regenerating webhook secret:', error);
    throw error;
  }

  return data.webhook_secret;
};

// Deactivate Cycle Courier Co integration
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
  return 'https://hgztcymscgyuekgsyyfe.supabase.co/functions/v1/cycle-courier-webhook';
};
