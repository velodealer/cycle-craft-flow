import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileSpreadsheet, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useShopifyTemplate } from '@/hooks/useShopifyTemplate';
import { BIKE_FIELDS, autoMatch, isShopifyListField, metafieldOf, parseHeaderRow, sourceLabel } from '@/lib/shopifyTemplate';

const BLANK = '__blank__';
const TEXT = '__text__';

export default function ShopifyTemplateSettings() {
  const { template, loading, save } = useShopifyTemplate();
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string>('');
  const [specKeys, setSpecKeys] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (template) { setHeaders(template.headers); setMapping(template.mapping); setFileName(template.fileName ?? ''); }
  }, [template]);

  useEffect(() => {
    (async () => {
      const [{ data: bikes }, { data: comps }] = await Promise.all([
        supabase.from('bikes').select('spec_values').not('spec_values', 'is', null).limit(300),
        supabase.from('bike_components').select('slot').limit(1000),
      ]);
      const keys = new Set<string>();
      for (const b of (bikes as any[]) ?? []) if (b.spec_values && typeof b.spec_values === 'object') {
        for (const [k, v] of Object.entries(b.spec_values as Record<string, unknown>)) {
          // Grouped sections (e.g. ebike, drivetrain) expose each inner field as section.field.
          if (v && typeof v === 'object' && !Array.isArray(v) && !('value' in (v as any)) && !('label' in (v as any))) {
            Object.keys(v as object).forEach((sub) => keys.add(`${k}.${sub}`));
          } else keys.add(k);
        }
      }
      setSpecKeys([...keys].sort());
      setSlots([...new Set(((comps as any[]) ?? []).map((c) => String(c.slot ?? '')).filter(Boolean))].sort());
    })();
  }, []);

  const metaHeaders = useMemo(() => headers.filter((h) => metafieldOf(h)), [headers]);
  const standardCount = headers.length - metaHeaders.length;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.slice(0, 200_000).text();
    const h = parseHeaderRow(text);
    if (!h.includes('Handle') || !h.includes('Title')) { toast.error("That doesn't look like a Shopify product export (no Handle/Title columns)."); return; }
    const next: Record<string, string> = {};
    for (const col of h) if (metafieldOf(col)) next[col] = mapping[col] ?? autoMatch(col, specKeys, slots);
    setHeaders(h); setMapping(next); setFileName(f.name);
    toast.success(`Read ${h.length} columns — check the matches below, then save.`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const doSave = async () => {
    setSaving(true);
    try { await save({ headers, mapping, fileName, savedAt: new Date().toISOString() }); toast.success('Shopify template saved — exports now use your columns'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    setSaving(true);
    try { await save(null); setHeaders([]); setMapping({}); setFileName(''); toast.success('Back to the default Shopify export'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const setOne = (h: string, v: string) => setMapping((m) => ({ ...m, [h]: v }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Your Shopify CSV template</CardTitle>
        <CardDescription>
          Upload a product export from your own Shopify store (Products → Export). We only read the column names, then every Shopify CSV download uses your exact columns and metafields. Standard Shopify, SEO and Google columns are filled automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
            <Upload className="mr-2 h-4 w-4" /> {headers.length ? 'Upload a new file' : 'Upload Shopify export'}
          </Button>
          {template && <Button variant="ghost" onClick={reset} disabled={saving}><RotateCcw className="mr-2 h-4 w-4" /> Use default export</Button>}
          {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        </div>

        {headers.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{headers.length} columns</Badge>
              <Badge variant="secondary">{standardCount} filled automatically</Badge>
              <Badge variant="secondary">{metaHeaders.length} metafields to match</Badge>
              <Badge variant="outline">{metaHeaders.filter((h) => !mapping[h]).length} left blank</Badge>
            </div>
            <div className="divide-y rounded-md border">
              {metaHeaders.map((h) => {
                const mf = metafieldOf(h)!;
                const v = mapping[h] ?? '';
                const isText = v.startsWith('text:');
                return (
                  <div key={h} className="grid gap-2 p-3 sm:grid-cols-[1fr_16rem] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{mf.label || mf.key}</p>
                      <p className="truncate text-xs text-muted-foreground">{mf.ns}.{mf.key}</p>
                    </div>
                    {isShopifyListField(h) ? (
                      <p className="text-xs text-muted-foreground">Shopify list field — always left blank. Pick its value in Shopify admin.</p>
                    ) : (
                    <div className="space-y-1">
                      <Select value={isText ? TEXT : v || BLANK} onValueChange={(nv) => setOne(h, nv === BLANK ? '' : nv === TEXT ? 'text:' : nv)}>
                        <SelectTrigger><SelectValue placeholder="Leave blank">{isText ? 'Fixed text' : sourceLabel(v)}</SelectValue></SelectTrigger>
                        <SelectContent className="max-h-80">
                          <SelectItem value={BLANK}>Leave blank</SelectItem>
                          <SelectItem value={TEXT}>Fixed text…</SelectItem>
                          <SelectGroup><SelectLabel>Bike details</SelectLabel>
                            {BIKE_FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                          </SelectGroup>
                          {slots.length > 0 && <SelectGroup><SelectLabel>Fitted parts</SelectLabel>
                            {slots.map((s) => <SelectItem key={s} value={`part:${s}`}>{s.replace(/_/g, ' ')}</SelectItem>)}
                          </SelectGroup>}
                          {specKeys.length > 0 && <SelectGroup><SelectLabel>Specs</SelectLabel>
                            {specKeys.map((s) => <SelectItem key={s} value={`spec:${s}`}>{s.replace(/_/g, ' ')}</SelectItem>)}
                          </SelectGroup>}
                        </SelectContent>
                      </Select>
                      {isText && <Input value={v.slice(5)} placeholder="Text for every bike" onChange={(e) => setOne(h, `text:${e.target.value}`)} />}
                      <p className="text-xs text-muted-foreground">If Shopify says "select a metaobject" for this column, choose Leave blank.</p>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Button onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
