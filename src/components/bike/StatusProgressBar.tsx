import { useEffect, useState } from 'react';
import { CheckCircle, Circle } from 'lucide-react';
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
  aliases?: string[];
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
    { key: 'awaiting_collection', label: 'Awaiting Collection', isCollection: true, aliases: ['collection_in_progress'] },
    { key: 'collected', label: 'Collected', isCollection: true, aliases: ['in_transit'] },
    { key: 'delivered', label: 'Delivered', isCollection: true, aliases: ['pending_intake'] }
  ];

  // Build final stages array
  const stages = hasCollection 
    ? [...collectionStages, ...standardStages]
    : standardStages;

  const currentIndex = stages.findIndex(
    stage => stage.key === currentStatus || stage.aliases?.includes(currentStatus)
  );


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

  return (
    <div className={`space-y-3 ${className}`}>
      <h3 className="label-text">Stage</h3>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
        {stages.map((stage, index) => {
          const status = getStageStatus(index);
          return (
            <div key={stage.key} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                <span
                  className={`h-px flex-1 ${index === 0 ? 'bg-transparent' : status === 'upcoming' ? 'bg-border' : 'bg-border'}`}
                />
                {status === 'completed' ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : status === 'current' ? (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-border" />
                )}
                <span className={`h-px flex-1 ${index === stages.length - 1 ? 'bg-transparent' : 'bg-border'}`} />
              </div>
              <span
                className={`label-text text-center leading-tight ${
                  status === 'current'
                    ? 'text-primary'
                    : status === 'completed'
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/60'
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}