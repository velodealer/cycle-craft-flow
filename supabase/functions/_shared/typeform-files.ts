// Copies Typeform-hosted response files into our own public storage bucket,
// because Typeform's file URLs require the OAuth token and cannot be shown in a browser.
import { serviceClient } from './typeform.ts';

const BUCKET = 'bike-photos';

function safeName(url: string, index: number) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    const cleaned = last.replace(/[^A-Za-z0-9._-]/g, '_');
    return cleaned || `photo-${index}.jpg`;
  } catch {
    return `photo-${index}.jpg`;
  }
}

/**
 * Downloads each Typeform file with the access token and re-uploads it to the
 * public bike-photos bucket. Returns public URLs; falls back to the original
 * URL for any file that could not be copied.
 */
export async function rehostTypeformFiles(
  supabase: ReturnType<typeof serviceClient>,
  accessToken: string,
  responseId: string,
  urls: string[],
): Promise<string[]> {
  const out: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    if (!url.includes('api.typeform.com')) {
      out.push(url);
      continue;
    }

    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`download failed [${res.status}]`);
      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `typeform/${responseId}/${i}-${safeName(url, i)}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      out.push(data.publicUrl);
      console.log(`typeform-files: copied ${path}`);
    } catch (err) {
      console.error(`typeform-files: could not copy ${url}: ${(err as Error).message}`);
      out.push(url);
    }
  }

  return out;
}
