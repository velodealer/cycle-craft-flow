import { supabase } from '@/integrations/supabase/client';
import { photoPath, squareCrop } from './photoGuideRules';

export interface GuideSection { id: string; title: string; hint: string }
export interface GuideShot {
  n: number; id: string; section: string; title: string; side: string;
  prompt: string; instruction: string; check: string; overlay: string; example: string | null;
}
export interface PhotoGuide { sections: GuideSection[]; shots: GuideShot[] }
export interface BikePhotoRow {
  id?: string; bike_id: string; shot_id: string; shot_number: number;
  status: 'captured' | 'skipped'; skip_reason: string | null; storage_path: string | null;
  width: number | null; height: number | null; updated_at?: string;
}

export const GUIDE_BASE = '/photo-guide/';
export const assetUrl = (p: string) => GUIDE_BASE + p;

let cached: Promise<PhotoGuide> | null = null;
export function loadPhotoGuide() {
  cached ??= fetch(assetUrl('shots.json')).then((r) => {
    if (!r.ok) throw new Error('Could not load the photo guide');
    return r.json();
  });
  return cached;
}

/** Crop any image/video frame to the centred square and encode JPEG 0.9. */
export async function cropToSquareJpeg(source: CanvasImageSource, width: number, height: number) {
  const { sx, sy, side, out } = squareCrop(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = out; canvas.height = out;
  canvas.getContext('2d')!.drawImage(source, sx, sy, side, side, 0, 0, out, out);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not save photo'))), 'image/jpeg', 0.9));
  return { blob, width: out, height: out };
}

export async function cropFileToSquare(file: File) {
  const bmp = await createImageBitmap(file);
  try { return await cropToSquareJpeg(bmp, bmp.width, bmp.height); } finally { bmp.close?.(); }
}

export function publicPhotoUrl(row: Pick<BikePhotoRow, 'storage_path' | 'updated_at'>) {
  if (!row.storage_path) return null;
  const { data } = supabase.storage.from('bike-photos').getPublicUrl(row.storage_path);
  const v = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
  return `${data.publicUrl}?v=${v}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upload (replacing any earlier take) and record the shot; retries 3 times. */
export async function saveShot(bike: { id: string; business_id: string }, shot: GuideShot, blob: Blob, width: number, height: number) {
  const path = photoPath(bike.business_id, bike.id, shot);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const up = await supabase.storage.from('bike-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '60' });
      if (up.error) throw up.error;
      const { data, error } = await supabase.from('bike_photos' as any).upsert({
        bike_id: bike.id, shot_id: shot.id, shot_number: shot.n, status: 'captured',
        skip_reason: null, storage_path: path, width, height, updated_at: new Date().toISOString(),
      }, { onConflict: 'bike_id,shot_id' }).select().single();
      if (error) throw error;
      return data as unknown as BikePhotoRow;
    } catch (e) { lastErr = e; await sleep(800 * (attempt + 1)); }
  }
  throw lastErr;
}

export async function skipShot(bikeId: string, shot: GuideShot, reason: string) {
  const { data, error } = await supabase.from('bike_photos' as any).upsert({
    bike_id: bikeId, shot_id: shot.id, shot_number: shot.n, status: 'skipped',
    skip_reason: reason, storage_path: null, width: null, height: null, updated_at: new Date().toISOString(),
  }, { onConflict: 'bike_id,shot_id' }).select().single();
  if (error) throw error;
  return data as unknown as BikePhotoRow;
}

/** Extra (misc) photos: accessories, chips etc. Numbered 101+ so they sort after the 18 guided shots. */
export const MISC_SECTION = 'misc';
export const isMiscRow = (r: Pick<BikePhotoRow, 'shot_number'>) => r.shot_number > 100;
export function nextMiscShot(rows: Pick<BikePhotoRow, 'shot_number'>[]): GuideShot {
  const n = Math.max(100, ...rows.map((r) => r.shot_number)) + 1;
  return { n, id: `misc-${n}-${Date.now().toString(36)}`, section: MISC_SECTION, title: `Extra ${n - 100}`, side: '', prompt: '', instruction: '', check: '', overlay: '', example: null };
}
export async function deletePhotoRow(row: BikePhotoRow) {
  if (row.storage_path) await supabase.storage.from('bike-photos').remove([row.storage_path]);
  const { error } = await supabase.from('bike_photos' as any).delete().eq('bike_id', row.bike_id).eq('shot_id', row.shot_id);
  if (error) throw error;
}
