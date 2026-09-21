import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import {
  saveEbayPolicy, deleteEbayPolicy, getEbayShippingServices,
  type AnyPolicy, type FulfillmentPolicy, type PaymentPolicy, type PolicyKind,
  type ReturnsPolicy, type ShippingService,
} from '@/services/ebay';

const HANDLING = [
  { value: '0', label: 'Same working day' },
  { value: '1', label: '1 working day' },
  { value: '2', label: '2 working days' },
  { value: '3', label: '3 working days' },
  { value: '5', label: '5 working days' },
];

const TITLES: Record<PolicyKind, string> = {
  fulfillment: 'postage policy',
  payment: 'payment policy',
  returns: 'returns policy',
};

interface Props {
  kind: PolicyKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing policy to edit, or null to create a new one. */
  policy: AnyPolicy | null;
  onSaved: (policy: AnyPolicy) => void;
  onDeleted: (policyId: string) => void;
}

type FormState = {
  name: string;
  description: string;
  handling_time_days: string;
  shipping_service_code: string;
  free_shipping: boolean;
  shipping_cost: string;
  local_pickup: boolean;
  immediate_pay: boolean;
  returns_accepted: boolean;
  return_period_days: string;
  return_shipping_cost_payer: 'BUYER' | 'SELLER';
  refund_method: 'MONEY_BACK' | 'MONEY_BACK_OR_REPLACEMENT';
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  handling_time_days: '1',
  shipping_service_code: '',
  free_shipping: true,
  shipping_cost: '0',
  local_pickup: false,
  immediate_pay: true,
  returns_accepted: true,
  return_period_days: '30',
  return_shipping_cost_payer: 'BUYER',
  refund_method: 'MONEY_BACK',
});

export default function EbayPolicyDialog({ kind, open, onOpenChange, policy, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [services, setServices] = useState<ShippingService[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setError(null);
    const base = emptyForm();
    if (policy) {
      base.name = policy.name;
      base.description = policy.description ?? '';
      const f = policy as FulfillmentPolicy;
      if (kind === 'fulfillment') {
        base.handling_time_days = String(f.handling_time_days ?? 1);
        base.shipping_service_code = f.shipping_service_code ?? '';
        base.free_shipping = Boolean(f.free_shipping);
        base.shipping_cost = String(f.shipping_cost ?? 0);
        base.local_pickup = Boolean(f.local_pickup);
      }
      if (kind === 'payment') base.immediate_pay = Boolean((policy as PaymentPolicy).immediate_pay);
      if (kind === 'returns') {
        const r = policy as ReturnsPolicy;
        base.returns_accepted = Boolean(r.returns_accepted);
        base.return_period_days = String(r.return_period_days ?? 30);
        base.return_shipping_cost_payer = r.return_shipping_cost_payer ?? 'BUYER';
        base.refund_method = r.refund_method ?? 'MONEY_BACK';
      }
    }
    setForm(base);
  }, [open, policy, kind]);

  useEffect(() => {
    if (!open || kind !== 'fulfillment' || services.length) return;
    getEbayShippingServices()
      .then(({ services: list }) => {
        setServices(list);
        setForm((f) => ({ ...f, shipping_service_code: f.shipping_service_code || list[0]?.code || '' }));
      })
      .catch((e) => setError((e as Error).message));
  }, [open, kind, services.length]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const values: Record<string, unknown> = { name: form.name, description: form.description };
      if (kind === 'fulfillment') {
        Object.assign(values, {
          handling_time_days: Number(form.handling_time_days),
          shipping_service_code: form.shipping_service_code,
          free_shipping: form.free_shipping,
          shipping_cost: Number(form.shipping_cost || 0),
          local_pickup: form.local_pickup,
        });
      }
      if (kind === 'payment') values.immediate_pay = form.immediate_pay;
      if (kind === 'returns') {
        Object.assign(values, {
          returns_accepted: form.returns_accepted,
          return_period_days: Number(form.return_period_days),
          return_shipping_cost_payer: form.return_shipping_cost_payer,
          refund_method: form.refund_method,
        });
      }
      const { policy: saved } = await saveEbayPolicy(kind, values, policy?.id ?? null);
      onSaved(saved);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!policy?.id) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEbayPolicy(kind, policy.id);
      onDeleted(policy.id);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{policy ? 'Edit' : 'New'} {TITLES[kind]}</DialogTitle>
          <DialogDescription>
            This is saved straight to your eBay account and can be used on any listing.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="policy-name">Name</Label>
            <Input
              id="policy-name"
              value={form.name}
              maxLength={64}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Standard bike postage"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="policy-description">Description (optional)</Label>
            <Textarea
              id="policy-description"
              value={form.description}
              maxLength={250}
              rows={2}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {kind === 'fulfillment' && (
            <>
              <div className="space-y-1.5">
                <Label>Handling time</Label>
                <Select value={form.handling_time_days} onValueChange={(v) => set('handling_time_days', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HANDLING.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Postage service</Label>
                <Select
                  value={form.shipping_service_code}
                  onValueChange={(v) => set('shipping_service_code', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                  <SelectContent className="max-h-[260px] overflow-y-auto">
                    {services.map((s) => <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Free postage</div>
                  <div className="text-xs text-muted-foreground">The buyer pays nothing for delivery.</div>
                </div>
                <Switch checked={form.free_shipping} onCheckedChange={(v) => set('free_shipping', v)} />
              </div>
              {!form.free_shipping && (
                <div className="space-y-1.5">
                  <Label htmlFor="policy-cost">Postage cost (£)</Label>
                  <Input
                    id="policy-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.shipping_cost}
                    onChange={(e) => set('shipping_cost', e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Buyer can collect in person</div>
                  <div className="text-xs text-muted-foreground">Offer pick-up from your shop as well.</div>
                </div>
                <Switch checked={form.local_pickup} onCheckedChange={(v) => set('local_pickup', v)} />
              </div>
            </>
          )}

          {kind === 'payment' && (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Payment required immediately</div>
                <div className="text-xs text-muted-foreground">
                  The bike stays available until the buyer has paid.
                </div>
              </div>
              <Switch checked={form.immediate_pay} onCheckedChange={(v) => set('immediate_pay', v)} />
            </div>
          )}

          {kind === 'returns' && (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Accept returns</div>
                  <div className="text-xs text-muted-foreground">Turn off to sell with no returns.</div>
                </div>
                <Switch checked={form.returns_accepted} onCheckedChange={(v) => set('returns_accepted', v)} />
              </div>
              {form.returns_accepted && (
                <>
                  <div className="space-y-1.5">
                    <Label>Return window</Label>
                    <Select value={form.return_period_days} onValueChange={(v) => set('return_period_days', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Who pays return postage</Label>
                    <Select
                      value={form.return_shipping_cost_payer}
                      onValueChange={(v) => set('return_shipping_cost_payer', v as 'BUYER' | 'SELLER')}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUYER">The buyer</SelectItem>
                        <SelectItem value="SELLER">You</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Refund method</Label>
                    <Select
                      value={form.refund_method}
                      onValueChange={(v) => set('refund_method', v as FormState['refund_method'])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONEY_BACK">Money back</SelectItem>
                        <SelectItem value="MONEY_BACK_OR_REPLACEMENT">Money back or replacement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {policy ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={deleting}>
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this policy?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It will be removed from your eBay account. Policies still used by a live listing cannot be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {policy ? 'Save changes' : 'Create policy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
