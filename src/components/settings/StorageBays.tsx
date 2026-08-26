import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useStorageBays, type StorageBay } from '@/hooks/useStorageBays';
import { Plus, Trash2, Save, MapPin } from 'lucide-react';

export default function StorageBays() {
  const { bays, loading, reload } = useStorageBays(true);
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Partial<StorageBay>>>({});

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

  const saveBay = async (bay: StorageBay) => {
    const draft = drafts[bay.id];
    if (!draft) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('storage_bays')
        .update({
          name: (draft.name ?? bay.name).trim(),
          zone: (draft.zone ?? bay.zone)?.toString().trim() || null,
        })
        .eq('id', bay.id);
      if (error) throw error;
      setDrafts((d) => {
        const next = { ...d };
        delete next[bay.id];
        return next;
      });
      await reload();
      toast({ title: 'Bay updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (bay: StorageBay, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('storage_bays')
        .update({ is_active: isActive })
        .eq('id', bay.id);
      if (error) throw error;
      await reload();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteBay = async (bay: StorageBay) => {
    if (!confirm(`Delete "${bay.name}"? Bikes in this bay become unassigned.`)) return;
    try {
      const { error } = await supabase.from('storage_bays').delete().eq('id', bay.id);
      if (error) throw error;
      await reload();
      toast({ title: 'Bay deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

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
          <CardTitle>Bays ({bays.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading bays...</p>
          ) : bays.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bays yet — add your first one above.
            </p>
          ) : (
            bays.map((bay) => {
              const draft = drafts[bay.id];
              const dirty = !!draft;
              return (
                <div key={bay.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={bay.is_active ? 'default' : 'outline'}>
                      {bay.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={bay.is_active}
                        onCheckedChange={(checked) => toggleActive(bay, checked)}
                        aria-label="Bay active"
                      />
                      <Button variant="ghost" size="sm" onClick={() => deleteBay(bay)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={draft?.name ?? bay.name}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [bay.id]: { ...d[bay.id], name: e.target.value } }))
                      }
                    />
                    <Input
                      placeholder="Zone"
                      value={(draft?.zone ?? bay.zone) || ''}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [bay.id]: { ...d[bay.id], zone: e.target.value } }))
                      }
                    />
                  </div>
                  {dirty && (
                    <Button size="sm" onClick={() => saveBay(bay)} disabled={busy}>
                      <Save className="h-4 w-4 mr-2" />
                      Save changes
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
