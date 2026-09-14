import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, ClipboardCheck, Link2 } from 'lucide-react';

interface Summary {
  processed: number;
  linked: number;
  already_linked: number;
  faults_imported: number;
  not_found: string[];
  failed: { reference: string; error: string }[];
  total: number;
}

const empty: Summary = {
  processed: 0, linked: 0, already_linked: 0, faults_imported: 0,
  not_found: [], failed: [], total: 0,
};

export default function InspectABikeBackfill() {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [savingBase, setSavingBase] = useState(false);

  useEffect(() => {
    supabase
      .from('integrations')
      .select('settings')
      .eq('name', 'inspectabike')
      .maybeSingle()
      .then(({ data }) => {
        const base = (data?.settings as Record<string, unknown> | null)?.report_base_url;
        if (typeof base === 'string') setBaseUrl(base);
      });
  }, []);

  const saveBaseUrl = async () => {
    setSavingBase(true);
    try {
      const trimmed = baseUrl.trim().replace(/\/+$/, '');
      if (trimmed && !/^https?:\/\//i.test(trimmed)) {
        throw new Error('Enter a full address starting with https://');
      }

      const { data: existing } = await supabase
        .from('integrations')
        .select('id, settings')
        .eq('name', 'inspectabike')
        .maybeSingle();

      const settings = {
        ...((existing?.settings as Record<string, unknown>) ?? {}),
        report_base_url: trimmed || null,
      };

      if (existing) {
        const { error } = await supabase
          .from('integrations')
          .update({ settings, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integrations')
          .insert({ name: 'inspectabike', display_name: 'InspectABike', is_active: true, settings });
        if (error) throw error;
      }

      // Rewrite existing report links to the new base.
      let fixed = 0;
      if (trimmed) {
        const { data: inspections, error: fetchError } = await supabase
          .from('inspections')
          .select('id, report_url')
          .not('report_url', 'is', null);
        if (fetchError) throw fetchError;

        for (const row of inspections ?? []) {
          try {
            const u = new URL(row.report_url as string);
            const b = new URL(trimmed);
            u.protocol = b.protocol;
            u.host = b.host;
            const next = u.toString();
            if (next !== row.report_url) {
              const { error } = await supabase
                .from('inspections')
                .update({ report_url: next })
                .eq('id', row.id);
              if (!error) fixed++;
            }
          } catch { /* skip invalid URLs */ }
        }
      }

      toast({
        title: 'Report link address saved',
        description: trimmed
          ? `New reports will use ${trimmed}. Updated ${fixed} existing link${fixed === 1 ? '' : 's'}.`
          : 'Cleared — links will be stored exactly as InspectABike sends them.',
      });
    } catch (e: any) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setSavingBase(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setSummary({ ...empty });
    let offset = 0;
    const totals: Summary = { ...empty, not_found: [], failed: [] };

    try {
      // Loop through in small batches so a big run never times out.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase.functions.invoke('inspectabike-backfill', {
          body: { offset, limit: 8 },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        const batch = data as any;
        totals.processed += batch.processed || 0;
        totals.linked += batch.linked || 0;
        totals.already_linked += batch.already_linked || 0;
        totals.faults_imported += batch.faults_imported || 0;
        totals.not_found.push(...(batch.not_found || []));
        totals.failed.push(...(batch.failed || []));
        totals.total = batch.total || totals.processed;
        setSummary({ ...totals, not_found: [...totals.not_found], failed: [...totals.failed] });

        if (batch.done) break;
        offset = batch.next_offset;
      }

      toast({
        title: 'Backfill complete',
        description: `${totals.linked} linked, ${totals.faults_imported} faults imported.`,
      });
    } catch (e: any) {
      toast({ title: 'Backfill failed', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const pct = summary && summary.total ? Math.round((summary.processed / summary.total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          InspectABike
        </CardTitle>
        <CardDescription>
          Match bikes that were already inspected to their InspectABike report and pull in any faults.
          Safe to run more than once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={run} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Backfilling…' : 'Backfill from InspectABike'}
        </Button>

        {summary && (
          <div className="space-y-3">
            {summary.total > 0 && <Progress value={pct} />}
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>Checked: <strong>{summary.processed}</strong>{summary.total ? ` / ${summary.total}` : ''}</div>
              <div>Linked: <strong>{summary.linked}</strong></div>
              <div>Already linked: <strong>{summary.already_linked}</strong></div>
              <div>Faults imported: <strong>{summary.faults_imported}</strong></div>
            </div>

            {summary.not_found.length > 0 && (
              <div className="text-sm">
                <p className="font-medium">Not found in InspectABike ({summary.not_found.length})</p>
                <p className="text-muted-foreground break-words">{summary.not_found.join(', ')}</p>
              </div>
            )}

            {summary.failed.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-destructive">Failed ({summary.failed.length})</p>
                <ul className="text-muted-foreground space-y-1">
                  {summary.failed.map((f, i) => (
                    <li key={i} className="break-words">{f.reference}: {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
