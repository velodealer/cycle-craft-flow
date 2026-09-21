import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionRow } from '@/hooks/useAdminData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  businessName: string;
  subscription?: SubscriptionRow | null;
}

const emptyForm = {
  plan_name: 'Starter',
  price: '0',
  currency: 'GBP',
  billing_period: 'monthly',
  seats: '1',
  status: 'trialling',
  trial_ends_at: '',
  current_period_end: '',
  notes: '',
};

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

export default function SubscriptionDialog({ open, onOpenChange, businessId, businessName, subscription }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm(
      subscription
        ? {
            plan_name: subscription.plan_name,
            price: String(subscription.price ?? 0),
            currency: subscription.currency,
            billing_period: subscription.billing_period,
            seats: String(subscription.seats ?? 1),
            status: subscription.status,
            trial_ends_at: toDateInput(subscription.trial_ends_at),
            current_period_end: toDateInput(subscription.current_period_end),
            notes: subscription.notes ?? '',
          }
        : emptyForm,
    );
  }, [open, subscription]);

  const set = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    const payload = {
      business_id: businessId,
      plan_name: form.plan_name.trim() || 'Starter',
      price: Number(form.price) || 0,
      currency: form.currency,
      billing_period: form.billing_period,
      seats: Number(form.seats) || 1,
      status: form.status,
      trial_ends_at: form.trial_ends_at ? new Date(form.trial_ends_at).toISOString() : null,
      current_period_end: form.current_period_end ? new Date(form.current_period_end).toISOString() : null,
      notes: form.notes.trim() || null,
    };
    const { error } = await (supabase as any)
      .from('business_subscriptions')
      .upsert(payload, { onConflict: 'business_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save the subscription', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Subscription saved for ${businessName}` });
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Subscription — {businessName}</DialogTitle>
          <DialogDescription>Kept by hand. No card is charged from here.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="plan">Plan</Label>
            <Input id="plan" value={form.plan_name} onChange={(e) => set('plan_name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trialling">Trialling</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="past_due">Past due</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="price">Price</Label>
            <Input id="price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period">Billing period</Label>
            <Select value={form.billing_period} onValueChange={(v) => set('billing_period', v)}>
              <SelectTrigger id="period"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="seats">Seats</Label>
            <Input id="seats" type="number" min="1" value={form.seats} onChange={(e) => set('seats', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="currency">Currency</Label>
            <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
              <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="trial">Trial ends</Label>
            <Input id="trial" type="date" value={form.trial_ends_at} onChange={(e) => set('trial_ends_at', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="renewal">Renews on</Label>
            <Input id="renewal" type="date" value={form.current_period_end} onChange={(e) => set('current_period_end', e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
