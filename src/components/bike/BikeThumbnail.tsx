import { Bike as BikeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BikeThumbnailProps {
  photos?: string[] | null;
  listingPhotos?: string[] | null;
  alt: string;
  className?: string;
}

/** Shows the main listing image if set, else the first intake photo, else an icon. */
export default function BikeThumbnail({ photos, listingPhotos, alt, className }: BikeThumbnailProps) {
  const src = listingPhotos?.[0] || photos?.[0] || null;

  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center',
        className ?? 'h-16 w-16',
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <BikeIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  );
}
