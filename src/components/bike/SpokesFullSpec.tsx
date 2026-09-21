import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

/**
 * Read-only view of the complete manufacturer record we store from 99spokes.
 * It walks whatever the record contains, so new fields from the source appear
 * here automatically without any code change.
 */

const SKIP_TOP = new Set(['id', 'components', 'sizes', 'images', 'priceHistory']);

function humanise(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\bMM\b/gi, '(mm)')
    .replace(/\bKG\b/gi, '(kg)')
    .replace(/\bWh\b/g, '(Wh)')
    .replace(/\bNm\b/g, '(Nm)')
    .replace(/^./, (m) => m.toUpperCase());
}

function isBlank(v: any) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

function primitive(v: any) {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

/** Flattens any value into label/value rows. */
function rows(value: any, prefix = ''): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  if (isBlank(value)) return out;

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (item && typeof item === 'object') {
        out.push(...rows(item, prefix ? `${prefix} ${i + 1}` : `${i + 1}`));
      } else if (!isBlank(item)) {
        out.push({ label: prefix || 'Value', value: primitive(item) });
      }
    });
    return out;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => {
      const label = prefix ? `${prefix} · ${humanise(k)}` : humanise(k);
      if (v && typeof v === 'object') out.push(...rows(v, label));
      else if (!isBlank(v)) out.push({ label, value: primitive(v) });
    });
    return out;
  }

  out.push({ label: prefix || 'Value', value: primitive(value) });
  return out;
}

function RowList({ data }: { data: any }) {
  const list = rows(data);
  if (list.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded.</p>;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
      {list.map((r, i) => (
        <div key={`${r.label}-${i}`} className="flex justify-between gap-3 border-b py-1.5 text-sm">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-medium break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SpokesFullSpec({ bike }: { bike: any }) {
  const data = bike?.catalog_data;
  const sizes: any[] = Array.isArray(data?.sizes) ? data.sizes : [];
  const [sizeName, setSizeName] = useState<string>(
    () => bike?.catalog_size || sizes[0]?.name || '',
  );

  const components = useMemo(() => {
    const c = data?.components || {};
    return Object.entries(c)
      .map(([slot, part]: [string, any]) => {
        if (!part) return null;
        const detail = { ...(part as any) };
        const headline = detail.display || detail.description ||
          [detail.maker, detail.model].filter(Boolean).join(' ');
        delete detail.display;
        delete detail.description;
        if (!headline && Object.keys(detail).length === 0) return null;
        return { slot, headline: headline || '—', extra: detail };
      })
      .filter(Boolean) as Array<{ slot: string; headline: string; extra: Record<string, any> }>;
  }, [data]);

  const size = useMemo(
    () => sizes.find((s) => s?.name === sizeName) || sizes[0] || null,
    [sizes, sizeName],
  );

  const otherGroups = useMemo(() => {
    if (!data) return [] as Array<{ key: string; value: any }>;
    return Object.entries(data)
      .filter(([k, v]) => !SKIP_TOP.has(k) && !isBlank(v) && typeof v === 'object')
      .map(([key, value]) => ({ key, value }));
  }, [data]);

  const headline = useMemo(() => {
    if (!data) return [] as Array<{ label: string; value: string }>;
    return Object.entries(data)
      .filter(([k, v]) => !SKIP_TOP.has(k) && !isBlank(v) && typeof v !== 'object')
      .map(([k, v]) => ({ label: humanise(k), value: primitive(v) }));
  }, [data]);

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            Manufacturer specification
            <Badge variant="secondary">99spokes</Badge>
          </CardTitle>
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm underline"
            >
              View source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <CardDescription>
          Everything published for this model, stored exactly as supplied
          {bike.catalog_synced_at ? ` · last pulled ${new Date(bike.catalog_synced_at).toLocaleDateString()}` : ''}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="overview">
            <AccordionTrigger>Overview</AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {headline.map((r) => (
                  <div key={r.label} className="flex justify-between gap-3 border-b py-1.5 text-sm">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="text-right font-medium break-words">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          {components.length > 0 && (
            <AccordionItem value="components">
              <AccordionTrigger>Components ({components.length})</AccordionTrigger>
              <AccordionContent>
                <div className="divide-y">
                  {components.map((c) => (
                    <div key={c.slot} className="py-2">
                      <div className="flex flex-wrap justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{humanise(c.slot)}</span>
                        <span className="font-medium text-right break-words">{c.headline}</span>
                      </div>
                      {Object.keys(c.extra).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground break-words">
                          {rows(c.extra).map((r) => `${r.label}: ${r.value}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {sizes.length > 0 && (
            <AccordionItem value="geometry">
              <AccordionTrigger>Sizes &amp; geometry</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="max-w-xs">
                    <Select value={sizeName} onValueChange={setSizeName}>
                      <SelectTrigger><SelectValue placeholder="Select a size" /></SelectTrigger>
                      <SelectContent className="max-h-[240px] overflow-y-auto">
                        {sizes.map((s: any) => (
                          <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {size && <RowList data={size} />}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {Array.isArray(data.images) && data.images.length > 0 && (
            <AccordionItem value="images">
              <AccordionTrigger>Images ({data.images.length})</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {data.images.map((img: any, i: number) => (
                    <a key={i} href={img.url} target="_blank" rel="noreferrer" className="block border p-1">
                      <img src={img.url} alt={`View ${i + 1}`} loading="lazy" className="h-24 w-full object-contain" />
                    </a>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {otherGroups.map((g) => (
            <AccordionItem value={g.key} key={g.key}>
              <AccordionTrigger>{humanise(g.key)}</AccordionTrigger>
              <AccordionContent>
                <RowList data={g.value} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
