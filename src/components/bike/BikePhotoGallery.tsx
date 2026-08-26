import { useState } from 'react';
import { Bike as BikeIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BikePhotoGalleryProps {
  photos?: string[] | null;
  alt: string;
}

/** Main photo with a thumbnail strip; falls back to an icon when no photos exist. */
export default function BikePhotoGallery({ photos, alt }: BikePhotoGalleryProps) {
  const [active, setActive] = useState(0);
  const list = photos ?? [];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center aspect-[4/3]">
          {list.length > 0 ? (
            <img
              src={list[Math.min(active, list.length - 1)]}
              alt={alt}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <BikeIcon className="h-8 w-8" aria-hidden="true" />
              <span className="text-sm">No photos yet</span>
            </div>
          )}
        </div>

        {list.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {list.map((photo, index) => (
              <button
                key={`${photo}-${index}`}
                type="button"
                onClick={() => setActive(index)}
                className={cn(
                  'h-16 w-16 shrink-0 overflow-hidden rounded-md border',
                  index === active ? 'ring-2 ring-primary' : 'opacity-80',
                )}
                aria-label={`Show photo ${index + 1}`}
              >
                <img
                  src={photo}
                  alt={`${alt} ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
