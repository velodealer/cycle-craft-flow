import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ClipboardCheck, Copy, ExternalLink, Link2, AlertTriangle, BellRing, BellOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  getInspectABikeStatus,
  getInspectABikeAuthUrl,
  disconnectInspectABike,
  fetchInspectABikeWebhookSecret,
  type InspectABikeStatus,
} from '@/services/inspectabike';

export default function InspectABikeIntegration() {
  const { isSuperAdmin, profile } = useAuth();
  const canManage = profile?.role === 'admin' || profile?.role === 'owner';
  const [status, setStatus] = useState<InspectABikeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fetchingKey, setFetchingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const result = params.get('inspectabike');
    if (result === 'connected') {
      toast({ title: 'Connected', description: 'InspectABike account connected' });
    } else if (result === 'error') {
      toast({
        title: 'Could not connect',
        description: params.get('message') || 'Please try again',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (canManage && status?.connected && !status.has_webhook_secret && !autoTried.current) {
      autoTried.current = true;
      getKey(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canManage]);

  const load = async () => {
    try {
      setLoading(true);
      setStatus(await getInspectABikeStatus());
    } catch (e) {
      console.error('InspectABike status failed', e);
    } finally {
      setLoading(false);
    }
  };

  const getKey = async (quiet = false) => {
    try {
      setFetchingKey(true);
      setKeyError(null);
      await fetchInspectABikeWebhookSecret();
      if (!quiet) toast({ title: 'Live updates ready', description: 'Signing key saved' });
      setStatus(await getInspectABikeStatus());
    } catch (e) {
      setKeyError((e as Error).message);
      if (!quiet) toast({ title: 'Could not get signing key', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setFetchingKey(false);
    }
  };

  const connect = async () => {
    try {
      setConnecting(true);
      const { url } = await getInspectABikeAuthUrl();
      window.location.href = url;
    } catch (e) {
      toast({
        title: 'Could not start the connection',
        description: (e as Error).message,
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectInspectABike();
      toast({ title: 'Disconnected', description: 'InspectABike account removed' });
      load();
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              InspectABike
            </CardTitle>
            <CardDescription>
              Connect your own InspectABike account. Inspections are created automatically when a
              bike reaches the inspection stage, and faults come back on their own.
            </CardDescription>
          </div>
          {status?.connected ? (
            <Badge variant="success">Connected</Badge>
          ) : status?.needs_reconnect ? (
            <Badge variant="destructive">Reconnect needed</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !status?.configured ? (
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              InspectABike has not issued app credentials for VeloDealer yet. Once they do, saving
              them here enables the Connect button.
            </span>
          </div>
        ) : status.connected ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected{status.account_name ? ` as ${status.account_name}` : ''}
              {status.connected_at
                ? ` on ${new Date(status.connected_at).toLocaleDateString()}`
                : ''}
              .
            </p>
            <Button variant="outline" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {status.needs_reconnect && status.last_error && (
              <p className="text-sm text-destructive">{status.last_error}</p>
            )}
            <Button onClick={connect} disabled={connecting}>
              <Link2 className="mr-2 h-4 w-4" />
              {status.needs_reconnect ? 'Reconnect InspectABike' : 'Connect InspectABike'}
            </Button>
          </div>
        )}

        {status?.configured && status.connected &&
          (status.has_webhook_secret ? (
            <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Live updates: ready — faults from InspectABike arrive here on their own.</span>
            </div>
          ) : (
            <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              <div className="flex items-start gap-2">
                <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {fetchingKey
                    ? 'Live updates: getting the signing key from InspectABike…'
                    : `Live updates: not set up yet${keyError ? ` — ${keyError}` : ''}.${
                        status.has_platform_webhook_secret ? ' Using the shared backup key for now.' : ''
                      }`}
                </span>
              </div>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => getKey()} disabled={fetchingKey}>
                  Get signing key
                </Button>
              )}
            </div>
          ))}

        {isSuperAdmin && status && (
          <div className="space-y-2 pt-2">
            <Label className="text-xs text-muted-foreground">Fault updates are sent to</Label>
            <div className="flex gap-2">
              <Input readOnly value={status.webhook_url} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copy(status.webhook_url, 'Webhook address')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <a
              href="https://inspectabike.com/docs/api"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              InspectABike API documentation <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
