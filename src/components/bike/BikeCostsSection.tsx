import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, PackageMinus, PackagePlus } from 'lucide-react';
import StripPartDialog from './StripPartDialog';
import AddPartFromInventoryDialog from './AddPartFromInventoryDialog';

interface Props {
  bikeId: string;
  onChange?: () => void;
}

const fmt = (n: number | null | undefined) => (n != null ? `£${Number(n).toFixed(2)}` : '-');

export default function BikeCostsSection({ bikeId, onChange }: Props) {
  const { toast } = useToast();
  const [parts, setParts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [showPart, setShowPart] = useState(false);
  const [showJob, setShowJob] = useState(false);
  const [showAddFromInv, setShowAddFromInv] = useState(false);
  const [stripPart, setStripPart] = useState<any | null>(null);

  const load = useCallback(async () => {
    const [p, j] = await Promise.all([
      supabase.from('parts').select('*').eq('bike_id', bikeId).order('created_at'),
      supabase.from('jobs').select('*').eq('bike_id', bikeId).order('created_at'),
    ]);
    setParts(p.data || []);
    setJobs(j.data || []);
  }, [bikeId]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { await load(); onChange?.(); };

  const removePart = async (id: string) => {
    const { error } = await supabase.from('parts').delete().eq('id', id);
    if (error) return toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
    await refresh();
  };

  const removeJob = async (id: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) return toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
    await refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts & Labour</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h4 className="text-sm font-semibold">Parts</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddFromInv(true)}><PackagePlus className="h-4 w-4 mr-1" />Add from inventory</Button>
              <Button size="sm" variant="outline" onClick={() => setShowPart(true)}><Plus className="h-4 w-4 mr-1" />Add part</Button>
            </div>
          </div>
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No parts added.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead>Line total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.description}{p.brand && <span className="text-xs text-muted-foreground ml-1">({p.brand})</span>}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell>{fmt(p.cost_price)}</TableCell>
                      <TableCell>{fmt(Number(p.cost_price ?? 0) * Number(p.quantity ?? 1))}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" title="Strip to inventory" onClick={() => setStripPart(p)}><PackageMinus className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => removePart(p.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Labour</h4>
            <Button size="sm" variant="outline" onClick={() => setShowJob(true)}><Plus className="h-4 w-4 mr-1" />Add labour</Button>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labour recorded.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell>{j.title}</TableCell>
                      <TableCell className="capitalize">{j.type}</TableCell>
                      <TableCell className="capitalize">{(j.status || '').replace(/_/g, ' ')}</TableCell>
                      <TableCell>{fmt(j.actual_cost ?? j.estimated_cost)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => removeJob(j.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      <AddPartDialog open={showPart} onOpenChange={setShowPart} bikeId={bikeId} onSaved={refresh} />
      <AddJobDialog open={showJob} onOpenChange={setShowJob} bikeId={bikeId} onSaved={refresh} />
      <AddPartFromInventoryDialog open={showAddFromInv} onOpenChange={setShowAddFromInv} bikeId={bikeId} onSaved={refresh} />
      <StripPartDialog open={!!stripPart} onOpenChange={(v) => !v && setStripPart(null)} part={stripPart} bikeId={bikeId} onSaved={refresh} />
    </Card>
  );
}

function AddPartDialog({ open, onOpenChange, bikeId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; bikeId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [type, setType] = useState<string>('new_fitted');
  const [saving, setSaving] = useState(false);

  const reset = () => { setDescription(''); setBrand(''); setQuantity(1); setCostPrice(''); setType('new_fitted'); };

  const save = async () => {
    if (!description.trim()) return toast({ title: 'Description required', variant: 'destructive' });
    setSaving(true);
    const { error } = await supabase.from('parts').insert({
      bike_id: bikeId,
      description: description.trim(),
      brand: brand.trim() || null,
      quantity,
      cost_price: costPrice === '' ? null : Number(costPrice),
      type: type as any,
      stock_status: 'sold' as any,
    } as any);
    setSaving(false);
    if (error) return toast({ title: 'Failed to add part', description: error.message, variant: 'destructive' });
    toast({ title: 'Part added' });
    reset();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add part</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Shimano 105 chain" /></div>
          <div><Label>Brand (optional)</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantity</Label><Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} /></div>
            <div><Label>Unit cost (£)</Label><Input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} /></div>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new_fitted">New (fitted)</SelectItem>
                <SelectItem value="new_resale">New (resale)</SelectItem>
                <SelectItem value="secondhand_bought">Secondhand (bought)</SelectItem>
                <SelectItem value="secondhand_stripped">Secondhand (stripped)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add part'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddJobDialog({ open, onOpenChange, bikeId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; bikeId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'workshop' | 'detailing'>('workshop');
  const [description, setDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number | ''>('');
  const [actualCost, setActualCost] = useState<number | ''>('');
  const [status, setStatus] = useState('pending');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setType('workshop'); setDescription(''); setEstimatedCost(''); setActualCost(''); setStatus('pending'); };

  const save = async () => {
    if (!title.trim()) return toast({ title: 'Title required', variant: 'destructive' });
    setSaving(true);
    const { error } = await supabase.from('jobs').insert({
      bike_id: bikeId,
      title: title.trim(),
      type: type as any,
      description: description.trim() || null,
      estimated_cost: estimatedCost === '' ? null : Number(estimatedCost),
      actual_cost: actualCost === '' ? null : Number(actualCost),
      status,
    } as any);
    setSaving(false);
    if (error) return toast({ title: 'Failed to add labour', description: error.message, variant: 'destructive' });
    toast({ title: 'Labour added' });
    reset();
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add labour</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Brake bleed & service" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="detailing">Detailing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description (optional)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Estimated cost (£)</Label><Input type="number" step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value === '' ? '' : parseFloat(e.target.value))} /></div>
            <div><Label>Actual cost (£)</Label><Input type="number" step="0.01" value={actualCost} onChange={(e) => setActualCost(e.target.value === '' ? '' : parseFloat(e.target.value))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add labour'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
