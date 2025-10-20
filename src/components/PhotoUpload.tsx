import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Upload } from 'lucide-react';
import { uploadPhoto, deletePhoto } from '@/utils/photoUpload';

interface PhotoUploadProps {
  bucket: string;
  path: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export default function PhotoUpload({
  bucket,
  path,
  photos,
  onChange,
  maxPhotos = 5
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
              {uploading ? 'Uploading...' : 'Upload Photos'}
            </span>
          </Button>
        </label>
        <span className="text-sm text-muted-foreground">
          {photos.length}/{maxPhotos} photos
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div key={index} className="relative group">
              <img
                src={photo}
                alt={`Photo ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(photo)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}