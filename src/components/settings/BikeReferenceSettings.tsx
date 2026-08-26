import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Save, RefreshCw, Tag, Repeat } from 'lucide-react';
import {
  DEFAULT_BIKE_REFERENCE_PREFIX,
  buildBikeReference,
} from '@/lib/bikeReference';

const SETTING_KEY = 'bike_reference_prefix';
const PAGE = 1000;

export default function BikeReferenceSettings() {
  const [prefix, setPrefix] = useState(DEFAULT_BIKE_REFERENCE_PREFIX);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  const cleanPrefix = () => prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const savePrefix = async (clean: string) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: SETTING_KEY, value: clean as any }, { onConflict: 'key' });
    if (error) throw error;
    setPrefix(clean);
  };

  const save = async () => {
    const clean = cleanPrefix();
    if (clean.length < 2) {
      toast({ title: 'Invalid prefix', description: 'Use 2-6 letters or numbers.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await savePrefix(clean);
      toast({ title: 'Prefix saved', description: 'New bikes will use this prefix.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const fetchAllBikes = async (onlyMissing: boolean) => {
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('bikes')
        .select('id, make, frame_number, reference')
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (onlyMissing) q = q.is('reference', null);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return rows;
  };

  const applyReferences = async (bikes: any[], clean: string, existing: Set<string>) => {
    let count = 0;
    for (const bike of bikes) {
      const base = buildBikeReference(clean, bike.make, bike.frame_number, bike.id);
      let candidate = base;
      let n = 1;
      while (existing.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      if (candidate === bike.reference) {
        existing.add(candidate);
        continue;
      }
      const { error: upErr } = await supabase.from('bikes').update({ reference: candidate }).eq('id', bike.id);
      if (!upErr) {
        existing.add(candidate);
        count += 1;
      }
    }
    return count;
  };

  const backfill = async () => {
    setBackfilling(true);
    try {
      const clean = cleanPrefix();
      const missing = await fetchAllBikes(true);
      const existing = new Set<string>();
      const { data: refs } = await supabase.from('bikes').select('reference').not('reference', 'is', null);
      (refs || []).forEach((r: any) => r.reference && existing.add(r.reference));
      const count = await applyReferences(missing, clean, existing);
      toast({ title: 'Backfill complete', description: `${count} bike${count === 1 ? '' : 's'} updated.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  };

  const regenerateAll = async () => {
    const clean = cleanPrefix();
    if (clean.length < 2) {
      toast({ title: 'Invalid prefix', description: 'Use 2-6 letters or numbers.', variant: 'destructive' });
      return;
    }
    setRegenerating(true);
    try {
      await savePrefix(clean);
      const bikes = await fetchAllBikes(false);
      // Pass 1: park every bike on a temporary unique reference so final values
      // can't collide with references still held by not-yet-updated bikes.
      for (const bike of bikes) {
        await supabase
          .from('bikes')
          .update({ reference: `TMP-${bike.id}` })
          .eq('id', bike.id);
      }
      // Pass 2: assign the freshly built references.
      const existing = new Set<string>();
      const count = await applyReferences(
        bikes.map((b) => ({ ...b, reference: null })),
        clean,
        existing,
      );

      toast({
        title: 'References re-generated',
        description: `${count} bike${count === 1 ? '' : 's'} updated to the ${clean} prefix.`,
      });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setRegenerating(false);
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
          Every bike gets a readable reference: prefix, first 3 letters of the brand, last 4 of the frame number.
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
          <Button onClick={save} disabled={busy || loading || regenerating}>
            <Save className="h-4 w-4 mr-2" />
            Save prefix
          </Button>
          <Button variant="outline" onClick={backfill} disabled={backfilling || regenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${backfilling ? 'animate-spin' : ''}`} />
            Backfill missing references
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={regenerating || backfilling || loading}>
                <Repeat className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                Re-generate all references
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Re-generate every bike reference?</AlertDialogTitle>
                <AlertDialogDescription>
                  This rebuilds the reference for every bike using the current prefix, brand and frame number.
                  Labels and QR codes printed before now will no longer match the ID shown on screen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={regenerateAll}>Re-generate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-xs text-muted-foreground">
          Changing the prefix only affects bikes created afterwards. Use “Re-generate all references” to apply
          the new prefix to existing bikes.
        </p>
      </CardContent>
    </Card>
  );
}
