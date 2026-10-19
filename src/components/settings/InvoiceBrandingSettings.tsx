import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { uploadPhoto } from '@/utils/photoUpload';
import { toast } from 'sonner';

export interface InvoiceBranding {
  logo_url?: string;
  account_name?: string;
  account_number?: string;
  sort_code?: string;
  footer_note?: string;
}

export default function InvoiceBrandingSettings() {
  const [bid, setBid] = useState<string | null>(null);
  const [b, setB] = useState<InvoiceBranding>({});
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null);

  useEffect(() => {
    (async () => {
      const { data: id } = await supabase.rpc('current_business_id');
      if (!id) return;
      setBid(id as string);
      const { data } = await supabase.from('app_settings').select('value').eq('key', `invoice_branding:${id}`).maybeSingle();
      if (data?.value) setB(data.value as InvoiceBranding);
    })();
  }, []);

  const save = async (next = b) => {
    if (!bid) return;
    setBusy('save');
    const { error } = await supabase.from('app_settings')
      .upsert({ key: `invoice_branding:${bid}`, business_id: bid, value: next as never }, { onConflict: 'key' });
    setBusy(null);
    if (error) toast.error(`Could not save: ${error.message}`); else toast.success('Invoice details saved');
  };

  const onLogo = async (file?: File) => {
    if (!file || !bid) return;
    setBusy('logo');
    const url = await uploadPhoto(file, 'bike-photos', `branding/${bid}`);
    setBusy(null);
    if (!url) return toast.error('Logo upload failed');
    const next = { ...b, logo_url: url };
    setB(next);
    await save(next);
  };

  const field = (k: keyof InvoiceBranding, label: string, placeholder = '') => (
    <div className="space-y-1">
      <Label htmlFor={`ib-${k}`}>{label}</Label>
      <Input id={`ib-${k}`} placeholder={placeholder} value={b[k] ?? ''} onChange={(e) => setB({ ...b, [k]: e.target.value })} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Invoices</CardTitle>
        <CardDescription>Your logo and bank details shown on customer invoices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-40 items-center justify-center rounded-md border bg-muted/30">
            {b.logo_url ? <img src={b.logo_url} alt="Logo" className="max-h-14 max-w-36 object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
          </div>
          <Button size="sm" variant="outline" asChild disabled={busy !== null}>
            <label className="cursor-pointer">
              {busy === 'logo' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
          </Button>
          {b.logo_url && <Button size="sm" variant="ghost" onClick={() => { const n = { ...b, logo_url: undefined }; setB(n); save(n); }}><X className="h-4 w-4" /></Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {field('account_name', 'Account holder name')}
          {field('account_number', 'Account number', '12345678')}
          {field('sort_code', 'Sort code', '00-00-00')}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ib-footer">Note at the bottom of invoices (optional)</Label>
          <Textarea id="ib-footer" rows={2} value={b.footer_note ?? ''} onChange={(e) => setB({ ...b, footer_note: e.target.value })} />
        </div>
        <Button size="sm" onClick={() => save()} disabled={busy !== null || !bid}>
          {busy === 'save' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}
