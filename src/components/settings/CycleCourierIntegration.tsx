import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Truck, Eye, EyeOff, Copy, ExternalLink, Link2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  getCycleCourierIntegration,
  saveCycleCourierSettings,
  getCycleCourierStatus,
  getCycleCourierAuthUrl,
  disconnectCycleCourier,
  getWebhookUrl,
  type Integration,
  type BpsReceiverSettings,
  type CycleCourierStatus,
} from '@/services/integrations';

export default function CycleCourierIntegration() {
  const { isSuperAdmin } = useAuth();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [status, setStatus] = useState<CycleCourierStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Delivery (BPS) receiver address fields
  const [bpsName, setBpsName] = useState('Brighton Premium Storage');
  const [bpsEmail, setBpsEmail] = useState('');
  const [bpsPhone, setBpsPhone] = useState('');
  const [bpsStreet, setBpsStreet] = useState('');
  const [bpsCity, setBpsCity] = useState('');
  const [bpsPostcode, setBpsPostcode] = useState('');
  const [bpsCountry, setBpsCountry] = useState('UK');

  const webhookUrl = getWebhookUrl();

  useEffect(() => {
    loadAll();
    const params = new URLSearchParams(window.location.search);
    const result = params.get('cyclecourier');
    if (result === 'connected') {
      toast({ title: 'Connected', description: 'Cycle Courier account connected' });
    } else if (result === 'error') {
      toast({
        title: 'Could not connect',
        description: params.get('message') || 'Please try again',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [data, statusData] = await Promise.all([
        getCycleCourierIntegration(),
        getCycleCourierStatus().catch(() => null),
      ]);
      setIntegration(data);
      setStatus(statusData);
      if (data?.webhook_secret) setWebhookSecret(data.webhook_secret);
      if (data?.settings && typeof data.settings === 'object' && 'bps_receiver' in data.settings) {
        const bpsReceiver = (data.settings as Record<string, unknown>).bps_receiver as unknown as BpsReceiverSettings;
        setBpsName(bpsReceiver.name || 'Brighton Premium Storage');
        setBpsEmail(bpsReceiver.email || '');
        setBpsPhone(bpsReceiver.phone || '');
        setBpsStreet(bpsReceiver.address?.street || '');
        setBpsCity(bpsReceiver.address?.city || '');
        setBpsPostcode(bpsReceiver.address?.postcode || '');
        setBpsCountry(bpsReceiver.address?.country || 'UK');
      }
    } catch (error) {
      console.error('Error loading integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integration settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { url } = await getCycleCourierAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast({
        title: 'Could not start the connection',
        description: (error as Error).message,
        variant: 'destructive',
      });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectCycleCourier();
      await loadAll();
      toast({ title: 'Disconnected', description: 'Cycle Courier account disconnected' });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!webhookSecret.trim()) {
      toast({ title: 'Error', description: 'Please enter a webhook secret', variant: 'destructive' });
      return;
    }

    if (!bpsName.trim() || !bpsEmail.trim() || !bpsPhone.trim() ||
        !bpsStreet.trim() || !bpsCity.trim() || !bpsPostcode.trim() || !bpsCountry.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all delivery address fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const bpsReceiver: BpsReceiverSettings = {
        name: bpsName,
        email: bpsEmail,
        phone: bpsPhone,
        address: { street: bpsStreet, city: bpsCity, postcode: bpsPostcode, country: bpsCountry },
      };
      const updated = await saveCycleCourierSettings(webhookSecret, bpsReceiver, integration);
      setIntegration(updated);
      toast({ title: 'Saved', description: 'Settings saved successfully' });
    } catch (error) {
      console.error('Error saving integration:', error);
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Cycle Courier Co</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const connected = Boolean(status?.connected);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Cycle Courier Co</CardTitle>
              <CardDescription>Bike delivery and logistics integration</CardDescription>
            </div>
          </div>
          <Badge variant={connected ? 'default' : 'secondary'}>
            {connected ? 'Connected' : status?.needs_reconnect ? 'Reconnect needed' : 'Not Connected'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Account connection */}
        <div className="space-y-3">
          {status && !status.configured && (
            <p className="text-sm text-muted-foreground">
              The Cycle Courier app details haven't been set up yet. Ask Cycle Courier to register
              VeloDealer with this return address, then save the App ID and secret they send back:
              <span className="mt-1 block font-mono text-xs break-all">{status.callback_url}</span>
            </p>
          )}

          {status?.needs_reconnect && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <p className="text-sm">
                The Cycle Courier connection has stopped working, so bookings will fail. Please
                connect the account again.
              </p>
            </div>
          )}

          {connected && (
            <p className="text-sm text-muted-foreground">
              Connected{status?.account_name ? ` as ${status.account_name}` : ''}
              {status?.connected_at
                ? ` on ${new Date(status.connected_at).toLocaleDateString()}`
                : ''}
              . Collections and deliveries are booked on this account.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleConnect}
              disabled={connecting || !status?.configured}
              variant={connected ? 'outline' : 'default'}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {connecting
                ? 'Opening Cycle Courier...'
                : connected
                  ? 'Reconnect account'
                  : 'Connect Cycle Courier account'}
            </Button>
            {(connected || status?.needs_reconnect) && (
              <Button variant="destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* Webhook secret */}
        <div className="space-y-2 pt-4 border-t">
          <Label htmlFor="webhookSecret">Webhook Secret</Label>
          <div className="relative flex-1">
            <Input
              id="webhookSecret"
              type={showWebhookSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Enter webhook secret from Cycle Courier Co"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowWebhookSecret(!showWebhookSecret)}
            >
              {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Provided by Cycle Courier Co for webhook signature verification
          </p>
        </div>

        {/* Delivery address */}
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="font-medium mb-1">Delivery Address Configuration</h4>
            <p className="text-sm text-muted-foreground">
              Configure the warehouse address where bikes will be delivered
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="bpsName">Recipient Name</Label>
              <Input id="bpsName" value={bpsName} onChange={(e) => setBpsName(e.target.value)} placeholder="e.g., Brighton Premium Storage" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bpsEmail">Email</Label>
              <Input id="bpsEmail" type="email" value={bpsEmail} onChange={(e) => setBpsEmail(e.target.value)} placeholder="delivery@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bpsPhone">Phone</Label>
              <Input id="bpsPhone" type="tel" value={bpsPhone} onChange={(e) => setBpsPhone(e.target.value)} placeholder="+44 1234 567890" />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="bpsStreet">Street Address</Label>
              <Input id="bpsStreet" value={bpsStreet} onChange={(e) => setBpsStreet(e.target.value)} placeholder="123 Storage Lane" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bpsCity">City</Label>
              <Input id="bpsCity" value={bpsCity} onChange={(e) => setBpsCity(e.target.value)} placeholder="Brighton" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bpsPostcode">Postcode</Label>
              <Input id="bpsPostcode" value={bpsPostcode} onChange={(e) => setBpsPostcode(e.target.value)} placeholder="BN1 1AA" />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="bpsCountry">Country</Label>
              <Input id="bpsCountry" value={bpsCountry} onChange={(e) => setBpsCountry(e.target.value)} placeholder="UK" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Webhook URL */}
        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="font-medium mb-1">Webhook Configuration</h4>
            <p className="text-sm text-muted-foreground">
              Provide this URL to Cycle Courier Co to receive delivery updates
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <div className="flex gap-2">
              <Input id="webhookUrl" value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => handleCopyToClipboard(webhookUrl, 'Webhook URL')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://booking.cyclecourierco.com/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View API Documentation
            </a>
          </Button>
        </div>

        {integration?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(integration.updated_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
