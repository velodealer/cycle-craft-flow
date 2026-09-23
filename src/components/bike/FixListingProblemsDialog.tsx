import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, XCircle, AlertTriangle, CheckCircle2, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import PhotoUpload from '@/components/PhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activity';
import { useAuth } from '@/hooks/useAuth';
import { getBikeEbayListing, listBikeOnEbay, previewBikeOnEbay, saveBikeEbayOptions, type EbayPreview } from '@/services/ebay';
import { EBAY_TITLE_MAX } from '@/lib/ebayTitle';
import { READINESS_FIELDS, isFieldMissing, type ReadinessField } from '@/lib/listingReadiness';

interface Props {
  bikeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful save (listed = eBay accepted it). */
  onDone?: (listed: boolean) => void;
  /** Label for the extra line under the title, e.g. "Bike 2 of 3". */
  queueLabel?: string;
  /** Only save the details, don't list on eBay. */
  saveOnly?: boolean;
}

const SETTINGS_KEYS = new Set(['policies', 'location']);

/** Match eBay's refusal text to a bike field or item specific. */
function parseEbayError(msg: string | null | undefined, aspectNames: string[]) {
  if (!msg) return { fields: [] as string[], aspects: [] as string[] };
  const m = msg.toLowerCase();
  const fields: string[] = [];
  const aspects: string[] = [];
  const spec = /item specific ([^.]+?) is missing/i.exec(msg);
  if (spec) aspects.push(spec[1].trim());
  for (const n of aspectNames) if (m.includes(n.toLowerCase()) && !aspects.includes(n)) aspects.push(n);
  if (m.includes('condition')) fields.push('condition');
  if (m.includes('picture') || m.includes('photo') || m.includes('image')) fields.push('photos');
  if (m.includes('price')) fields.push('asking_price');
  return { fields, aspects };
}

