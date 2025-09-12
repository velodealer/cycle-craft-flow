import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, MessageSquare, Image } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FulfilmentEvent {
  id: string;
  stage: string;
  timestamp: string;
  notes: string | null;
  performed_by: string;
  profiles?: {
    name: string;
  };
}

interface FulfilmentTimelineProps {
  bikeId: string;
}

export default function FulfilmentTimeline({ bikeId }: FulfilmentTimelineProps) {
  const [events, setEvents] = useState<FulfilmentEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('fulfilment_events')
        .select(`
          id,
          stage,
          timestamp,
          notes,
          performed_by,
          profiles:performed_by(name)
        `)
        .eq('bike_id', bikeId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      toast({
        title: 'Error loading timeline',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [bikeId]);

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      'intake': 'Intake',
      'cleaning': 'Cleaning',
      'inspection': 'Inspection',
      'pending_approval': 'Awaiting Owner Approval',
      'repair': 'Repair',
      'ready': 'Ready for Sale',
      'listed': 'Listed',
      'sold': 'Sold'
    };
    return labels[stage] || stage;
  };

  const getStageBadgeVariant = (stage: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'intake': 'outline',
      'cleaning': 'secondary',
      'inspection': 'secondary',
      'pending_approval': 'destructive',
      'repair': 'destructive',
      'ready': 'default',
      'listed': 'default',
      'sold': 'secondary'
    };
    return variants[stage] || 'outline';
  };

  if (loading) {
    return <div className="text-center py-4">Loading timeline...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fulfilment Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No fulfilment events recorded yet
          </p>
        ) : (
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={event.id} className="relative">
                {index < events.length - 1 && (
                  <div className="absolute left-4 top-8 w-0.5 h-16 bg-border"></div>
                )}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getStageBadgeVariant(event.stage)}>
                        {getStageLabel(event.stage)}
                      </Badge>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <User className="h-3 w-3 mr-1" />
                        {event.profiles?.name || 'Unknown'}
                      </div>
                    </div>
                    {event.notes && (
                      <div className="flex items-start text-sm bg-muted p-3 rounded-lg">
                        <MessageSquare className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <p>{event.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}