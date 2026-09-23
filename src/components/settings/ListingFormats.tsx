import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { buildEbayTitle, DEFAULT_TITLE_FORMAT, TITLE_TOKENS } from '@/lib/ebayTitle';
import { ShopifyMetafieldEditor, SquarespaceMappingEditor, validMetafieldKey } from './FieldMappingEditor';
import {
  LISTING_FIELD_GROUPS,
  PLATFORMS,
  renderTemplate,
  type ListingFormat,
  type ListingPlatform,
} from '@/lib/listingTemplate';

const SAMPLE_BIKE = {
  make: 'Specialized',
  model: 'Stumpjumper',
  year: 2022,
  colour: 'Black',
  size: 'Large',
  gender: 'Unisex',
  bike_type: 'Mountain',
  frame_material: 'Carbon',
  frame_number: 'SP123456',
  condition: 'Excellent',
  condition_notes: 'Minor scuffs on chainstay',
  description: 'Lightly used trail bike',
  listing_description: 'Ready to shred — fully serviced.',
  weight_kg: 13.2,
  is_electric: false,
  has_suspension_fork: true,
  has_rear_shock: true,
  has_dropper: true,
  accessories_included: 'Pedals, spare tube',
  asking_price: 2495,
  sale_price: null,
  sku: 'BIKE-001',
  photos: [],
  spec_values: {
    frame: { material: 'Carbon', size: 'Large' },
    fork: { travel_mm: 150, lockout: true },
    drivetrain: { groupset: 'SRAM GX Eagle', speed: 12, config: '1x', cassette_range: '10-52T' },
    brakes: { type: 'Hydraulic Disc', rotor_front_mm: 200, rotor_rear_mm: 180 },
    wheels: { wheel_size: '29"', rim_material: 'Alloy', tubeless_ready: true },
  },
};

const SAMPLE_COMPONENTS = [
  { slot: 'fork', slot_label: 'Fork', brand: 'Fox', model: '36 Factory', mpn: 'FOX36-F', weight_g: 2050, attributes: { travel: '150mm' } },
  { slot: 'rear_derailleur', slot_label: 'Rear Derailleur', brand: 'SRAM', model: 'GX Eagle', attributes: { speeds: 12 } },
  { slot: 'wheelset', slot_label: 'Wheelset', brand: 'Roval', model: 'Traverse', attributes: { material: 'Alloy' } },
];


type TemplateRow = {
  platform: ListingPlatform;
  format: ListingFormat;
  body: string;
  title_format?: string | null;
  field_map?: any;
};

