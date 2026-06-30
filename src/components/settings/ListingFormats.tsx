import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  LISTING_FIELDS,
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
};

type TemplateRow = {
  platform: ListingPlatform;
  format: ListingFormat;
  body: string;
};

export default function ListingFormats() {
  const [platform, setPlatform] = useState<ListingPlatform>('ebay');
  const [templates, setTemplates] = useState<Record<ListingPlatform, TemplateRow>>({
    ebay: { platform: 'ebay', format: 'text', body: '' },
    shopify: { platform: 'shopify', format: 'text', body: '' },
    instagram: { platform: 'instagram', format: 'text', body: '' },
    facebook: { platform: 'facebook', format: 'text', body: '' },
  });
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('listing_templates' as any)
      .upsert(
        {
          platform,
          format: current.format,
          body: current.body,
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
    () => renderTemplate(current.body || '', SAMPLE_BIKE, []),
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
                  <div className="border rounded-md max-h-[380px] overflow-y-auto p-2 space-y-1">
                    {LISTING_FIELDS.map((f) => (
                      <button
                        key={f.token}
                        type="button"
                        onClick={() => insertToken(f.token)}
                        className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent flex flex-col"
                      >
                        <span className="font-mono">{`{${f.token}}`}</span>
                        <span className="text-muted-foreground">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preview (sample bike)</Label>
                {current.format === 'html' ? (
                  <div
                    className="border rounded-md p-3 text-sm prose prose-sm max-w-none bg-muted/30"
                    dangerouslySetInnerHTML={{ __html: preview }}
                  />
                ) : (
                  <pre className="border rounded-md p-3 text-sm whitespace-pre-wrap bg-muted/30">
                    {preview || <span className="text-muted-foreground">Empty</span>}
                  </pre>
                )}
              </div>

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
