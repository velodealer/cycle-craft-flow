import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useStorageBays, type StorageBay } from '@/hooks/useStorageBays';
import { Plus, MapPin } from 'lucide-react';

export default function StorageBays() {
  const { bays, loading, reload } = useStorageBays(true);
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [busy, setBusy] = useState(false);

  const [prefix, setPrefix] = useState('');
  const [startNum, setStartNum] = useState('1');
  const [endNum, setEndNum] = useState('20');
  const [batchZone, setBatchZone] = useState('');

  const addBay = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', description: 'Give the bay a name', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('storage_bays').insert({
        name: name.trim(),
        zone: zone.trim() || null,
        sort_order: bays.length,
      });
      if (error) throw error;
      setName('');
      setZone('');
      await reload();
      toast({ title: 'Bay added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const generateBays = async () => {
    const p = prefix.trim().toUpperCase();
    const start = parseInt(startNum, 10);
    const end = parseInt(endNum, 10);

    if (!p || !/^[A-Z]$/.test(p)) {
      toast({ title: 'Invalid prefix', description: 'Enter a single letter (e.g., A, B, M).', variant: 'destructive' });
      return;
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < 1 || start > end) {
      toast({ title: 'Invalid range', description: 'Start and end must be positive numbers and start ≤ end.', variant: 'destructive' });
      return;
    }

    const count = end - start + 1;
    if (count > 100) {
      toast({ title: 'Range too large', description: 'Generate at most 100 bays at once.', variant: 'destructive' });
      return;
    }

    const existingNames = new Set(bays.map((b) => b.name.toUpperCase()));
    const namesToCreate: string[] = [];
    for (let i = start; i <= end; i++) {
      const name = `${p}${i}`;
      if (!existingNames.has(name.toUpperCase())) namesToCreate.push(name);
    }

    if (namesToCreate.length === 0) {
      toast({ title: 'No new bays', description: 'All names in that range already exist.', variant: 'destructive' });
      return;
    }

    const nextSortOrder = bays.length > 0 ? Math.max(...bays.map((b) => b.sort_order)) + 1 : 0;
    const rows = namesToCreate.map((n, idx) => ({
      name: n,
      zone: batchZone.trim() || null,
      sort_order: nextSortOrder + idx,
      is_active: true,
    }));

    setBusy(true);
    try {
      const { error } = await supabase.from('storage_bays').insert(rows);
      if (error) throw error;
      setPrefix('');
      setStartNum('1');
      setEndNum('20');
      setBatchZone('');
      await reload();
      const skipped = count - namesToCreate.length;
      toast({
        title: `${namesToCreate.length} bays created`,
        description: skipped > 0 ? `${skipped} already existed and were skipped` : undefined,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const bayRuns = useMemo(() => {
    const groups = new Map<string, { letter: string; numbers: number[]; zone: string | null; active: number; total: number }>();
    bays.forEach((bay) => {
      const match = bay.name.trim().match(/^([A-Za-z]+)\s*(\d+)$/);
      const letter = match?.[1]?.toUpperCase() || bay.name;
      const number = match ? Number(match[2]) : null;
      const key = `${letter}|${bay.zone || ''}`;
      const group = groups.get(key) || { letter, numbers: [], zone: bay.zone, active: 0, total: 0 };
      if (number !== null) group.numbers.push(number);
      group.total += 1;
      if (bay.is_active) group.active += 1;
      groups.set(key, group);
    });
    return Array.from(groups.values()).sort((a, b) => a.letter.localeCompare(b.letter));
  }, [bays]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Add a storage bay
          </CardTitle>
          <CardDescription>Bays are the locations you can allocate bikes to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bay-name">Bay name</Label>
              <Input
                id="bay-name"
                placeholder="Bay A3"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bay-zone">Zone (optional)</Label>
              <Input
                id="bay-zone"
                placeholder="Mezzanine"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={addBay} disabled={busy} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add bay
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Generate bays
          </CardTitle>
          <CardDescription>Create a whole run of bays at once, e.g. A1 to A20.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="bay-prefix">Letter</Label>
              <Input
                id="bay-prefix"
                placeholder="A"
                value={prefix}
                maxLength={1}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bay-start">From number</Label>
              <Input
                id="bay-start"
                type="number"
                min={1}
                value={startNum}
                onChange={(e) => setStartNum(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bay-end">To number</Label>
              <Input
                id="bay-end"
                type="number"
                min={1}
                value={endNum}
                onChange={(e) => setEndNum(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch-zone">Zone (optional)</Label>
              <Input
                id="batch-zone"
                placeholder="Mezzanine"
                value={batchZone}
                onChange={(e) => setBatchZone(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={generateBays} disabled={busy} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Generate bays
          </Button>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Bay ranges ({bayRuns.length})</CardTitle>
          <CardDescription>{bays.length} individual storage bays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading bays...</p>
          ) : bays.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bays yet — add your first one above.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {bayRuns.map((run) => {
                const min = run.numbers.length ? Math.min(...run.numbers) : null;
                const max = run.numbers.length ? Math.max(...run.numbers) : null;
                return (
                  <div key={`${run.letter}-${run.zone || ''}`} className="grid grid-cols-[80px_1fr_auto] items-center gap-4 p-4">
                    <div><div className="label-text">Bay</div><div className="font-display text-2xl font-bold">{run.letter}</div></div>
                    <div><div className="label-text">Range</div><div className="font-medium">{min !== null ? `${min}–${max}` : run.letter}</div>{run.zone && <div className="text-sm text-muted-foreground">{run.zone}</div>}</div>
                    <div className="text-right text-sm text-muted-foreground">{run.active}/{run.total} active</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
