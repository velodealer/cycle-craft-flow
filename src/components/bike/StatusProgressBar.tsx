import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Clock, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StatusProgressBarProps {
  currentStatus: string;
  className?: string;
  bikeId?: string;
}

interface Stage {
  key: string;
  label: string;
  isCollection?: boolean;
}

export default function StatusProgressBar({ currentStatus, className, bikeId }: StatusProgressBarProps) {
  const [hasCollection, setHasCollection] = useState(false);
  const [loading, setLoading] = useState(!!bikeId);

  useEffect(() => {
    if (bikeId) {
      loadCollectionStatus();
    }
  }, [bikeId]);

  const loadCollectionStatus = async () => {
    if (!bikeId) return;
    
    const { data, error } = await supabase
      .from('bike_collections')
      .select('id')
      .eq('bike_id', bikeId)
      .maybeSingle();
    
    if (!error && data) {
      setHasCollection(true);
    }
    setLoading(false);
  };

  // Standard workflow stages
  const standardStages: Stage[] = [
    { key: 'intake', label: 'Intake' },
    { key: 'cleaning', label: 'Cleaning' },
    { key: 'inspection', label: 'Inspection' },
    { key: 'pending_approval', label: 'Awaiting Owner Approval' },
    { key: 'repair', label: 'Repair' },
    { key: 'ready', label: 'Ready for Sale' },
    { key: 'listed', label: 'Listed' },
    { key: 'sold', label: 'Sold' }
  ];

  // Collection stages (prepended if collection exists)
  const collectionStages: Stage[] = [
    { key: 'awaiting_collection', label: 'Awaiting Collection', isCollection: true },
    { key: 'in_transit', label: 'Collected', isCollection: true },
    { key: 'pending_intake', label: 'Delivered', isCollection: true }
  ];

  // Build final stages array
  const stages = hasCollection 
    ? [...collectionStages, ...standardStages]
    : standardStages;

  const currentIndex = stages.findIndex(stage => stage.key === currentStatus);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-medium">Status Progress</h3>
        <div className="h-16 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const getStageStatus = (index: number) => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  const getStageIcon = (status: string, isCollection?: boolean) => {
    if (isCollection) {
      switch (status) {
        case 'completed':
          return <CheckCircle className="h-5 w-5 text-green-500" />;
        case 'current':
          return <Truck className="h-5 w-5 text-blue-500" />;
        default:
          return <Truck className="h-5 w-5 text-muted-foreground" />;
      }
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'current':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default' as const;
      case 'current':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-medium">Status Progress</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {stages.map((stage, index) => {
          const status = getStageStatus(index);
          const isCollection = 'isCollection' in stage && stage.isCollection;
          return (
            <div key={stage.key} className="flex flex-col items-center space-y-2">
              {getStageIcon(status, isCollection)}
              <Badge 
                variant={getBadgeVariant(status)} 
                className={`text-xs text-center ${isCollection ? 'border-blue-500/50' : ''}`}
              >
                {stage.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}