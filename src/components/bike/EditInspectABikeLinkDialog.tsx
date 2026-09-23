import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/activity';
import { functionErrorMessage } from '@/services/inspectabike';

const schema = z.object({
  report_url: z.string().trim().max(500).refine((v) => {
    if (!v) return true;
    try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  }, 'Enter a full http(s) link'),
  external_inspection_id: z.string().trim().max(200),
  external_reference: z.string().trim().max(200),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bikeId: string;
  inspection: any;
  onSaved: () => void;
}

export default function EditInspectABikeLinkDialog({ open, onOpenChange, bikeId, inspection, onSaved }: Props) {
  const [form, setForm] = useState({ report_url: '', external_inspection_id: '', external_reference: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        report_url: inspection?.report_url ?? '',
        external_inspection_id: inspection?.external_inspection_id ?? '',
        external_reference: inspection?.external_reference ?? '',
      });
    }
  }, [open, inspection]);

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: 'Check the details', description: parsed.error.issues[0].message, variant: 'destructive' });
      return;
    }
    const v = parsed.data;
    setSaving(true);
    try {
      if (v.external_inspection_id) {
        const { data: dupes } = await supabase
          .from('inspections')
          .select('id, bike_id')
          .eq('external_inspection_id', v.external_inspection_id)
          .neq('bike_id', bikeId)
          .limit(1);
        if (dupes && dupes.length) throw new Error('That InspectABike inspection ID is already linked to another bike.');
      }
      const values = {
        report_url: v.report_url || null,
        external_inspection_id: v.external_inspection_id || null,
        external_reference: v.external_reference || null,
      };
      const before = {
        report_url: inspection?.report_url ?? null,
        external_inspection_id: inspection?.external_inspection_id ?? null,
        external_reference: inspection?.external_reference ?? null,
      };
      if (inspection?.id) {
        const { error } = await supabase.from('inspections').update(values).eq('id', inspection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inspections').insert({ bike_id: bikeId, status: 'in_progress', ...values });
        if (error) throw error;
      }
      logActivity(bikeId, {
        kind: 'inspection',
        action: 'link_edited',
        summary: 'InspectABike link edited',
        detail: { before, after: values },
      });

      if (values.external_inspection_id) {
        const { data, error } = await supabase.functions.invoke('inspectabike-sync', { body: { bike_id: bikeId } });
        if (error || (data as any)?.error) {
          toast({
            title: 'Link saved, refresh failed',
            description: await functionErrorMessage(error, data),
            variant: 'destructive',
          });
        } else if ((data as any)?.warning) {
          toast({ title: 'Link saved', description: (data as any).warning, variant: 'destructive' });
        } else {
          toast({ title: 'Link saved', description: 'Latest results pulled from InspectABike.' });
        }
      } else {
        toast({ title: 'Link saved' });
      }
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit InspectABike link</DialogTitle>
          <DialogDescription>Correct which InspectABike inspection this bike points at. Leave blank to unlink.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="iab-url">Report link</Label>
            <Input id="iab-url" type="url" placeholder="https://inspectabike.com/report/..."
              value={form.report_url} onChange={(e) => setForm({ ...form, report_url: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iab-id">InspectABike inspection ID</Label>
            <Input id="iab-id" value={form.external_inspection_id}
              onChange={(e) => setForm({ ...form, external_inspection_id: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iab-ref">Reference</Label>
            <Input id="iab-ref" value={form.external_reference}
              onChange={(e) => setForm({ ...form, external_reference: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
