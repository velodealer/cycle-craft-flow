import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Clock } from 'lucide-react';

interface StatusProgressBarProps {
  currentStatus: string;
  className?: string;
}

export default function StatusProgressBar({ currentStatus, className }: StatusProgressBarProps) {
  const stages = [
    { key: 'intake', label: 'Intake' },
    { key: 'cleaning', label: 'Cleaning' },
    { key: 'inspection', label: 'Inspection' },
    { key: 'pending_approval', label: 'Awaiting Owner Approval' },
    { key: 'repair', label: 'Repair' },
    { key: 'ready', label: 'Ready for Sale' },
    { key: 'listed', label: 'Listed' },
    { key: 'sold', label: 'Sold' }
  ];

  const currentIndex = stages.findIndex(stage => stage.key === currentStatus);

  const getStageStatus = (index: number) => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  const getStageIcon = (status: string) => {
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
          return (
            <div key={stage.key} className="flex flex-col items-center space-y-2">
              {getStageIcon(status)}
              <Badge variant={getBadgeVariant(status)} className="text-xs text-center">
                {stage.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}