import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Save, Truck } from 'lucide-react';

const SETTING_KEY = 'default_delivery_charge';
const DEFAULT_CHARGE = 75;

export default function DeliverySettings() {
  const [charge, setCharge] = useState(String(DEFAULT_CHARGE));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      const value = Number(data?.value as any);
      if (Number.isFinite(value) && value >= 0) setCharge(String(value));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const value = Number(charge);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: 'Invalid amount', description: 'Enter a delivery charge of zero or more.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: SETTING_KEY, value: value as any }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Delivery charge saved' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" /> Delivery
        </CardTitle>
        <CardDescription>
          The default charge suggested when booking a delivery on a sale. It can be changed per sale,
          or absorbed as a cost on the bike instead of charging the customer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5 sm:max-w-[200px]">
          <Label htmlFor="delivery-default">Default delivery charge (£)</Label>
          <Input
            id="delivery-default"
            type="number"
            step="0.01"
            min="0"
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button onClick={save} disabled={loading || saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
}
