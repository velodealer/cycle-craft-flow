// Pure, import-free rules for the guided Photos step (tested in supabase/functions/_shared).

export interface GuideShotLite { n: number; id: string }
export interface ShotRecord { shot_id: string; status: 'captured' | 'skipped' }

/** Shots 1–3 (side profile and both three-quarters) must always be captured. */
export const isSkippable = (shot: GuideShotLite) => shot.n > 3;

export function shotDone(shotId: string, records: ShotRecord[]) {
  return records.some((r) => r.shot_id === shotId);
}

/** Every shot captured or skipped, and the required ones never skipped. */
export function canContinueToListing(shots: GuideShotLite[], records: ShotRecord[]) {
  return shots.length > 0 && shots.every((s) => {
    const r = records.find((x) => x.shot_id === s.id);
    if (!r) return false;
    return r.status === 'captured' || isSkippable(s);
  });
}

export function firstMissingIndex(shots: GuideShotLite[], records: ShotRecord[], from = 0) {
  for (let i = 0; i < shots.length; i++) {
    const idx = (from + i) % shots.length;
    if (!shotDone(shots[idx].id, records)) return idx;
  }
  return -1;
}

/** Captured shots in shot order — shot 1 becomes the main listing image. */
export function orderedCaptured<T extends { status: string; shot_number: number }>(rows: T[]) {
  return rows.filter((r) => r.status === 'captured').sort((a, b) => a.shot_number - b.shot_number);
}

export const photoPath = (businessId: string, bikeId: string, shot: GuideShotLite) =>
  `${businessId}/${bikeId}/${String(shot.n).padStart(2, '0')}-${shot.id}.jpg`;

/** Centred square of a frame, capped at 2048px — matches what the viewfinder shows. */
export function squareCrop(width: number, height: number, cap = 2048) {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side, out: Math.min(side, cap) };
}
