import { supabase } from '@/integrations/supabase/client';

const isHeic = (file: File) =>
  /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/** Try the browser's own decoder (Safari / macOS Chrome can read HEIC). */
const nativeToJpeg = async (file: File): Promise<Blob | null> => {
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0);
    bmp.close();
    return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
  } catch {
    return null;
  }
};

/** Browsers and marketplaces can't show HEIC (iPhone) photos, so convert them to JPEG first. */
export const toWebSafeImage = async (file: File): Promise<File> => {
  if (!isHeic(file)) return file;
  let blob = await nativeToJpeg(file);
  if (!blob) {
    const { heicTo } = await import('heic-to');
    blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  }
  return new File([blob], file.name.replace(/\.hei[cf]$/i, '') + '.jpg', { type: 'image/jpeg' });
};

export const uploadPhoto = async (
  original: File,
  bucket: string,
  path: string
): Promise<string | null> => {
  try {
    const file = await toWebSafeImage(original);
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { contentType: file.type || undefined });

    if (error) throw error;

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
};

export const deletePhoto = async (
  bucket: string,
  path: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    return !error;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};