import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Truck, Eye, EyeOff, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  getCycleCourierIntegration,
  saveCycleCourierApiKey,
  testCycleCourierConnection,
  regenerateWebhookSecret,
  deactivateCycleCourierIntegration,
  getWebhookUrl,
  type Integration,
} from '@/services/integrations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CycleCourierIntegration() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

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

    try {
      setSaving(true);
      const updated = await saveCycleCourierApiKey(apiKey, integration);
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

  const handleRegenerateSecret = async () => {
    if (!integration) return;

    try {
      const newSecret = await regenerateWebhookSecret(integration.id);
      setIntegration({ ...integration, webhook_secret: newSecret });
      setShowRegenerateDialog(false);
      toast({
        title: 'Success',
        description: 'Webhook secret regenerated successfully',
      });
    } catch (error) {
      console.error('Error regenerating webhook secret:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate webhook secret',
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
            </div>

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

          {/* Webhook Configuration Section */}
          {integration?.webhook_secret && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <h4 className="font-medium mb-1">Webhook Configuration</h4>
                <p className="text-sm text-muted-foreground">
                  Provide these details to Cycle Courier Co to receive delivery updates
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookSecret">Webhook Secret</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookSecret"
                    value={integration.webhook_secret}
                    readOnly
                    type="password"
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      handleCopyToClipboard(integration.webhook_secret!, 'Webhook Secret')
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowRegenerateDialog(true)}
                    title="Regenerate webhook secret"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Include this secret in the X-Webhook-Secret header when calling the webhook
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

      {/* Regenerate Webhook Secret Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Webhook Secret?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new webhook secret. You'll need to update the secret in
              your Cycle Courier Co configuration. The old secret will stop working
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateSecret}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
