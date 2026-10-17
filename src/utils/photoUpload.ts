import { supabase } from '@/integrations/supabase/client';

const isHeic = (file: File) =>
  /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/** Browsers and marketplaces can't show HEIC (iPhone) photos, so convert them to JPEG first. */
export const toWebSafeImage = async (file: File): Promise<File> => {
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  const blob = Array.isArray(out) ? out[0] : out;
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