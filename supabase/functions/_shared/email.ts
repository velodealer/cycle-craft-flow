// Shared email notification helper (Resend, direct API).
import { createClient } from 'npm:@supabase/supabase-js@2';

export const RESEND_INTEGRATION_NAME = 'resend';
export const DEFAULT_FROM = 'VeloDealer <notifications@velodealer.com>';
export const DEFAULT_APP_URL = 'https://velodealer.com';

export type NotificationKind =
  | 'submission_received'
  | 'faults_awaiting_approval'
  | 'logistics_update'
  | 'support_ticket'
  | 'job_application'
  | 'test';

interface KindSettings {
  enabled?: boolean;
  mode?: 'roles' | 'addresses';
  addresses?: string[];
}

export interface ResendSettings {
  enabled?: boolean;
  from_address?: string;
  app_url?: string;
  notifications?: Record<string, KindSettings>;
}

type Client = ReturnType<typeof createClient>;

export function emailServiceClient(): Client {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export async function loadEmailSettings(supabase: Client): Promise<ResendSettings> {
  const { data, error } = await supabase
    .from('integrations')
    .select('settings, is_active')
    .eq('name', RESEND_INTEGRATION_NAME)
    .maybeSingle();
  if (error) {
    console.error('email: failed to load settings', error.message);
    return {};
  }
  if (!data) return {};
  const settings = (data.settings ?? {}) as ResendSettings;
  if (data.is_active === false) return { ...settings, enabled: false };
  return settings;
}

export function appUrl(settings: ResendSettings): string {
  const url = (settings.app_url || DEFAULT_APP_URL).trim();
  return url.replace(/\/+$/, '');
}

async function resolveRecipients(
  supabase: Client,
  settings: ResendSettings,
  kind: NotificationKind,
): Promise<string[]> {
  const kindSettings = settings.notifications?.[kind] ?? {};
  const mode = kindSettings.mode ?? 'roles';
  if (mode === 'addresses') {
    return (kindSettings.addresses ?? [])
      .map((a) => String(a).trim())
      .filter((a) => a.includes('@'));
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('email, role')
    .in('role', ['admin', 'owner']);
  if (error) {
    console.error('email: failed to load admin recipients', error.message);
    return [];
  }
  return (data ?? [])
    .map((p: any) => String(p.email ?? '').trim())
    .filter((e: string) => e.includes('@'));
}

export interface SendResult {
  sent: boolean;
  reason?: string;
  recipients?: string[];
}

/** Sends a Resend email for a notification kind. Never throws. */
export async function sendNotification(
  supabase: Client,
  kind: NotificationKind,
  subject: string,
  html: string,
): Promise<SendResult> {
  try {
    const settings = await loadEmailSettings(supabase);
    if (settings.enabled === false) return { sent: false, reason: 'Email notifications are switched off' };
    if (kind !== 'test' && settings.notifications?.[kind]?.enabled === false) {
      return { sent: false, reason: 'This notification type is switched off' };
    }
    const to = await resolveRecipients(supabase, settings, kind);
    if (!to.length) return { sent: false, reason: 'No recipients configured' };

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('email: RESEND_API_KEY is not configured');
      return { sent: false, reason: 'RESEND_API_KEY is not configured' };
    }

    const from = (settings.from_address || DEFAULT_FROM).trim();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Resend request failed [${response.status}]: ${body}`);
      return { sent: false, reason: `Resend error ${response.status}: ${body}` };
    }
    console.log(`email: sent "${subject}" to ${to.length} recipient(s)`);
    return { sent: true, recipients: to };
  } catch (e) {
    console.error('email: send failed', (e as Error).message);
    return { sent: false, reason: (e as Error).message };
  }
}

/**
 * Sends to an explicit address (account emails such as password resets).
 * Ignores per-notification toggles; honours the master switch and sender address.
 */
export async function sendDirect(
  supabase: Client,
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
  try {
    const settings = await loadEmailSettings(supabase);
    if (settings.enabled === false) return { sent: false, reason: 'Email sending is switched off' };
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY is not configured' };

    const from = (settings.from_address || DEFAULT_FROM).trim();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Resend request failed [${response.status}]: ${body}`);
      return { sent: false, reason: `Resend error ${response.status}` };
    }
    return { sent: true, recipients: [to] };
  } catch (e) {
    console.error('email: direct send failed', (e as Error).message);
    return { sent: false, reason: (e as Error).message };
  }
}

/** Convenience: email admins about newly reported faults on a bike. Never throws. */
export async function notifyFaultsAwaitingApproval(
  supabase: Client,
  bikeId: string,
  faults: any[],
): Promise<void> {
  try {
    const pending = (faults || []).filter((f) => String(f?.status ?? 'reported') === 'reported');
    if (!pending.length) return;
    const { faultsEmail } = await import('./email-templates.ts');
    const { data: bike } = await supabase
      .from('bikes')
      .select('id, reference, make, model')
      .eq('id', bikeId)
      .maybeSingle();
    const settings = await loadEmailSettings(supabase);
    const { subject, html } = faultsEmail(bike ?? { id: bikeId }, pending, appUrl(settings));
    await sendNotification(supabase, 'faults_awaiting_approval', subject, html);
  } catch (e) {
    console.error('email: fault notification failed', (e as Error).message);
  }
}

/** Convenience: email admins about a collection/delivery status change. Never throws. */
export async function notifyLogistics(
  supabase: Client,
  bikeId: string,
  opts: { direction: string; status: string; trackingNumber?: string | null; orderId?: string | null },
): Promise<void> {
  try {
    const { logisticsEmail } = await import('./email-templates.ts');
    const { data: bike } = await supabase
      .from('bikes')
      .select('id, reference, make, model')
      .eq('id', bikeId)
      .maybeSingle();
    const settings = await loadEmailSettings(supabase);
    const { subject, html } = logisticsEmail({ bike: bike ?? { id: bikeId }, ...opts, appUrl: appUrl(settings) });
    await sendNotification(supabase, 'logistics_update', subject, html);
  } catch (e) {
    console.error('email: logistics notification failed', (e as Error).message);
  }
}