export default function FixListingProblemsDialog({ bikeId, open, onOpenChange, onDone, queueLabel, saveOnly }: Props) {
  const { profile } = useAuth();
  const canManageSettings = profile?.role === 'admin' || profile?.role === 'owner';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bike, setBike] = useState<Record<string, any> | null>(null);
  const [preview, setPreview] = useState<EbayPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [listingOpts, setListingOpts] = useState<{ condition: string | null; category_id: string | null; title_override: string | null }>({ condition: null, category_id: null, title_override: null });
  const [values, setValues] = useState<Record<string, string>>({});
  const [aspectValues, setAspectValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');

  const load = useCallback(async () => {
    if (!bikeId) return;
    setLoading(true);
    setPreviewError(null);
    try {
      const [{ data: b }, listing] = await Promise.all([
        supabase.from('bikes').select('id, reference, make, model, bike_type, size, colour, frame_material, condition, condition_notes, asking_price, photos, mpn, spec_values').eq('id', bikeId).maybeSingle(),
        getBikeEbayListing(bikeId).catch(() => null),
      ]);
      setBike(b as any);
      setPhotos(((b as any)?.photos as string[]) ?? []);
      setLastError(listing?.last_error ?? null);
      setListingOpts({ condition: listing?.condition ?? null, category_id: listing?.category_id ?? null, title_override: listing?.title_override ?? null });
      setTitle(listing?.title_override ?? '');
      setValues({});
      setAspectValues({});
      try {
        setPreview(await previewBikeOnEbay(bikeId));
      } catch (e) {
        setPreview(null);
        setPreviewError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [bikeId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const choices = preview?.specifics.choices ?? {};
  const parsed = useMemo(() => parseEbayError(lastError, Object.keys(choices)), [lastError, choices]);

  const blocks = preview?.checklist.filter((c) => c.level === 'block') ?? [];
  const settingsProblems = blocks.filter((c) => SETTINGS_KEYS.has(c.key));
  const titleWarn = preview?.checklist.find((c) => c.key === 'title' && c.level !== 'ok');
  const photoProblem = preview?.checklist.find((c) => c.key === 'photos' && c.level !== 'ok');

  const fieldsToFix: ReadinessField[] = bike
    ? READINESS_FIELDS.filter((f) => f.key !== 'photos' && (isFieldMissing(bike, f.key) || parsed.fields.includes(f.key)))
    : [];
  const showPhotos = !!bike && (isFieldMissing({ photos }, 'photos') || !!photoProblem || parsed.fields.includes('photos'));

  const aspectsToFix = Array.from(new Set([
    ...(preview?.specifics.missing_required ?? []),
    ...(preview?.specifics.unmapped ?? []).map((u) => u.name),
    ...parsed.aspects,
  ]));
  const unmappedValue = (name: string) => preview?.specifics.unmapped.find((u) => u.name === name)?.value;

  const knownError = !!lastError && (parsed.fields.length > 0 || parsed.aspects.length > 0);
  const nothingToFix = !loading && preview && !fieldsToFix.length && !aspectsToFix.length && !showPhotos && !settingsProblems.length && !titleWarn && !lastError;

  const save = async () => {
    if (!bikeId || !bike) return;
    setSaving(true);
    try {
      const update: Record<string, any> = {};
      for (const [k, v] of Object.entries(values)) {
        if (!v.trim()) continue;
        update[k] = k === 'asking_price' ? Number(v) : v.trim();
      }
      if (update.asking_price !== undefined && !(update.asking_price > 0)) throw new Error('Asking price must be more than £0');
      if (JSON.stringify(photos) !== JSON.stringify(bike.photos ?? [])) update.photos = photos;
      const filledAspects = Object.fromEntries(Object.entries(aspectValues).filter(([, v]) => v.trim()));
      if (Object.keys(filledAspects).length) {
        const spec = (bike.spec_values && typeof bike.spec_values === 'object') ? bike.spec_values : {};
        update.spec_values = { ...spec, ebay_aspects: { ...(spec.ebay_aspects ?? {}), ...filledAspects } };
      }
      if (Object.keys(update).length) {
        const { error } = await supabase.from('bikes').update(update as any).eq('id', bikeId);
        if (error) throw error;
        logActivity({
          bikeId, kind: 'listing', action: 'details_fixed',
          summary: `Listing details filled in: ${[...Object.keys(update).filter((k) => k !== 'spec_values'), ...Object.keys(filledAspects)].join(', ')}`,
          detail: { fields: Object.keys(update), aspects: filledAspects },
        } as any);
      }
      if (title.trim() !== (listingOpts.title_override ?? '')) {
        await saveBikeEbayOptions(bikeId, { condition: listingOpts.condition, category_id: listingOpts.category_id, title_override: title.trim() || null });
      }

      if (saveOnly) {
        toast.success('Listing details saved');
        onDone?.(false);
        onOpenChange(false);
        return;
      }

      try {
        const res = await listBikeOnEbay(bikeId);
        toast.success('Listed on eBay', { description: res.warnings?.length ? res.warnings.join(' ') : undefined });
        onDone?.(true);
        onOpenChange(false);
      } catch (e) {
        toast.error('eBay still refused', { description: (e as Error).message });
        await load();
        setLastError((e as Error).message);
      }
    } catch (e) {
      toast.error('Could not save', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: ReadinessField) => {
    const id = `fix-${f.key}`;
    const current = values[f.key] ?? (bike?.[f.key] != null ? String(bike[f.key]) : '');
    const set = (v: string) => setValues((s) => ({ ...s, [f.key]: v }));
    return (
      <div key={f.key} className="space-y-1.5">
        <Label htmlFor={id}>{f.label}{f.optional && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}</Label>
        {f.input === 'select' ? (
          <Select value={current || undefined} onValueChange={set}>
            <SelectTrigger id={id}><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>{f.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : f.input === 'textarea' ? (
          <Textarea id={id} value={current} maxLength={1000} onChange={(e) => set(e.target.value)} placeholder={f.hint} />
        ) : (
          <Input id={id} type={f.input === 'number' ? 'number' : 'text'} min={f.input === 'number' ? 0 : undefined}
            maxLength={f.input === 'text' ? 65 : undefined} value={current} onChange={(e) => set(e.target.value)} placeholder={f.hint} />
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{saveOnly ? 'Fill in listing details' : 'Fix eBay problems'}</DialogTitle>
          <DialogDescription>
            {bike ? `${bike.reference ?? ''} ${bike.make ?? ''} ${bike.model ?? ''}`.trim() : 'Loading bike…'}
            {queueLabel ? ` · ${queueLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {previewError && <p className="rounded border border-destructive/50 p-2 text-sm text-destructive">Couldn't run eBay's checks: {previewError}</p>}

            {nothingToFix && (
              <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /> Nothing left to fix — ready to list.</p>
            )}

            {settingsProblems.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Account settings (apply to every bike)</h3>
                {settingsProblems.map((c) => (
                  <div key={c.key} className="flex items-start gap-2 text-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div className="flex-1">
                      <p>{c.label}</p>
                      {canManageSettings ? (
                        <Link to="/settings?tab=integrations" className="inline-flex items-center gap-1 text-xs text-primary underline">
                          <SettingsIcon className="h-3 w-3" /> Open eBay settings
                        </Link>
                      ) : <p className="text-xs text-muted-foreground">Ask an admin to set this up.</p>}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {fieldsToFix.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Bike details</h3>
                <div className="grid gap-3 sm:grid-cols-2">{fieldsToFix.map(renderField)}</div>
              </section>
            )}

            {aspectsToFix.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">eBay item specifics</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {aspectsToFix.map((name) => {
                    const opts = choices[name] ?? [];
                    const bad = unmappedValue(name);
                    const val = aspectValues[name] ?? '';
                    const set = (v: string) => setAspectValues((s) => ({ ...s, [name]: v }));
                    return (
                      <div key={name} className="space-y-1.5">
                        <Label>{name}</Label>
                        {opts.length ? (
                          <Select value={val || undefined} onValueChange={set}>
                            <SelectTrigger><SelectValue placeholder="Choose eBay's wording…" /></SelectTrigger>
                            <SelectContent className="max-h-72">{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Input value={val} maxLength={65} onChange={(e) => set(e.target.value)} />
                        )}
                        {bad && <p className="text-xs text-muted-foreground">We had "{bad}", which eBay doesn't recognise.</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {showPhotos && bike && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Photos</h3>
                {photoProblem && <p className="text-xs text-muted-foreground">{photoProblem.label}{photoProblem.detail ? ` — ${photoProblem.detail}` : ''}</p>}
                <PhotoUpload bucket="bike-photos" path={`bike-${bike.id}`} photos={photos} onChange={setPhotos} maxPhotos={24} />
              </section>
            )}

            {titleWarn && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Title</h3>
                <p className="text-xs text-muted-foreground">{titleWarn.detail}</p>
                <Input value={title} maxLength={EBAY_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={preview?.built_title} />
                <p className="text-right text-xs text-muted-foreground">{(title || preview?.built_title || '').length}/{EBAY_TITLE_MAX}</p>
              </section>
            )}

            {lastError && (
              <section className="space-y-1 rounded border border-warning/50 bg-warning/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-warning" /> eBay's last message</p>
                <p className="break-words text-xs">{lastError}</p>
                {!knownError && <p className="text-xs text-muted-foreground">We couldn't match this to a box above — it may need changing on the bike's page.</p>}
              </section>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || loading || !bike || (!saveOnly && settingsProblems.length > 0)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saveOnly ? 'Save details' : 'Save & retry on eBay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
