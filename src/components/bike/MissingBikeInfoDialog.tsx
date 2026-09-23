import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity';

export interface FieldIssue { field: string; message: string }

const LABELS: Record<string, string> = {
  make: 'Make', model: 'Model', frame_number: 'Frame number', year: 'Year',
};

function validate(field: string, value: string): string | null {
  const v = value.trim();
  if (field === 'year') {
    if (!v) return null;
    const n = Number(v);
    if (!/^\d{4}$/.test(v) || n < 1900 || n > new Date().getFullYear() + 1) return 'Enter a 4-digit year';
    return null;
  }
  if (!v) return `${LABELS[field] ?? field} is required`;
  if (v.length > 100) return 'Must be 100 characters or fewer';
  return null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bikeId: string;
  businessId?: string | null;
  issues: FieldIssue[];
  onSaved: () => void | Promise<void>;
}

export default function MissingBikeInfoDialog({ open, onOpenChange, bikeId, businessId, issues, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    (async () => {
      const cols = issues.map((i) => i.field).filter((f) => f in LABELS);
      if (!cols.length) return;
      const { data } = await supabase.from('bikes').select(cols.join(',')).eq('id', bikeId).maybeSingle();
      const init: Record<string, string> = {};
      cols.forEach((c) => { init[c] = (data as any)?.[c] != null ? String((data as any)[c]) : ''; });
      setValues(init);
    })();
  }, [open, bikeId, issues]);

  const save = async () => {
    const errs: Record<string, string> = {};
    issues.forEach((i) => { const e = validate(i.field, values[i.field] ?? ''); if (e) errs[i.field] = e; });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const update: Record<string, any> = {};
    issues.forEach((i) => {
      const v = (values[i.field] ?? '').trim();
      update[i.field] = i.field === 'year' ? (v ? Number(v) : null) : v;
    });
    const { error } = await supabase.from('bikes').update(update).eq('id', bikeId);
    if (error) { setErrors({ _: error.message }); setSaving(false); return; }
    logActivity(bikeId, { kind: 'details', action: 'updated', summary: `Details completed for inspection: ${Object.keys(update).map((k) => LABELS[k] ?? k).join(', ')}`, detail: update } as any);
    setSaving(false);
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A few details are needed</DialogTitle>
          <DialogDescription>InspectABike needs these before the inspection can start. They'll be saved on the bike.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {issues.map((i) => (
            <div key={i.field} className="space-y-1">
              <Label htmlFor={`mbi-${i.field}`}>{LABELS[i.field] ?? i.field}</Label>
              <Input
                id={`mbi-${i.field}`}
                inputMode={i.field === 'year' ? 'numeric' : undefined}
                maxLength={i.field === 'year' ? 4 : 100}
                value={values[i.field] ?? ''}
                onChange={(e) => setValues((p) => ({ ...p, [i.field]: e.target.value }))}
                aria-invalid={!!errors[i.field]}
              />
              <p className={`text-sm ${errors[i.field] ? 'text-destructive' : 'text-muted-foreground'}`}>{errors[i.field] || i.message}</p>
            </div>
          ))}
          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & start'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
