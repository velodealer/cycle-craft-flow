import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PublicLayout from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/button';

type State = 'checking' | 'ok' | 'down';
const LABEL: Record<State, string> = { checking: 'Checking…', ok: 'Working', down: 'Problem' };

export default function StatusPage() {
  const [checks, setChecks] = useState<Record<string, State>>({});
  const [at, setAt] = useState<Date | null>(null);

  const run = async () => {
    setChecks({ App: 'ok', Database: 'checking', 'Sign-in': 'checking' });
    const timed = <T,>(p: PromiseLike<T>) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]);
    const [db, auth] = await Promise.allSettled([
      timed(supabase.from('blog_posts').select('id', { head: true, count: 'exact' }).limit(1)),
      timed(supabase.auth.getSession()),
    ]);
    setChecks({
      App: 'ok',
      Database: db.status === 'fulfilled' && !(db.value as any).error ? 'ok' : 'down',
      'Sign-in': auth.status === 'fulfilled' && !(auth.value as any).error ? 'ok' : 'down',
    });
    setAt(new Date());
  };
  useEffect(() => { run(); }, []);

  const allOk = Object.values(checks).every((s) => s === 'ok');
  return (
    <PublicLayout title="Service status — VeloDealer" description="Live status of the VeloDealer app, database and sign-in.">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-16">
        <h1 className="font-display text-3xl font-bold">Service status</h1>
        <p className="text-lg">{allOk ? 'All systems working.' : Object.values(checks).includes('down') ? 'Some services have a problem. We are on it.' : 'Checking…'}</p>
        <div className="divide-y divide-border rounded-md border border-border bg-card">
          {Object.entries(checks).map(([k, s]) => (
            <div key={k} className="flex items-center justify-between p-4">
              <span>{k}</span>
              <span className={s === 'ok' ? 'text-primary' : s === 'down' ? 'text-destructive' : 'text-muted-foreground'}>{LABEL[s]}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Button variant="outline" size="sm" onClick={run}>Check again</Button>
          {at && <span>Last checked {at.toLocaleTimeString('en-GB')}</span>}
        </div>
      </div>
    </PublicLayout>
  );
}
