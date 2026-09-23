import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Link2, Unlink, Store, BellRing, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getSquarespaceStatus, getSquarespaceAuthUrl, disconnectSquarespace, listSquarespaceStorePages,
  setSquarespaceStorePage, setupSquarespaceSales, type SquarespaceStatus,
} from '@/services/squarespace';

export default function SquarespaceIntegration() {
  const { profile } = useAuth();
  const canManage = profile?.role === 'admin' || profile?.role === 'owner';
  const [status, setStatus] = useState<SquarespaceStatus | null>(null);
  const [pages, setPages] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getSquarespaceStatus();
      setStatus(s);
      if (s.connected && canManage) {
        try { setPages((await listSquarespaceStorePages()).pages); } catch { /* non-fatal */ }
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('squarespace');
    if (!result) return;
    if (result === 'connected') toast.success('Squarespace connected');
    if (result === 'error') toast.error(`Squarespace could not be connected: ${params.get('message') ?? ''}`);
    params.delete('squarespace');
    params.delete('message');
    const qs = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, []);

  const act = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    try {
      await fn();
      if (ok) toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy('connect');
    try {
      window.location.href = (await getSquarespaceAuthUrl()).url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" /> Squarespace
          </CardTitle>
          <Badge variant={status?.connected ? 'default' : 'secondary'}>
            {status?.connected ? 'Connected' : 'Not connected'}
          </Badge>
        </div>
        <CardDescription>List bikes on your Squarespace shop and mark them sold when they sell there.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status?.connected ? (
          <>
            <div className="text-sm">
              <div className="font-medium">{status.website_title || 'Your Squarespace site'}</div>
              {status.website_url && (
                <a href={status.website_url} target="_blank" rel="noreferrer" className="text-muted-foreground underline">
                  {status.website_url}
                </a>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Store page bikes go into</Label>
              {canManage ? (
                <Select
                  value={status.store_page_id ?? ''}
                  onValueChange={(id) => {
                    const p = pages.find((x) => x.id === id);
                    act('page', () => setSquarespaceStorePage(id, p?.title ?? ''), 'Store page saved');
                  }}
                >
                  <SelectTrigger className="sm:w-80"><SelectValue placeholder="Choose a store page" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{status.store_page_title || 'Not chosen yet'}</p>
              )}
              {!status.store_page_id && (
                <p className="text-xs text-destructive">Choose a store page before listing bikes.</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              {status.live_sales ? (
                <><BellRing className="h-4 w-4 text-primary" /> Sales alerts: on — sold bikes are marked sold automatically.</>
              ) : (
                <>
                  <BellOff className="h-4 w-4 text-muted-foreground" /> Sales alerts: not set up yet
                  {canManage && (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('hook', setupSquarespaceSales, 'Sales alerts set up')}>
                      Set up
                    </Button>
                  )}
                </>
              )}
            </div>

            {canManage && (
              <Button variant="outline" disabled={!!busy} onClick={() => act('disconnect', disconnectSquarespace, 'Squarespace disconnected')}>
                <Unlink className="mr-2 h-4 w-4" /> Disconnect
              </Button>
            )}
          </>
        ) : canManage ? (
          <Button onClick={connect} disabled={!!busy}>
            {busy === 'connect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Connect Squarespace
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Ask an admin or owner to connect Squarespace.</p>
        )}
      </CardContent>
    </Card>
  );
}
