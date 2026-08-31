import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { syncInvoice, tryPostPurchase } from '@/lib/quickbooks';

interface RecordSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bike: any;
  onSuccess: () => void;
}

interface ExternalOwner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

const NEW_CUSTOMER = '__new__';

export default function RecordSaleDialog({ isOpen, onClose, bike, onSuccess }: RecordSaleDialogProps) {
  const [customers, setCustomers] = useState<ExternalOwner[]>([]);
  const [customerId, setCustomerId] = useState<string>(NEW_CUSTOMER);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [salePrice, setSalePrice] = useState<string>(bike?.asking_price ? String(bike.asking_price) : '');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [hasPartEx, setHasPartEx] = useState(false);
  const [partEx, setPartEx] = useState({
    make: '',
    model: '',
    frame_number: '',
    size: '',
    colour: '',
    value: '',
    finance_scheme: 'margin_scheme' as 'margin_scheme' | 'vat_qualifying',
  });

  const [fulfilment, setFulfilment] = useState<'collection' | 'delivery'>('collection');
  const [deliveryCharge, setDeliveryCharge] = useState('75');
  const [chargeDelivery, setChargeDelivery] = useState(true);
  const [bookCourier, setBookCourier] = useState(true);
  const [delivery, setDelivery] = useState({
    street: '',
    city: '',
    postcode: '',
    country: 'UK',
    instructions: '',
  });

  const isMargin = bike?.finance_scheme === 'margin_scheme';

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('external_owners')
      .select('id, name, email, phone, address')
      .order('name')
      .then(({ data }) => setCustomers(data ?? []));
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'default_delivery_charge')
      .maybeSingle()
      .then(({ data }) => {
        const value = Number(data?.value as any);
        if (Number.isFinite(value) && value >= 0) setDeliveryCharge(String(value));
      });
  }, [isOpen]);

  const totals = useMemo(() => {
    const gross = Number(salePrice) || 0;
    const pxValue = hasPartEx ? Number(partEx.value) || 0 : 0;
    const deliveryFee = fulfilment === 'delivery' && chargeDelivery ? Number(deliveryCharge) || 0 : 0;
    const balance = Math.max(0, gross + deliveryFee - pxValue);
    if (isMargin) {
      const purchase = Number(bike?.purchase_price || 0);
      const marginVat = Math.max(0, gross - purchase) * 20 / 120;
      // Delivery is standard rated even on a margin scheme bike.
      const deliveryVat = deliveryFee - deliveryFee / 1.2;
      return {
        gross,
        pxValue,
        deliveryFee,
        balance,
        net: gross + deliveryFee - deliveryVat,
        vatRate: 0,
        invoiceVat: deliveryVat,
        marginVat,
      };
    }
    const net = (gross + deliveryFee) / 1.2;
    return {
      gross,
      pxValue,
      deliveryFee,
      balance,
      net,
      vatRate: 20,
      invoiceVat: gross + deliveryFee - net,
      marginVat: 0,
    };
  }, [salePrice, isMargin, bike?.purchase_price, hasPartEx, partEx.value, fulfilment, chargeDelivery, deliveryCharge]);


  const handleSubmit = async () => {
    const gross = Number(salePrice);
    if (!gross || gross <= 0) {
      toast.error('Enter a valid sale price');
      return;
    }
    if (customerId === NEW_CUSTOMER && !newCustomer.name.trim()) {
      toast.error('Enter the customer name');
      return;
    }
    if (hasPartEx) {
      if (!partEx.make.trim() || !partEx.model.trim()) {
        toast.error('Enter the part exchange bike make and model');
        return;
      }
      if (!(Number(partEx.value) > 0)) {
        toast.error('Enter the part exchange allowance');
        return;
      }
      if (Number(partEx.value) > gross) {
        toast.error('The part exchange allowance cannot exceed the sale price');
        return;
      }
    }
    if (fulfilment === 'delivery' && bookCourier) {
      if (!delivery.street.trim() || !delivery.city.trim() || !delivery.postcode.trim()) {
        toast.error('Enter the delivery street, city and postcode');
        return;
      }
    }


    setSubmitting(true);
    try {
      let externalCustomerId = customerId;
      if (customerId === NEW_CUSTOMER) {
        const { data, error } = await supabase
          .from('external_owners')
          .insert({
            name: newCustomer.name.trim(),
            email: newCustomer.email.trim() || null,
            phone: newCustomer.phone.trim() || null,
            address: newCustomer.address.trim() || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        externalCustomerId = data.id;
      }

      const issuedAt = new Date(`${saleDate}T12:00:00Z`).toISOString();

      // Part exchange bike comes in as a new stock item at the agreed allowance.
      let partExBikeId: string | null = null;
      if (hasPartEx) {
        const { data: pxBike, error: pxError } = await supabase
          .from('bikes')
          .insert({
            make: partEx.make.trim(),
            model: partEx.model.trim(),
            frame_number: partEx.frame_number.trim() || null,
            size: partEx.size.trim() || null,
            colour: partEx.colour.trim() || null,
            source: 'owned',
            status: 'intake',
            finance_scheme: partEx.finance_scheme,
            purchase_price: Number(partEx.value),
            purchase_date: issuedAt,
            intake_date: issuedAt,
            acquired_via: 'part_exchange',
            external_owner_id: externalCustomerId,
          })
          .select('id')
          .single();
        if (pxError) throw pxError;
        partExBikeId = pxBike.id;
      }

      const { data: numberData, error: numberError } = await supabase.rpc('next_invoice_number');
      if (numberError) throw numberError;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: numberData as string,
          bike_id: bike.id,
          external_customer_id: externalCustomerId,
          type: 'sale',
          total: Number(totals.balance.toFixed(2)),
          net: Number(totals.net.toFixed(2)),
          gross: Number(totals.balance.toFixed(2)),
          sale_gross: Number(totals.gross.toFixed(2)),
          delivery_charge: fulfilment === 'delivery' ? Number((Number(deliveryCharge) || 0).toFixed(2)) : 0,
          delivery_charged_to_customer: fulfilment === 'delivery' && chargeDelivery,
          part_exchange_bike_id: partExBikeId,
          part_exchange_value: hasPartEx ? Number(totals.pxValue.toFixed(2)) : null,
          vat_rate: totals.vatRate,

          status: 'issued',
          issued_at: issuedAt,
        })
        .select('id, invoice_number')
        .single();
      if (invoiceError) throw invoiceError;

      if (partExBikeId) {
        await supabase.from('bikes').update({ part_exchange_invoice_id: invoice.id }).eq('id', partExBikeId);
      }

      const { error: bikeError } = await supabase
        .from('bikes')
        .update({
          status: 'sold',
          sale_price: totals.gross,
          sold_at: issuedAt,
          condition_notes: notes.trim()
            ? `${bike.condition_notes ? `${bike.condition_notes}\n\n` : ''}Sale note: ${notes.trim()}`
            : bike.condition_notes,
        })
        .eq('id', bike.id);
      if (bikeError) throw bikeError;

      toast.success(`Sale recorded — invoice ${invoice.invoice_number}`);

      try {
        await syncInvoice(invoice.id);
        toast.success('Invoice synced to QuickBooks');
      } catch (e) {
        toast.warning(`Saved, but QuickBooks sync failed: ${(e as Error).message}`);
      }

      if (partExBikeId) {
        const result = await tryPostPurchase(partExBikeId);
        if (!result.ok) {
          toast.warning(`Part exchange bike created, but its stock posting failed: ${result.error}`);
        }
      }

      onSuccess();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record sale</DialogTitle>
          <DialogDescription>
            Capture the sale details and raise the invoice for {bike?.make} {bike?.model}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sale-price">Sale price (inc. VAT)</Label>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-date">Sale date</Label>
              <Input id="sale-date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[280px] overflow-y-auto">
                <SelectItem value={NEW_CUSTOMER}>+ New customer</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {customerId === NEW_CUSTOMER && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cust-name">Name</Label>
                <Input id="cust-name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-email">Email</Label>
                <Input id="cust-email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input id="cust-phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cust-address">Address</Label>
                <Input id="cust-address" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} />
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="part-ex-toggle">Part exchange</Label>
              <p className="text-xs text-muted-foreground">Take a bike in against this sale</p>
            </div>
            <Switch id="part-ex-toggle" checked={hasPartEx} onCheckedChange={setHasPartEx} />
          </div>

          {hasPartEx && (
            <div className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="px-make">Make</Label>
                <Input id="px-make" value={partEx.make} onChange={(e) => setPartEx({ ...partEx, make: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="px-model">Model</Label>
                <Input id="px-model" value={partEx.model} onChange={(e) => setPartEx({ ...partEx, model: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="px-frame">Frame number (optional)</Label>
                <Input id="px-frame" value={partEx.frame_number} onChange={(e) => setPartEx({ ...partEx, frame_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="px-size">Size (optional)</Label>
                <Input id="px-size" value={partEx.size} onChange={(e) => setPartEx({ ...partEx, size: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="px-colour">Colour (optional)</Label>
                <Input id="px-colour" value={partEx.colour} onChange={(e) => setPartEx({ ...partEx, colour: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="px-value">Part exchange allowance</Label>
                <Input
                  id="px-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={partEx.value}
                  onChange={(e) => setPartEx({ ...partEx, value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>VAT scheme for the incoming bike</Label>
                <Select
                  value={partEx.finance_scheme}
                  onValueChange={(value) => setPartEx({ ...partEx, finance_scheme: value as typeof partEx.finance_scheme })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margin_scheme">Margin scheme</SelectItem>
                    <SelectItem value="vat_qualifying">VAT qualifying</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The bike is created at intake status so it can be completed later.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sale-notes">Notes (optional)</Label>
            <Textarea id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Separator />

          <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scheme</span>
              <span>{isMargin ? 'Margin scheme' : 'Standard VAT'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bike sale price</span>
              <span>£{totals.gross.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice VAT ({totals.vatRate}%)</span>
              <span>£{totals.invoiceVat.toFixed(2)}</span>
            </div>
            {hasPartEx && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Part exchange allowance</span>
                <span>−£{totals.pxValue.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>{hasPartEx ? 'Balance due' : 'Invoice total'}</span>
              <span>£{totals.balance.toFixed(2)}</span>
            </div>
            {isMargin && (
              <div className="flex justify-between pt-1 text-muted-foreground">
                <span>Margin VAT on the full sale price</span>
                <span>£{totals.marginVat.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
