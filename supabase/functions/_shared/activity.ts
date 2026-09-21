// Shared activity logger for edge functions. Uses the service-role client so
// automatic events (integrations, webhooks) are recorded even without a user.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

export type EdgeActivityKind =
  | 'status_change'
  | 'price_change'
  | 'listing'
  | 'sale'
  | 'job'
  | 'part'
  | 'cost'
  | 'inspection'
  | 'logistics'
  | 'photo'
  | 'detail_change'
  | 'storage'
  | 'bike';

export interface EdgeActivityEntry {
  kind: EdgeActivityKind;
  action: string;
  summary: string;
  detail?: Record<string, unknown>;
  actorId?: string | null;
  actorLabel?: string | null;
}

function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

/**
 * Records an activity entry for a bike. Never throws — logging must not break
 * the operation it describes.
 */
export async function logBikeActivity(
  bikeId: string,
  entry: EdgeActivityEntry,
  businessId?: string | null,
): Promise<void> {
  try {
    const admin = adminClient();
    let bizId = businessId ?? null;
    if (!bizId) {
      const { data } = await admin.from('bikes').select('business_id').eq('id', bikeId).maybeSingle();
      bizId = (data as { business_id?: string } | null)?.business_id ?? null;
    }
    if (!bizId) return;
    const { error } = await admin.from('bike_activity').insert({
      bike_id: bikeId,
      business_id: bizId,
      kind: entry.kind,
      action: entry.action,
      summary: entry.summary,
      detail: entry.detail ?? {},
      actor_id: entry.actorId ?? null,
      actor_label: entry.actorLabel ?? null,
    });
    if (error) console.error('Failed to log bike activity', error.message);
  } catch (e) {
    console.error('Failed to log bike activity', e);
  }
}
