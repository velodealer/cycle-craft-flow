import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, RefreshCw, MapPin, Phone, Mail, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CollectionStatusProps {
  bikeId: string;
  /** 'inbound' = collection from the seller, 'outbound' = delivery to the buyer. */
  direction?: 'inbound' | 'outbound';
  onUpdate?: () => void;
}

export function CollectionStatus({ bikeId, direction = 'inbound', onUpdate }: CollectionStatusProps) {
  const [collection, setCollection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const isOutbound = direction === 'outbound';

  useEffect(() => {
    loadCollection();
  }, [bikeId, direction]);

  const loadCollection = async () => {
    const { data, error } = await supabase
      .from('bike_collections')
      .select('*')
      .eq('bike_id', bikeId)
      .eq('direction', direction)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      setCollection(data ?? null);
    }
    setLoading(false);
  };


  const handleRetry = async () => {
    if (!collection) return;

    setRetrying(true);
    try {
      const { error } = isOutbound
        ? await supabase.functions.invoke('create-delivery-order', {
            body: {
              bike_id: bikeId,
              receiver_name: collection.receiver_name,
              receiver_email: collection.receiver_email,
              receiver_phone: collection.receiver_phone,
              receiver_street: collection.receiver_street,
              receiver_city: collection.receiver_city,
              receiver_postcode: collection.receiver_postcode,
              receiver_country: collection.receiver_country,
              delivery_instructions: collection.delivery_instructions,
            },
          })
        : await supabase.functions.invoke('create-collection-order', {
            body: {
              bike_id: bikeId,
              sender_name: collection.sender_name,
              sender_email: collection.sender_email,
              sender_phone: collection.sender_phone,
              address_street: collection.address_street,
              address_city: collection.address_city,
              address_postcode: collection.address_postcode,
              delivery_instructions: collection.delivery_instructions,
            },
          });

      if (error) throw error;

      toast({ title: isOutbound ? 'Delivery rebooked successfully' : 'Collection rescheduled successfully' });
      loadCollection();
      onUpdate?.();
    } catch (error: any) {
      toast({ 
        title: 'Failed to retry',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setRetrying(false);
    }
  };


  if (loading) return null;
  if (!collection) return null;

  const getStatusBadge = () => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      scheduled: { variant: 'default', label: 'Scheduled' },
      driver_to_collection: { variant: 'default', label: 'Driver En Route' },
      collected: { variant: 'default', label: 'Collected' },
      driver_to_delivery: { variant: 'default', label: 'In Transit' },
      in_transit: { variant: 'default', label: 'In Transit' },
      delivered: { variant: 'default', label: 'Delivered' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      failed: { variant: 'destructive', label: 'Failed' }
    };
    
    const status = statusMap[collection.status] || { variant: 'secondary', label: collection.status };
    
    return (
      <Badge variant={status.variant}>
        {status.label}
      </Badge>
    );
  };

  const canRetry = collection.status === 'failed' || collection.error_message;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Collection Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          {getStatusBadge()}
          {canRetry && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRetry}
              disabled={retrying}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          )}
        </div>

        {collection.tracking_number && (
          <div>
            <p className="text-sm text-muted-foreground">Tracking Number</p>
            <p className="font-mono text-sm">{collection.tracking_number}</p>
          </div>
        )}

        {collection.scheduled_date && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Scheduled for</p>
              <p className="text-sm">{new Date(collection.scheduled_date).toLocaleDateString()}</p>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">Pickup Details</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p>{collection.sender_name}</p>
                <p>{collection.address_street}</p>
                <p>{collection.address_city}, {collection.address_postcode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <p>{collection.sender_phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <p>{collection.sender_email}</p>
            </div>
          </div>
        </div>

        {collection.delivery_instructions && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium">Instructions</p>
            <p className="text-sm text-muted-foreground">{collection.delivery_instructions}</p>
          </div>
        )}

        {collection.error_message && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm font-medium text-destructive mb-1">Error</p>
            <p className="text-sm text-destructive">{collection.error_message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
