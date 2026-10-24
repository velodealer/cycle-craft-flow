import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Panel } from '@/components/velo/PageShell';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Key = 'dealer_signup' | 'system_errors' | 'deletion_request';
const ITEMS: { key: Key; label: string; hint: string }[] = [
  { key: 'dealer_signup', label: 'New dealer awaiting approval', hint: 'One email per new sign-up.' },
  { key: 'system_errors', label: 'Errors', hint: 'Hourly summary, only when there are new errors.' },
  { key: 'deletion_request', label: 'Deletion requests', hint: 'One email per request.' },
];

export function PlatformAlertSettings() {
  const [cfg, setCfg] = useState<Record<Key, boolean> | null>(null);

  useEffect(() => {
    supabase.from('platform_alert_settings' as any).select('*').eq('id', true).maybeSingle()
      .then(({ data }) => setCfg((data as any) ?? { dealer_signup: true, system_errors: true, deletion_request: true }));
  }, []);

  const toggle = async (key: Key, value: boolean) => {
    const prev = cfg;
    setCfg((c) => (c ? { ...c, [key]: value } : c));
    const { error } = await supabase.from('platform_alert_settings' as any)
      .upsert({ id: true, [key]: value, updated_at: new Date().toISOString() });
    if (error) { setCfg(prev); toast.error(error.message); }
  };

  return (
    <Panel title="Email alerts" hint="Emails sent to super admins, checked every hour.">
      <div className="space-y-4">
        {ITEMS.map((i) => (
          <div key={i.key} className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={`pa-${i.key}`}>{i.label}</Label>
              <p className="text-xs text-muted-foreground">{i.hint}</p>
            </div>
            <Switch id={`pa-${i.key}`} disabled={!cfg} checked={cfg?.[i.key] ?? true} onCheckedChange={(v) => toggle(i.key, v)} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
