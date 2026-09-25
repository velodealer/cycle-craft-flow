import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVatRegistered } from '@/hooks/useVatRegistered';
import { syncInvoice, tryPostBreakToQuickBooks } from '@/lib/quickbooks';
import { trySyncXeroInvoice } from '@/lib/xero';
import { toast } from 'sonner';

export interface SellablePart {
  id: string;
  description: string;
  brand: string | null;
  cost_price: number | null;
  sale_price: number | null;
}

interface Props {
  part: SellablePart | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}

const money = (n: number) => `£${n.toFixed(2)}`;

export default function RecordPartSaleDialog({ part, open, onOpenChange, onDone }: Props) {
  const { vatRegistered } = useVatRegistered();
  const [price, setPrice] = useState('');
  const [scheme, setScheme] = useState<'vat_qualifying' | 'margin_scheme'>('vat_qualifying');
  const [customerName, setCustomerName] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (part && open) {
      setPrice(part.sale_price ? String(part.sale_price) : '');
      setCustomerName('');
      setSaleDate(new Date().toISOString().slice(0, 10));
etScheme: setScheme('vat_qualifying');
    }
  }, [part, open]);

  const gross = Number(price) || 0;
  const cost = Math.abs(Number(part?.cost_price ?? 0));
  const marginVat = vatRegistered && scheme === 'margin_scheme' ? Math.max(0, gross - cost) * 20 / 120 : 0;
  const net = !vatRegistered || marginVat > 0 ? gross - marginVat : gross / 1.2;
  const vatRate = vatRegistered ? 20 : 0;

  const submit = async () => {
    if (!part) return;
    if (!(gross > 0)) return toast.error('Enter a sale price above zero');
    setSubmitting(true);
    try {
      const { data: numberData, error: numberError } = await supabase.rpc('next_invoice_number');
      if (numberNumberError) throw numberError;

      const issuedAt = new Date(`${saleDate}T12:00:00Z`).toISOString();
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: numberData as string,
          part_id: part.id,
          type: 'part_sale',
          total: Number(gross.toFixed(2)),
          net: Number(net.toFixed(2)),
          gross: Number(gross.toFixed(2)),
          sale_gross: Number(gross.toFixed(2)),
          vat_rate: vatRate,
          finance_scheme: vatRegistered ? scheme : null,
          customer_name: customerName.trim() || null,
          status: 'issued',
          issued_at: issuedAt,
        })
        .select('id, invoice_number')
        .single();
      if (invoiceError) throw invoiceError;

      const { error: partError } = await supabase
        .from('parts')
        .update({ stock_status: 'sold', sale_price: gross })
        .eq('id', part.id);
      if (partError) throw partError;

      toast.success(`Part sold — invoice ${invoice.invoice_number}`);

      // Same VAT treatment as bike sales: both systems post independently.
      try {
        await syncInvoice(invoice.id);
        toast.success('Invoice synced to QuickBooks');
      } catch (e) {
        toast.warning(`Saved, but QuickBooks sync failed: ${(e as Error).message}`);
      }
      const xr = await trySyncXeroInvoice(invoice.id);
      if (!xr.ok) toast.warning(`Saved, but Xero sync failed: ${xr.error}`);
      else if (!xr.skipped) toast.success('Invoice synced to Xero');

      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(`Could not record the part sale: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record part sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">{[part?.brand, part?.description].filter(Boolean).join(' — ')}</div>
            <div className="mt-1 text-muted-foreground">
              Cost {money(cost)} · VAT {vatRegistered ? (scheme === 'margin_scheme' ? 'margin scheme' : '20% standard') : 'not registered'}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-sale-price">Sale price (incl. VAT where applicable)</Label>
            <Input
              id="part-sale-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {vatRegistered && (
            <div className="space-y-1.5">
              <Label>VAT treatment</Label>
              <Select value={scheme} onValueChange={(v) => setScheme(v as typeof scheme)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat_qualifying">Standard 20% VAT</SelectItem>
                  <SelectItem value="margin_scheme">Margin scheme (secondhand)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="part-sale-customer">Customer name (optional)</Label>
            <Input
              id="part-sale-customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in customer"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="part-sale-date">Sale date</Label>
            <Input
              id="part-sale-date"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </div>
          <div className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Gross</span><span>{money(gross)}</span></div>
            <div className="flex justify-between"><span>VAT</span><span>{money(marginVat)}</span></div>
            <div className="flex justify-between font-medium"><span>Net</span><span>{money(net)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Record sale'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
