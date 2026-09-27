import { supabase } from '@/integrations/supabase/client';

/** Words that mark a job as safety work which must be done before listing. */
export const DEFAULT_SAFETY_KEYWORDS = [
  'brake', 'rotor', 'caliper', 'pad', 'steer', 'headset', 'stem', 'handlebar',
  'frame', 'fork', 'crack', 'rim', 'spoke', 'hub', 'axle', 'thru', 'tyre', 'tire', 'suspension', 'shock',
];

export const deferralKey = (businessId: string) => `deferral_rules:${businessId}`;

export function normaliseKeywords(raw: any): string[] {
  const list = Array.isArray(raw?.safety_keywords) ? raw.safety_keywords : DEFAULT_SAFETY_KEYWORDS;
  return list.map((k: unknown) => String(k).trim().toLowerCase()).filter(Boolean);
}

export async function loadSafetyKeywords(): Promise<string[]> {
  const { data: bid } = await supabase.rpc('current_business_id');
  if (!bid) return DEFAULT_SAFETY_KEYWORDS;
  const { data } = await supabase.from('app_settings').select('value').eq('key', deferralKey(bid as string)).maybeSingle();
  return normaliseKeywords(data?.value);
}

/** A job can be deferred unless its title/description mentions a safety keyword. */
export function isDeferrable(job: { title?: string | null; description?: string | null }, keywords: string[]) {
  const text = `${job.title ?? ''} ${job.description ?? ''}`.toLowerCase();
  return !keywords.some((k) => text.includes(k));
}

const closed = (s: string) => ['complete', 'completed', 'cancelled'].includes(s);

export interface OpenJob { id: string; title: string; deferred: boolean; deferred_reason: string | null }

/** Open workshop jobs on a bike, split into ones that block listing and deferred ones. */
export async function openWorkshopJobs(bikeId: string): Promise<{ blocking: OpenJob[]; deferred: OpenJob[] }> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, status, deferred, deferred_reason')
    .eq('bike_id', bikeId)
    .eq('type', 'workshop');
  if (error) throw new Error(`Could not check jobs: ${error.message}`);
  const open = ((data as any[]) ?? []).filter((j) => !closed(j.status));
  return { blocking: open.filter((j) => !j.deferred), deferred: open.filter((j) => j.deferred) };
}
