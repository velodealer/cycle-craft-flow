import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Save, RefreshCw, Tag } from 'lucide-react';
import {
  DEFAULT_BIKE_REFERENCE_PREFIX,
  buildBikeReference,
} from '@/lib/bikeReference';

const SETTING_KEY = 'bike_reference_prefix';

export default function BikeReferenceSettings() {
  const [prefix, setPrefix] = useState(DEFAULT_BIKE_REFERENCE_PREFIX);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      if (data?.value) setPrefix(String(data.value).replace(/"/g, ''));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length < 2) {
      toast({ title: 'Invalid prefix', description: 'Use 2-6 letters or numbers.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: SETTING_KEY, value: clean as any }, { onConflict: 'key' });
      if (error) throw error;
      setPrefix(clean);
      toast({ title: 'Prefix saved', description: 'New bikes will use this prefix.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const backfill = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase
        .from('bikes')
        .select('id, make, serial_number, reference')
        .is('reference', null);
      if (error) throw error;

      const existing = new Set<string>();
      const { data: refs } = await supabase.from('bikes').select('reference').not('reference', 'is', null);
      (refs || []).forEach((r: any) => r.reference && existing.add(r.reference));

      let count = 0;
      for (const bike of data || []) {
        const base = buildBikeReference(prefix, bike.make, bike.serial_number, bike.id);
        let candidate = base;
        let n = 1;
        while (existing.has(candidate)) {
          n += 1;
          candidate = `${base}-${n}`;
        }
        const { error: upErr } = await supabase.from('bikes').update({ reference: candidate }).eq('id', bike.id);
        if (!upErr) {
          existing.add(candidate);
          count += 1;
        }
      }
      toast({ title: 'Backfill complete', description: `${count} bike${count === 1 ? '' : 's'} updated.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  };

  const sample = buildBikeReference(prefix, 'Specialized', 'WSBC603123484821');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Bike Reference
        </CardTitle>
        <CardDescription>
          Every bike gets a readable reference: prefix, first 3 letters of the brand, last 4 of the serial number.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="ref-prefix">Account prefix</Label>
            <Input
              id="ref-prefix"
              value={prefix}
              disabled={loading}
              maxLength={6}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="BWC"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Example: <span className="font-mono font-semibold text-foreground">{sample}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy || loading}>
            <Save className="h-4 w-4 mr-2" />
            Save prefix
          </Button>
          <Button variant="outline" onClick={backfill} disabled={backfilling}>
            <RefreshCw className={`h-4 w-4 mr-2 ${backfilling ? 'animate-spin' : ''}`} />
            Backfill missing references
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Changing the prefix only affects bikes created afterwards — existing references stay the same.
        </p>
      </CardContent>
    </Card>
  );
}
