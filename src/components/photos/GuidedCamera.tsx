import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, ZapOff, Image as ImageIcon, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { assetUrl, cropFileToSquare, cropToSquareJpeg, type GuideShot } from '@/lib/photoGuide';
import { isSkippable } from '@/lib/photoGuideRules';

const SKIP_REASONS = ['Not fitted', 'Not applicable', 'Other'];

interface Props {
  shots: GuideShot[];
  index: number;
  lastThumb: string | null;
  onUse: (shot: GuideShot, blob: Blob, width: number, height: number) => void;
  onSkip: (shot: GuideShot, reason: string) => void;
  /** Called after each capture/skip; returns next index or -1 when all done. */
  nextIndex: (after: number, justDone: string) => number;
  onClose: () => void;
}

export default function GuidedCamera({ shots, index: startIndex, lastThumb, onUse, onSkip, nextIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const shot = shots[index];
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'starting' | 'live' | 'fallback'>('starting');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [review, setReview] = useState<{ blob: Blob; url: string; width: number; height: number } | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let wakeLock: any = null;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setMode('fallback'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        const caps: any = stream.getVideoTracks()[0]?.getCapabilities?.() ?? {};
        if (caps.torch) setTorch(false);
        setMode('live');
      } catch { setMode('fallback'); }
      try { wakeLock = await (navigator as any).wakeLock?.request('screen'); } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      wakeLock?.release?.().catch(() => {});
    };
  }, []);

  useEffect(() => () => { if (review) URL.revokeObjectURL(review.url); }, [review]);

  const toggleTorch = async () => {
    const track: any = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch { /* ignore */ }
  };

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const r = await cropToSquareJpeg(v, v.videoWidth, v.videoHeight);
    setReview({ ...r, url: URL.createObjectURL(r.blob) });
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    const r = await cropFileToSquare(f);
    setReview({ ...r, url: URL.createObjectURL(r.blob) });
  };

  const advance = useCallback((doneId: string) => {
    const n = nextIndex(index, doneId);
    if (n < 0) onClose(); else setIndex(n);
  }, [index, nextIndex, onClose]);

  const use = () => {
    if (!review) return;
    onUse(shot, review.blob, review.width, review.height);
    setReview(null);
    advance(shot.id);
  };

  if (!shot) return null;
  const nonDrive = /non-drive/i.test(shot.side);

  return (
    <div className="camera-surface fixed inset-0 z-[100] flex flex-col overflow-hidden">
      {/* Top band */}
      <div className="flex flex-1 flex-col justify-end gap-2 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex items-center gap-2 text-sm">
          <button aria-label="Close camera" onClick={onClose} className="rounded-full p-2 hover:bg-[hsl(var(--camera-muted))]"><X className="h-5 w-5" /></button>
          <span className="font-medium tabular-nums">{shot.n} / {shots.length}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${nonDrive ? 'bg-[hsl(var(--camera-accent))] text-[hsl(var(--camera-bg))]' : 'bg-[hsl(var(--camera-muted))]'}`}>{shot.side}</span>
          <span className="truncate opacity-80">{shot.title}</span>
          {torch !== null && !review && (
            <button aria-label="Torch" onClick={toggleTorch} className="ml-auto rounded-full p-2">{torch ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}</button>
          )}
        </div>
        <p className="text-xl font-semibold leading-snug sm:text-2xl">{review ? shot.check : shot.prompt}</p>
      </div>

      {/* Square viewfinder */}
      <div className="relative mx-auto aspect-square w-full max-w-[min(100vw,calc(100dvh-260px))] shrink-0 overflow-hidden bg-[hsl(var(--camera-muted))]">
        <video ref={videoRef} playsInline muted autoPlay className={`absolute inset-0 h-full w-full object-cover ${review || mode !== 'live' ? 'invisible' : ''}`} />
        {review && <img src={review.url} alt="Captured" className="absolute inset-0 h-full w-full object-cover" />}
        {mode === 'fallback' && !review && (
          <p className="absolute inset-x-0 bottom-3 px-6 text-center text-sm opacity-80">Camera not available here — tap the shutter to use your phone's camera, framed like the outline.</p>
        )}
        <img src={assetUrl(shot.overlay)} alt="" aria-hidden
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: review ? 0.3 : 1 }} />
      </div>

      {/* Bottom band */}
      <div className="flex flex-1 items-center justify-between gap-3 px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
        {review ? (
          <>
            <Button variant="outline" size="lg" className="flex-1 bg-transparent" onClick={() => setReview(null)}>Retake</Button>
            <Button size="lg" className="flex-1" onClick={use}>Use photo</Button>
          </>
        ) : (
          <>
            <div className="flex w-20 flex-col items-start gap-2">
              {lastThumb ? <img src={lastThumb} alt="Last photo" className="h-14 w-14 rounded-md object-cover" /> : <div className="h-14 w-14 rounded-md border border-[hsl(var(--camera-muted))]" />}
              {isSkippable(shot) && <button className="text-xs underline opacity-80" onClick={() => setSkipOpen(true)}>Skip</button>}
            </div>
            <button aria-label="Take photo" disabled={mode === 'starting'}
              onClick={() => (mode === 'live' ? capture() : fileRef.current?.click())}
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[hsl(var(--camera-fg))] disabled:opacity-40">
              <span className="h-16 w-16 rounded-full bg-[hsl(var(--camera-fg))]" />
            </button>
            <div className="flex w-20 justify-end">
              {shot.example ? (
                <button className="flex flex-col items-center text-xs" onClick={() => setShowExample(true)}><ImageIcon className="mb-1 h-6 w-6" />Example</button>
              ) : (
                <button className="flex flex-col items-center text-xs opacity-80" onClick={() => setShowExample(true)}><Camera className="mb-1 h-6 w-6" />Tips</button>
              )}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <Sheet open={showExample} onOpenChange={setShowExample}>
        <SheetContent side="bottom" className="z-[110] max-h-[85dvh] overflow-y-auto">
          <SheetHeader><SheetTitle>{shot.n}. {shot.title}</SheetTitle></SheetHeader>
          {shot.example && <img src={assetUrl(shot.example)} alt={`Example: ${shot.title}`} className="mx-auto mt-3 aspect-square w-full max-w-md rounded-md object-cover" />}
          <p className="mt-3 text-sm">{shot.instruction}</p>
          <p className="mt-2 text-sm text-muted-foreground">Check: {shot.check}</p>
        </SheetContent>
      </Sheet>

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent className="z-[110]">
          <DialogHeader><DialogTitle>Skip {shot.title}?</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            {SKIP_REASONS.map((r) => (
              <Button key={r} variant="outline" onClick={() => { setSkipOpen(false); onSkip(shot, r); advance(shot.id); }}>{r}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
