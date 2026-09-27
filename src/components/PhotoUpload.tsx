import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Star, X, Upload } from 'lucide-react';
import { uploadPhoto, deletePhoto } from '@/utils/photoUpload';

interface PhotoUploadProps {
  bucket: string;
  path: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  uploadLabel?: string;
  emptyLabel?: string;
  allowReorder?: boolean;
}

export default function PhotoUpload({
  bucket,
  path,
  photos,
  onChange,
  maxPhotos = 5,
  uploadLabel = 'Upload photos',
  emptyLabel,
  allowReorder = false,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const uploadId = `photo-upload-${path.replace(/\//g, '-')}`;

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || photos.length >= maxPhotos) return;

    setUploading(true);
    const uploadPromises = Array.from(files).slice(0, maxPhotos - photos.length).map(file =>
      uploadPhoto(file, bucket, path)
    );

    try {
      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter(url => url !== null) as string[];
      onChange([...photos, ...validUrls]);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (photoUrl: string) => {
    const pathParts = photoUrl.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const filePath = `${path}/${fileName}`;
    
    const success = await deletePhoto(bucket, filePath);
    if (success) {
      onChange(photos.filter(url => url !== photoUrl));
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    const next = [...photos];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          disabled={uploading || photos.length >= maxPhotos}
          className="hidden"
          id={uploadId}
        />
        <label htmlFor={uploadId}>
          <Button
            type="button"
            variant="outline"
            disabled={uploading || photos.length >= maxPhotos}
            asChild
          >
            <span className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : uploadLabel}
            </span>
          </Button>
        </label>
        <span className="text-sm text-muted-foreground">
          {photos.length}/{maxPhotos} photos
        </span>
      </div>

      {photos.length === 0 && emptyLabel && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={`${photo}-${index}`} className="group space-y-2">
              <div className="relative">
              <img
                src={photo}
                alt={`Photo ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border"
              />
              {index === 0 && (
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                  <Star className="h-3 w-3" aria-hidden="true" /> Main
                </span>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8"
                onClick={() => handleRemove(photo)}
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
              </div>
              {allowReorder && photos.length > 1 && (
                <div className="flex justify-end gap-1">
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move photo ${index + 1} earlier`}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={index === photos.length - 1} onClick={() => move(index, 1)} aria-label={`Move photo ${index + 1} later`}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}