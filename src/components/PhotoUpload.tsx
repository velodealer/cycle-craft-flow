import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Star, X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  dropzone?: boolean;
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
  dropzone = false,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const uploadId = `photo-upload-${path.replace(/\//g, '-')}`;

  const uploadFiles = async (list: File[]) => {
    const images = list.filter((f) => f.type.startsWith('image/'));
    if (!images.length || photos.length >= maxPhotos) return;
    const room = maxPhotos - photos.length;
    if (images.length > room) toast.info(`Only ${room} more photo${room === 1 ? '' : 's'} allowed — extra files skipped`);
    setUploading(true);
    try {
      const urls = await Promise.all(images.slice(0, room).map((file) => uploadPhoto(file, bucket, path)));
      const validUrls = urls.filter((url) => url !== null) as string[];
      if (validUrls.length < Math.min(images.length, room)) toast.error('Some photos failed to upload');
      onChange([...photos, ...validUrls]);
    } catch (error) {
      console.error('Failed to upload photos:', error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    await uploadFiles(Array.from(files));
    event.target.value = '';
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

  const full = photos.length >= maxPhotos;

  return (
    <div className="space-y-4">
      <Input
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        disabled={uploading || full}
        className="hidden"
        id={uploadId}
      />
      {dropzone ? (
        <label
          htmlFor={uploadId}
          onDragOver={(e) => { e.preventDefault(); if (!full) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!uploading) void uploadFiles(Array.from(e.dataTransfer.files)); }}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${full || uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary'} ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
          <span className="font-medium">{uploading ? 'Uploading…' : full ? 'Photo limit reached' : 'Drag photos here or click to upload'}</span>
          <span className="text-xs text-muted-foreground">{photos.length}/{maxPhotos} photos</span>
        </label>
      ) : (
      <div className="flex items-center gap-2">
        <label htmlFor={uploadId}>
          <Button
            type="button"
            variant="outline"
            disabled={uploading || full}
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
      )}

      {photos.length === 0 && emptyLabel && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div
              key={`${photo}-${index}`}
              className={`group space-y-2 ${dragIndex === index ? 'opacity-40' : ''}`}
              draggable={allowReorder && photos.length > 1}
              onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-photo-index', String(index)); }}
              onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
              onDragOver={(e) => { if (dragIndex === null) return; e.preventDefault(); e.stopPropagation(); setDropIndex(index); }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault(); e.stopPropagation();
                if (dragIndex !== index) {
                  const next = [...photos];
                  const [moved] = next.splice(dragIndex, 1);
                  next.splice(index, 0, moved);
                  onChange(next);
                }
                setDragIndex(null); setDropIndex(null);
              }}
            >
              <div className={`relative rounded-lg ${allowReorder && photos.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''} ${dropIndex === index && dragIndex !== index ? 'ring-2 ring-primary' : ''}`}>
              <img
                src={photo}
                alt={`Photo ${index + 1}`}
                draggable={false}
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