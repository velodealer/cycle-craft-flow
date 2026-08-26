import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { syncInvoice } from '@/lib/quickbooks';

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

  const isMargin = bike?.finance_scheme === 'margin_scheme';

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('external_owners')
      .select('id, name, email, phone, address')
      .order('name')
      .then(({ data }) => setCustomers(data ?? []));
  }, [isOpen]);

  const totals = useMemo(() => {
    const gross = Number(salePrice) || 0;
    if (isMargin) {
      const purchase = Number(bike?.purchase_price || 0);
      const marginVat = Math.max(0, gross - purchase) * 20 / 120;
      return { gross, net: gross, vatRate: 0, invoiceVat: 0, marginVat };
    }
    const net = gross / 1.2;
    return { gross, net, vatRate: 20, invoiceVat: gross - net, marginVat: 0 };
  }, [salePrice, isMargin, bike?.purchase_price]);

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

      const { data: numberData, error: numberError } = await supabase.rpc('next_invoice_number');
      if (numberError) throw numberError;

      const issuedAt = new Date(`${saleDate}T12:00:00Z`).toISOString();

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: numberData as string,
          bike_id: bike.id,
          external_customer_id: externalCustomerId,
          type: 'sale',
          total: totals.gross,
          net: Number(totals.net.toFixed(2)),
          gross: Number(totals.gross.toFixed(2)),
          vat_rate: totals.vatRate,
          status: 'issued',
          issued_at: issuedAt,
        })
        .select('id, invoice_number')
        .single();
      if (invoiceError) throw invoiceError;

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
              <SelectContent>
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
              <span className="text-muted-foreground">Invoice net</span>
              <span>£{totals.net.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice VAT ({totals.vatRate}%)</span>
              <span>£{totals.invoiceVat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Invoice total</span>
              <span>£{totals.gross.toFixed(2)}</span>
            </div>
            {isMargin && (
              <div className="flex justify-between pt-1 text-muted-foreground">
                <span>Margin VAT posted to VAT control</span>
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
