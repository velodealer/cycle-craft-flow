import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { FailedSync, kindLabel, listFailedSyncs, retryFailedSync } from '@/lib/failedSyncs';

const ALLOWED = ['admin', 'owner', 'accountant'];

/** Dashboard list of QuickBooks/Xero postings that failed, each with a Retry button. Hidden when there are none. */
export default function FailedSyncsCard() {
  const { profile } = useAuth();
  const allowed = !!profile && ALLOWED.includes(String((profile as any).role));
  const [items, setItems] = useState<FailedSync[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listFailedSyncs());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed || (items.length === 0 && !loadError)) return null;

  const retry = async (s: FailedSync) => {
    setBusy(s.key);
    const err = await retryFailedSync(s);
    setBusy(null);
    if (err) toast.error(`${s.system} still failing: ${err}`);
    else toast.success(`Sent to ${s.system}`);
    load();
  };

  const retryAll = async () => {
    setBusy('all');
    let ok = 0;
    for (const s of items) if (!(await retryFailedSync(s))) ok++;
    setBusy(null);
    toast[ok === items.length ? 'success' : 'warning'](`${ok} of ${items.length} sent`);
    load();
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Failed accounting syncs ({items.length})
        </CardTitle>
        {items.length > 1 && (
          <Button size="sm" variant="outline" onClick={retryAll} disabled={!!busy}>
            {busy === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Retry all
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loadError && <p className="text-sm text-destructive">Couldn't load failed syncs: {loadError}</p>}
        {items.map((s) => (
          <div key={s.key} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{s.system}</Badge>
                <span className="text-sm font-medium">{kindLabel(s.kind)}</span>
                <Link to={s.link} className="truncate text-sm text-primary hover:underline">{s.label}</Link>
              </div>
              {s.error && <p className="mt-1 break-words text-xs text-muted-foreground">{s.error}</p>}
            </div>
            <Button size="sm" onClick={() => retry(s)} disabled={!!busy}>
              {busy === s.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Retry
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