export default function ListingFormats() {
  const [platform, setPlatform] = useState<ListingPlatform>('ebay');
  const [templates, setTemplates] = useState<Record<ListingPlatform, TemplateRow>>({
    ebay: { platform: 'ebay', format: 'text', body: '' },
    shopify: { platform: 'shopify', format: 'text', body: '' },
    squarespace: { platform: 'squarespace', format: 'html', body: '' },
    instagram: { platform: 'instagram', format: 'text', body: '' },
    facebook: { platform: 'facebook', format: 'text', body: '' },
  });
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [search, setSearch] = useState('');

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LISTING_FIELD_GROUPS;
    return LISTING_FIELD_GROUPS.map((g) => ({
      ...g,
      fields: g.fields.filter(
        (f) => f.token.toLowerCase().includes(q) || f.label.toLowerCase().includes(q),
      ),
    })).filter((g) => g.fields.length > 0);
  }, [search]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('listing_templates' as any).select('*');
      if (error) {
        toast({ title: 'Failed to load templates', description: error.message, variant: 'destructive' });
        return;
      }
      const next = { ...templates };
      (data as any[] || []).forEach((row) => {
        if (row.platform in next) {
          next[row.platform as ListingPlatform] = {
            platform: row.platform,
            format: row.format,
            body: row.body || '',
            title_format: row.title_format ?? null,
            field_map: row.field_map ?? null,
          };
        }
      });
      setTemplates(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = templates[platform];

  const updateCurrent = (patch: Partial<TemplateRow>) => {
    setTemplates((t) => ({ ...t, [platform]: { ...t[platform], ...patch } }));
  };

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    const insert = `{${token}}`;
    if (!ta) {
      updateCurrent({ body: (current.body || '') + insert });
      return;
    }
    const start = ta.selectionStart ?? current.body.length;
    const end = ta.selectionEnd ?? current.body.length;
    const newBody = current.body.slice(0, start) + insert + current.body.slice(end);
    updateCurrent({ body: newBody });
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insert.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    let fieldMap: any = undefined;
    if (platform === 'shopify') {
      const rows = (Array.isArray(current.field_map) ? current.field_map : []).filter((r: any) => r.key || r.value);
      const bad = rows.find((r: any) => !validMetafieldKey(r.key));
      if (bad) {
        toast({ title: 'Check metafield keys', description: `"${bad.key || '(blank)'}" should look like namespace.key`, variant: 'destructive' });
        return;
      }
      fieldMap = rows;
    } else if (platform === 'squarespace') {
      const m = current.field_map && !Array.isArray(current.field_map) ? current.field_map : {};
      fieldMap = {
        ...m,
        tags: (m.tags ?? []).filter((t: string) => t.trim()),
        categories: (m.categories ?? []).filter((t: string) => t.trim()),
      };
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('listing_templates' as any)
      .upsert(
        {
          platform,
          format: current.format,
          body: current.body,
          ...(platform === 'ebay' ? { title_format: current.title_format?.trim() || null } : {}),
          ...(fieldMap !== undefined ? { field_map: fieldMap } : {}),
          updated_by: userRes.user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'platform' },
      );
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Template saved' });
    }
  };

  const preview = useMemo(
    () => renderTemplate(current.body || '', SAMPLE_BIKE, SAMPLE_COMPONENTS),
    [current.body],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Formats</CardTitle>
        <CardDescription>
          Build listing templates per platform. Insert bike fields with {'{placeholders}'} — they get filled in when you copy a listing from a bike.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as ListingPlatform)}>
          <TabsList className="grid w-full grid-cols-4">
            {PLATFORMS.map((p) => (
              <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
            ))}
          </TabsList>
          {PLATFORMS.map((p) => (
            <TabsContent key={p.value} value={p.value} className="space-y-4 pt-4">
              <div className="flex items-center gap-6">
                <Label className="font-medium">Format</Label>
                <RadioGroup
                  value={current.format}
                  onValueChange={(v) => updateCurrent({ format: v as ListingFormat })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="text" id={`${p.value}-text`} />
                    <Label htmlFor={`${p.value}-text`}>Plain text</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="html" id={`${p.value}-html`} />
                    <Label htmlFor={`${p.value}-html`}>HTML</Label>
                  </div>
                </RadioGroup>
              </div>

              {p.value === 'ebay' && (
                <div className="space-y-2 rounded border p-3">
                  <Label htmlFor="ebay-title-format">Title format</Label>
                  <Input
                    id="ebay-title-format"
                    value={current.title_format ?? ''}
                    onChange={(e) => updateCurrent({ title_format: e.target.value })}
                    placeholder={DEFAULT_TITLE_FORMAT}
                  />
                  <div className="flex flex-wrap gap-1">
                    {TITLE_TOKENS.map((t) => (
                      <Button key={t.token} type="button" size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => updateCurrent({ title_format: `${(current.title_format ?? '').trim()} {${t.token}}`.trim() })}>
                        {t.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: <span className="text-foreground">{buildEbayTitle(SAMPLE_BIKE, current.title_format)}</span>{' '}
                    ({buildEbayTitle(SAMPLE_BIKE, current.title_format).length}/80). Titles are capped at 80 characters — items later in the format are dropped first. Repeated words are removed.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
                <div className="space-y-2">
                  <Label>Template body</Label>
                  <Textarea
                    ref={textareaRef}
                    value={current.body}
                    onChange={(e) => updateCurrent({ body: e.target.value })}
                    rows={16}
                    placeholder={current.format === 'html'
                      ? '<h2>{title}</h2>\n<p>{listing_description}</p>'
                      : '{title}\n\nCondition: {condition}\nSize: {size}\n\n{listing_description}'}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Available fields</Label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search fields or parts…"
                    className="h-8 text-xs"
                  />
                  <div className="border rounded-md max-h-[420px] overflow-y-auto p-2 space-y-3">
                    {filteredGroups.length === 0 && (
                      <p className="text-xs text-muted-foreground px-1 py-2">No matching fields</p>
                    )}
                    {filteredGroups.map((group) => (
                      <div key={group.id} className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                          {group.title}
                        </p>
                        {group.fields.map((f) => (
                          <button
                            key={f.token}
                            type="button"
                            onClick={() => insertToken(f.token)}
                            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent flex flex-col"
                          >
                            <span className="font-mono break-all">{`{${f.token}}`}</span>
                            <span className="text-muted-foreground">{f.label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preview (sample bike)</Label>
                {current.format === 'html' ? (
                  <iframe
                    title={`${p.label} listing preview`}
                    sandbox=""
                    srcDoc={preview}
                    className="h-80 w-full rounded-md border bg-background"
                  />
                ) : (
                  <pre className="border rounded-md p-3 text-sm whitespace-pre-wrap bg-muted/30">
                    {preview || <span className="text-muted-foreground">Empty</span>}
                  </pre>
                )}
              </div>

              {p.value === 'shopify' && (
                <ShopifyMetafieldEditor
                  rows={Array.isArray(current.field_map) ? current.field_map : []}
                  onChange={(rows) => updateCurrent({ field_map: rows })}
                  bike={SAMPLE_BIKE}
                  components={SAMPLE_COMPONENTS}
                />
              )}
              {p.value === 'squarespace' && (
                <SquarespaceMappingEditor
                  map={current.field_map && !Array.isArray(current.field_map) ? current.field_map : {}}
                  onChange={(m) => updateCurrent({ field_map: m })}
                  bike={SAMPLE_BIKE}
                  components={SAMPLE_COMPONENTS}
                />
              )}

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save template'}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
