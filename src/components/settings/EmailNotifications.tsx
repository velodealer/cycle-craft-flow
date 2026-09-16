import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { isSuperAdmin } from '@/lib/superAdmin';
import { Mail, Save, Send } from 'lucide-react';

type Mode = 'roles' | 'addresses';

interface NotificationSetting {
  enabled: boolean;
  mode: Mode;
  addresses: string[];
}

interface EmailSettings {
  enabled: boolean;
  from_address: string;
  app_url: string;
  notifications: Record<string, NotificationSetting>;
}

const KINDS: { key: string; label: string; description: string }[] = [
  {
    key: 'submission_received',
    label: 'New bike submission received',
    description: 'Sent when a customer submits a bike through your Typeform.',
  },
  {
    key: 'faults_awaiting_approval',
    label: 'Repairs awaiting approval',
    description: 'Sent when new faults arrive from InspectABike and need a decision.',
  },
  {
    key: 'logistics_update',
    label: 'Collection and delivery updates',
    description: 'Sent when a bike is booked in, collected, delivered or cancelled.',
  },
];

const defaultNotification = (): NotificationSetting => ({ enabled: true, mode: 'roles', addresses: [] });

const defaults = (): EmailSettings => ({
  enabled: true,
  from_address: 'VeloDealer <notifications@velodealer.com>',
  app_url: window.location.origin,
  notifications: Object.fromEntries(KINDS.map((k) => [k.key, defaultNotification()])),
});

export default function EmailNotifications() {
  const { profile } = useAuth();
  const superAdmin = isSuperAdmin(profile?.email);
  const [settings, setSettings] = useState<EmailSettings>(defaults());
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('integrations')
        .select('id, is_active, settings')
        .eq('name', 'resend')
        .maybeSingle();

      if (data) {
        setRowId(data.id);
        const stored = (data.settings ?? {}) as Partial<EmailSettings>;
        const base = defaults();
        setSettings({
          enabled: stored.enabled ?? data.is_active ?? true,
          from_address: stored.from_address || base.from_address,
          app_url: stored.app_url || base.app_url,
          notifications: Object.fromEntries(
            KINDS.map((k) => [k.key, { ...defaultNotification(), ...(stored.notifications?.[k.key] ?? {}) }]),
          ),
        });
      }
      setLoading(false);
    })();
  }, []);

  const updateKind = (key: string, patch: Partial<NotificationSetting>) =>
    setSettings((s) => ({
      ...s,
      notifications: { ...s.notifications, [key]: { ...s.notifications[key], ...patch } },
    }));

  const save = async () => {
    setSaving(true);
    const payload = {
      name: 'resend',
      display_name: 'Email notifications (Resend)',
      is_active: settings.enabled,
      settings: settings as any,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = rowId
      ? await supabase.from('integrations').update(payload).eq('id', rowId).select('id').single()
      : await supabase.from('integrations').insert(payload).select('id').single();
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    setRowId(data.id);
    toast({ title: 'Email settings saved' });
  };

  const sendTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('send-test-email', { body: {} });
    setTesting(false);
    if (error || data?.ok === false) {
      toast({
        title: 'Test email failed',
        description: data?.error || error?.message || 'Unknown error',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Test email sent',
      description: (data?.recipients || []).join(', ') || 'Check your inbox.',
    });
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email notifications
        </CardTitle>
        <CardDescription>
          Email alerts for new submissions, repairs awaiting approval, and collection or delivery updates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="font-medium">Send emails</p>
            <p className="text-sm text-muted-foreground">Turn all email notifications on or off.</p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from-address">From address</Label>
            <Input
              id="from-address"
              value={settings.from_address}
              onChange={(e) => setSettings((s) => ({ ...s, from_address: e.target.value }))}
              placeholder="VeloDealer &lt;notifications@velodealer.com&gt;"
            />
            <p className="text-xs text-muted-foreground">The domain must be verified in your Resend account.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-url">Link address used in emails</Label>
            <Input
              id="app-url"
              value={settings.app_url}
              onChange={(e) => setSettings((s) => ({ ...s, app_url: e.target.value }))}
              placeholder="https://velodealer.com"
            />
          </div>
        </div>

        <Separator />

        {KINDS.map((kind) => {
          const value = settings.notifications[kind.key];
          return (
            <div key={kind.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{kind.label}</p>
                  <p className="text-sm text-muted-foreground">{kind.description}</p>
                </div>
                <Switch checked={value.enabled} onCheckedChange={(v) => updateKind(kind.key, { enabled: v })} />
              </div>

              {value.enabled && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={value.mode === 'roles' ? 'default' : 'outline'}
                      onClick={() => updateKind(kind.key, { mode: 'roles' })}
                    >
                      All admins and owners
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={value.mode === 'addresses' ? 'default' : 'outline'}
                      onClick={() => updateKind(kind.key, { mode: 'addresses' })}
                    >
                      Specific addresses
                    </Button>
                  </div>
                  {value.mode === 'addresses' && (
                    <Input
                      value={value.addresses.join(', ')}
                      onChange={(e) =>
                        updateKind(kind.key, {
                          addresses: e.target.value
                            .split(',')
                            .map((a) => a.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="sales@velodealer.com, workshop@velodealer.com"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          <Button variant="outline" onClick={sendTest} disabled={testing || !rowId}>
            <Send className="mr-2 h-4 w-4" />
            {testing ? 'Sending…' : 'Send test email'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
