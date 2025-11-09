import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Truck, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getCycleCourierIntegration,
  saveCycleCourierApiKey,
  testCycleCourierConnection,
  deactivateCycleCourierIntegration,
  getWebhookUrl,
  type Integration,
  type BpsReceiverSettings,
} from '@/services/integrations';

export default function CycleCourierIntegration() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  
  // BPS Receiver Address fields
  const [bpsName, setBpsName] = useState('Brighton Premium Storage');
  const [bpsEmail, setBpsEmail] = useState('');
  const [bpsPhone, setBpsPhone] = useState('');
  const [bpsStreet, setBpsStreet] = useState('');
  const [bpsCity, setBpsCity] = useState('');
  const [bpsPostcode, setBpsPostcode] = useState('');
  const [bpsCountry, setBpsCountry] = useState('UK');

  const webhookUrl = getWebhookUrl();

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    try {
      setLoading(true);
      const data = await getCycleCourierIntegration();
      setIntegration(data);
      if (data?.api_key) {
        setApiKey(data.api_key);
      }
      if (data?.webhook_secret) {
        setWebhookSecret(data.webhook_secret);
      }
      // Load BPS receiver settings if available
      if (data?.settings && typeof data.settings === 'object' && 'bps_receiver' in data.settings) {
        const bpsReceiver = data.settings.bps_receiver as unknown as BpsReceiverSettings;
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

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    if (!webhookSecret.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a webhook secret',
        variant: 'destructive',
      });
      return;
    }

    if (!bpsName.trim() || !bpsEmail.trim() || !bpsPhone.trim() || 
        !bpsStreet.trim() || !bpsCity.trim() || !bpsPostcode.trim() || !bpsCountry.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill in all BPS delivery address fields',
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
        address: {
          street: bpsStreet,
          city: bpsCity,
          postcode: bpsPostcode,
          country: bpsCountry,
        },
      };
      const updated = await saveCycleCourierApiKey(apiKey, webhookSecret, bpsReceiver, integration);
      setIntegration(updated);
      toast({
        title: 'Success',
        description: 'Integration saved successfully',
      });
    } catch (error) {
      console.error('Error saving integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save integration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an API key',
        variant: 'destructive',
      });
      return;
    }

    try {
      setTesting(true);
      const success = await testCycleCourierConnection(apiKey);
      
      if (success) {
        toast({
          title: 'Success',
          description: 'Connection test successful',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Connection test failed. Please check your API key.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to test connection',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };


  const handleDisconnect = async () => {
    if (!integration) return;

    try {
      await deactivateCycleCourierIntegration(integration.id);
      await loadIntegration();
      toast({
        title: 'Success',
        description: 'Integration disconnected',
      });
    } catch (error) {
      console.error('Error disconnecting integration:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect integration',
        variant: 'destructive',
      });
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

  return (
    <>
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
            <Badge variant={integration?.is_active ? 'default' : 'secondary'}>
              {integration?.is_active ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Cycle Courier Co API key"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Used for making API calls to Cycle Courier Co
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Secret</Label>
              <div className="flex gap-2">
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
                    {showWebhookSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Provided by Cycle Courier Co for webhook signature verification
              </p>
            </div>
          </div>

          {/* BPS Delivery Address Section */}
          <div className="space-y-4 pt-4 border-t">
            <div>
              <h4 className="font-medium mb-1">Delivery Address Configuration</h4>
              <p className="text-sm text-muted-foreground">
                Configure the BPS warehouse address where bikes will be delivered
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="bpsName">Recipient Name</Label>
                <Input
                  id="bpsName"
                  value={bpsName}
                  onChange={(e) => setBpsName(e.target.value)}
                  placeholder="e.g., Brighton Premium Storage"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bpsEmail">Email</Label>
                <Input
                  id="bpsEmail"
                  type="email"
                  value={bpsEmail}
                  onChange={(e) => setBpsEmail(e.target.value)}
                  placeholder="delivery@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bpsPhone">Phone</Label>
                <Input
                  id="bpsPhone"
                  type="tel"
                  value={bpsPhone}
                  onChange={(e) => setBpsPhone(e.target.value)}
                  placeholder="+44 1234 567890"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="bpsStreet">Street Address</Label>
                <Input
                  id="bpsStreet"
                  value={bpsStreet}
                  onChange={(e) => setBpsStreet(e.target.value)}
                  placeholder="123 Storage Lane"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bpsCity">City</Label>
                <Input
                  id="bpsCity"
                  value={bpsCity}
                  onChange={(e) => setBpsCity(e.target.value)}
                  placeholder="Brighton"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bpsPostcode">Postcode</Label>
                <Input
                  id="bpsPostcode"
                  value={bpsPostcode}
                  onChange={(e) => setBpsPostcode(e.target.value)}
                  placeholder="BN1 1AA"
                />
              </div>

              <div className="col-span-2 space-y-2">
                <Label htmlFor="bpsCountry">Country</Label>
                <Input
                  id="bpsCountry"
                  value={bpsCountry}
                  onChange={(e) => setBpsCountry(e.target.value)}
                  placeholder="UK"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !apiKey.trim()}
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              {integration?.is_active && (
                <Button variant="destructive" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              )}
            </div>
          </div>

          {/* Webhook URL Section */}
          {integration?.is_active && (
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
                  <Input
                    id="webhookUrl"
                    value={webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyToClipboard(webhookUrl, 'Webhook URL')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure this webhook endpoint in your Cycle Courier Co dashboard
                </p>
              </div>
            </div>
          )}

          {/* Documentation Link */}
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
    </>
  );
}
