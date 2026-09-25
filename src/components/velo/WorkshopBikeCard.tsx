import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StageFlap } from '@/components/velo/StageFlap';
import { bikeRef } from '@/lib/bikeReference';

export interface WorkshopBike {
  id: string;
  reference: string | null;
  make: string;
  model: string;
  year?: number | null;
  size?: string | null;
  colour?: string | null;
  status?: string | null;
  photos?: string[] | null;
  storage_bay_id?: string | null;
}

interface WorkshopBikeCardProps {
  bike: WorkshopBike;
  location?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}

export default function WorkshopBikeCard({
  bike,
  location,
  badges,
  actions,
  summary,
  children,
}: WorkshopBikeCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <BikeThumbnail photos={bike.photos} alt={`${bike.make} ${bike.model}`} />
          <div className="min-w-0 flex-1">
            <Link to={`/bikes/${bike.id}`} className="break-words font-semibold hover:underline">
              {bike.make} {bike.model} {bike.year || ''}
            </Link>
            <p className="id-text text-xs text-muted-foreground">{bikeRef(bike)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {bike.status && <StageFlap stage={bike.status} size="sm" />}
              {bike.size && <Badge variant="outline">{bike.size}</Badge>}
              {bike.colour && <Badge variant="outline">{bike.colour}</Badge>}
              {badges}
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" aria-hidden />
              {location || 'No location'}
            </p>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {summary}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}