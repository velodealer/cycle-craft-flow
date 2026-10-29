import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Loader2, RotateCw, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { bikeRef } from '@/lib/bikeReference';
import GuidedCamera from '@/components/photos/GuidedCamera';
import {
  assetUrl, cropFileToSquare, loadPhotoGuide, publicPhotoUrl, saveShot, skipShot,
  type BikePhotoRow, type GuideShot, type PhotoGuide,
} from '@/lib/photoGuide';
import { canContinueToListing, firstMissingIndex, isSkippable, orderedCaptured } from '@/lib/photoGuideRules';
import { syncShopifyQuietly } from '@/services/shopify';
import { syncEbayQuietly } from '@/services/ebay';

type UploadState = 'uploading' | 'saved' | 'failed';
interface Pending { blob: Blob; width: number; height: number; url: string }
const HOWTO_KEY = 'vd-photo-howto-seen';

export default function BikePhotosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bike, setBike] = useState<any>(null);
  const [guide, setGuide] = useState<PhotoGuide | null>(null);
  const [rows, setRows] = useState<BikePhotoRow[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadState>>({});
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [cameraAt, setCameraAt] = useState<number | null>(null);
  const [howtoOpen, setHowtoOpen] = useState(() => !localStorage.getItem(HOWTO_KEY));
  const [drops, setDrops] = useState<{ file: File; shotId: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: b }, { data: r }, g] = await Promise.all([
      supabase.from('bikes').select('id, business_id, reference, make, model, year, status, listing_photos').eq('id', id).maybeSingle(),
      supabase.from('bike_photos' as any).select('*').eq('bike_id', id),
      loadPhotoGuide(),
    ]);
    setBike(b); setRows(((r as any[]) ?? []) as BikePhotoRow[]); setGuide(g);
  }, [id]);
  useEffect(() => { load().catch((e) => toast({ title: 'Could not load', description: e.message, variant: 'destructive' })); }, [load]);
  useEffect(() => { if (!howtoOpen) localStorage.setItem(HOWTO_KEY, '1'); }, [howtoOpen]);

  const shots = guide?.shots ?? [];
  // A shot counts as done once captured locally, even while it is still uploading.
  const records = useMemo(() => {
    const m = new Map(rows.map((r) => [r.shot_id, { shot_id: r.shot_id, status: r.status }]));
    for (const k of Object.keys(pending)) if (uploads[k] !== 'failed') m.set(k, { shot_id: k, status: 'captured' });
    return [...m.values()];
  }, [rows, pending, uploads]);
  const doneCount = records.length;
  const anyUploading = Object.values(uploads).some((u) => u === 'uploading' || u === 'failed');
  const ready = canContinueToListing(shots, records) && !anyUploading;

  const upload = useCallback(async (shot: GuideShot, p: Pending) => {
    if (!bike) return;
    setUploads((u) => ({ ...u, [shot.id]: 'uploading' }));
    try {
      const row = await saveShot(bike, shot, p.blob, p.width, p.height);
      setRows((rs) => [...rs.filter((x) => x.shot_id !== shot.id), row]);
      setUploads((u) => ({ ...u, [shot.id]: 'saved' }));
    } catch {
      setUploads((u) => ({ ...u, [shot.id]: 'failed' }));
    }
  }, [bike]);

  const capture = useCallback((shot: GuideShot, blob: Blob, width: number, height: number) => {
    const p = { blob, width, height, url: URL.createObjectURL(blob) };
    setPending((ps) => ({ ...ps, [shot.id]: p }));
    void upload(shot, p);
  }, [upload]);

  const skip = useCallback(async (shot: GuideShot, reason: string) => {
    if (!bike) return;
    try {
      const row = await skipShot(bike.id, shot, reason);
      setRows((rs) => [...rs.filter((x) => x.shot_id !== shot.id), row]);
      setPending((ps) => { const n = { ...ps }; delete n[shot.id]; return n; });
    } catch (e: any) { toast({ title: 'Could not skip', description: e.message, variant: 'destructive' }); }
  }, [bike]);

  const nextIndex = useCallback((after: number, justDone: string) => {
    const recs = [...records.filter((r) => r.shot_id !== justDone), { shot_id: justDone, status: 'captured' as const }];
    return firstMissingIndex(shots, recs, after + 1);
  }, [records, shots]);

  const thumbFor = (shotId: string) => {
    if (pending[shotId]) return pending[shotId].url;
    const r = rows.find((x) => x.shot_id === shotId);
    return r?.status === 'captured' ? publicPhotoUrl(r) : null;
  };
  const lastThumb = useMemo(() => {
    const keys = Object.keys(pending);
    return keys.length ? pending[keys[keys.length - 1]].url : null;
  }, [pending]);

  const start = () => {
    const i = firstMissingIndex(shots, records);
    setCameraAt(i < 0 ? 0 : i);
  };

  // Desktop uploads: each file goes to the next missing slot by default.
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const taken = new Set([...records.map((r) => r.shot_id), ...drops.map((d) => d.shotId)]);
    const free = shots.filter((s) => !taken.has(s.id)).map((s) => s.id);
    setDrops((d) => [...d, ...Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
      .map((file, i) => ({ file, shotId: free[i] ?? shots[0]?.id }))]);
  };
  const saveDrops = async () => {
    setBusy(true);
    try {
      for (const d of drops) {
        const shot = shots.find((s) => s.id === d.shotId);
        if (!shot) continue;
        try {
          const r = await cropFileToSquare(d.file);
          capture(shot, r.blob, r.width, r.height);
        } catch { toast({ title: `Could not read ${d.file.name}`, description: 'Try a JPG or PNG file.', variant: 'destructive' }); }
      }
      setDrops([]);
    } finally { setBusy(false); }
  };

  const continueToListing = async () => {
    if (!bike || !ready) return;
    setBusy(true);
    try {
      const urls = orderedCaptured(rows).map((r) => publicPhotoUrl(r)).filter(Boolean) as string[];
      const { error } = await supabase.from('bikes').update({ listing_photos: urls } as any).eq('id', bike.id);
      if (error) throw error;
      if (bike.status === 'photos') {
        const { error: e2 } = await supabase.rpc('change_bike_stage' as any, {
          _bike_id: bike.id, _status: 'ready', _summary: 'Moved to Ready for Sale',
          _fulfilment_note: `${urls.length} guided photo(s) set as listing images.`,
        });
        if (e2) throw e2;
      }
      void syncShopifyQuietly(bike.id, 'list');
      void syncEbayQuietly(bike.id, 'list');
      toast({ title: 'Listing photos set', description: `${urls.length} photos, shot 1 as the main image.` });
      navigate(`/bikes/${bike.id}`);
    } catch (e: any) {
      toast({ title: 'Could not continue', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (!bike || !guide) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-5 py-4 pb-28">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" asChild><Link to={`/bikes/${bike.id}`}><ChevronLeft className="mr-1 h-4 w-4" />Bike</Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{[bike.year, bike.make, bike.model].filter(Boolean).join(' ')}</h1>
          <p className="text-sm text-muted-foreground">{bikeRef(bike)} · Photos · <span className="tabular-nums">{doneCount} of {shots.length}</span></p>
        </div>
      </div>

      <Collapsible open={howtoOpen} onOpenChange={setHowtoOpen}>
        <Card>
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left font-medium">
            How to take the photos <ChevronDown className={`h-4 w-4 transition-transform ${howtoOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-0 text-sm text-muted-foreground">
              <p>Take 18 square photos in order. Line the bike up with the white outline on screen; dashed lines are rough guides, and the amber corners mark what must be sharp and readable.</p>
              <p>Shots 1–3 are required. Shots 17 and 18 are taken from the non-drive (left) side; everything else is drive side or from above.</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {guide.sections.map((s) => <li key={s.id}><span className="font-medium text-foreground">{s.title}</span> — {s.hint}</li>)}
              </ul>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {guide.sections.map((sec) => {
        const list = shots.filter((s) => s.section === sec.id);
        if (!list.length) return null;
        return (
          <section key={sec.id} className="space-y-2">
            <h2 className="label-text">{sec.title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((s) => {
                const idx = shots.indexOf(s);
                const row = rows.find((r) => r.shot_id === s.id);
                const thumb = thumbFor(s.id);
                const up = uploads[s.id];
                const skipped = !pending[s.id] && row?.status === 'skipped';
                return (
                  <div key={s.id} className="space-y-1">
                    <button onClick={() => (up === 'failed' && pending[s.id] ? upload(s, pending[s.id]) : setCameraAt(idx))}
                      className="camera-surface relative block aspect-square w-full overflow-hidden rounded-md border border-border">
                      {thumb ? <img src={thumb} alt={s.title} className="h-full w-full object-cover" loading="lazy" />
                        : skipped ? <span className="absolute inset-0 flex items-center justify-center text-sm opacity-80">Skipped{row?.skip_reason ? ` · ${row.skip_reason}` : ''}</span>
                        : <img src={assetUrl(s.overlay)} alt="" className="h-full w-full p-2 opacity-80" loading="lazy" />}
                      <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 text-xs font-medium text-foreground">{s.n}</span>
                      {up === 'uploading' && <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 text-xs text-foreground"><Loader2 className="h-3 w-3 animate-spin" />Uploading</span>}
                      {up === 'saved' && <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 text-xs text-foreground"><CheckCircle2 className="h-3 w-3" />Saved</span>}
                      {up === 'failed' && <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-destructive px-1.5 text-xs text-destructive-foreground"><RotateCw className="h-3 w-3" />Failed — tap to retry</span>}
                    </button>
                    <div className="flex flex-wrap items-center gap-1 text-sm">
                      <span className="truncate">{s.title}</span>
                      {/non-drive/i.test(s.side) && <Badge variant="secondary" className="text-[10px]">Non-drive side</Badge>}
                      {!isSkippable(s) && <span className="text-xs text-muted-foreground">required</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Desktop upload */}
      <Card className="hidden md:block">
        <CardContent className="space-y-3 p-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            <Upload className="h-5 w-5" />Upload photos — drop images here or click to choose. Each is cropped to a centred square.
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          {drops.length > 0 && (
            <div className="space-y-2">
              {drops.map((d, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{d.file.name}</span>
                  <Select value={d.shotId} onValueChange={(v) => setDrops((ds) => ds.map((x, j) => (j === i ? { ...x, shotId: v } : x)))}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>{shots.map((s) => <SelectItem key={s.id} value={s.id}>{s.n}. {s.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setDrops((ds) => ds.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <Button onClick={saveDrops} disabled={busy}>Save {drops.length} photo{drops.length === 1 ? '' : 's'}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="container mx-auto flex max-w-5xl gap-2">
          <Button className="flex-1" size="lg" onClick={start}>{doneCount > 0 ? 'Continue photos' : 'Start photos'}</Button>
          <Button className="flex-1" size="lg" variant="outline" disabled={!ready || busy} onClick={continueToListing}>
            {bike.status === 'photos' ? 'Continue to listing' : 'Use as listing photos'}
          </Button>
        </div>
      </div>

      {cameraAt !== null && (
        <GuidedCamera shots={shots} index={cameraAt} lastThumb={lastThumb}
          onUse={capture} onSkip={skip} nextIndex={nextIndex} onClose={() => setCameraAt(null)} />
      )}
    </div>
  );
}
