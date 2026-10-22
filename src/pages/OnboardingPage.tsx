import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { VeloDealerLogo } from '@/components/brand/VeloDealerLogo';
import BikeReferenceSettings from '@/components/settings/BikeReferenceSettings';
import DeliverySettings from '@/components/settings/DeliverySettings';
import VatSettings from '@/components/settings/VatSettings';
import InvoiceBrandingSettings from '@/components/settings/InvoiceBrandingSettings';
import StorageBays from '@/components/settings/StorageBays';
import QuickBooksIntegration from '@/components/settings/QuickBooksIntegration';
import XeroIntegration from '@/components/settings/XeroIntegration';
import EbayIntegration from '@/components/settings/EbayIntegration';
import ShopifyIntegration from '@/components/settings/ShopifyIntegration';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'profile', title: 'Identity & address', desc: 'Your bike reference prefix and shop address.' },
  { id: 'tax', title: 'Tax & invoicing', desc: 'VAT registration, logo, bank details and invoice footer.' },
  { id: 'bays', title: 'Workshop bays', desc: 'Where bikes are stored in your workshop.' },
  { id: 'integrations', title: 'Integrations', desc: 'Connect accounting and sales channels. You can skip any of these.' },
  { id: 'done', title: 'All set', desc: 'Your dealership is ready to go.' },
] as const;

export const onboardingKey = (businessId: string) => `onboarding:${businessId}`;

export default function OnboardingPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile?.business_id) return;
    supabase.from('app_settings').select('value').eq('key', onboardingKey(profile.business_id)).maybeSingle()
      .then(({ data }) => {
        const v = (data?.value ?? {}) as { completed?: boolean; steps?: Record<string, boolean> };
        if (v.completed) navigate('/dashboard', { replace: true });
        const s = v.steps ?? {};
        setDone(s);
        const first = STEPS.findIndex((x) => x.id !== 'done' && !s[x.id]);
        setStep(first === -1 ? STEPS.length - 1 : first);
      });
  }, [profile?.business_id, navigate]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !['admin', 'owner'].includes(profile.role)) return <Navigate to="/dashboard" replace />;

  const persist = async (steps: Record<string, boolean>, completed = false) => {
    if (!profile?.business_id) return false;
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert(
      { key: onboardingKey(profile.business_id), business_id: profile.business_id, value: { completed, steps } as never },
      { onConflict: 'key' },
    );
    setSaving(false);
    if (error) { toast.error(`Could not save progress: ${error.message}`); return false; }
    return true;
  };

  const next = async () => {
    const id = STEPS[step].id;
    const steps = { ...done, [id]: true };
    if (await persist(steps)) { setDone(steps); setStep(step + 1); }
  };

  const finish = async () => {
    if (await persist({ ...done }, true)) { toast.success('Setup complete — welcome to VeloDealer'); navigate('/dashboard', { replace: true }); }
  };

  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <VeloDealerLogo variant="symbol" className="size-7" />
          <span className="font-semibold">Set up your dealership</span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => (i <= step || done[s.id]) && setStep(i)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                  i === step ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                )}
              >
                {done[s.id] ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        <Card>
          <CardHeader>
            <CardTitle>Step {step + 1}: {current.title}</CardTitle>
            <CardDescription>{current.desc}</CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-4">
          {current.id === 'profile' && (<><BikeReferenceSettings /><DeliverySettings /></>)}
          {current.id === 'tax' && (<><VatSettings /><InvoiceBrandingSettings /></>)}
          {current.id === 'bays' && <StorageBays />}
          {current.id === 'integrations' && (
            <><QuickBooksIntegration /><XeroIntegration /><EbayIntegration /><ShopifyIntegration /></>
          )}
          {current.id === 'done' && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              Everything can be changed later under Settings.
            </CardContent></Card>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          {current.id === 'done'
            ? <Button onClick={finish} disabled={saving}>Go to dashboard</Button>
            : <Button onClick={next} disabled={saving}>{current.id === 'integrations' ? 'Continue (skip any for now)' : 'Save & continue'}</Button>}
        </div>
      </div>
    </div>
  );
}
