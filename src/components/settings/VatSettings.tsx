import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Receipt } from 'lucide-react';
import { useVatRegistered, VAT_REGISTERED_KEY } from '@/hooks/useVatRegistered';

export default function VatSettings({ compact = false }: { compact?: boolean }) {
  const { vatRegistered, loading, setVatRegistered } = useVatRegistered();
  const [saving, setSaving] = useState(false);

  const save = async (next: boolean) => {
    setSaving(true);
    const previous = vatRegistered;
    setVatRegistered(next);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: VAT_REGISTERED_KEY, value: next as never }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      setVatRegistered(previous);
      toast.error(`Could not save: ${error.message}`);
      return;
    }
    toast.success(next ? 'VAT registered — VAT figures are shown' : 'Not VAT registered — VAT is hidden everywhere');
  };

  const control = (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="vat-registered">This business is VAT registered</Label>
        <p className="text-xs text-muted-foreground">
          Turn this off if you are not VAT registered. VAT fields, VAT scheme choices and VAT figures are then
          hidden across sales, invoices, quotes, bikes, reports and anything sent to your accounts.
        </p>
      </div>
      <Switch
        id="vat-registered"
        checked={vatRegistered}
        disabled={loading || saving}
        onCheckedChange={save}
      />
    </div>
  );

  if (compact) return control;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" /> VAT
        </CardTitle>
        <CardDescription>Controls whether VAT appears anywhere in the system.</CardDescription>
      </CardHeader>
      <CardContent>{control}</CardContent>
    </Card>
  );
}
