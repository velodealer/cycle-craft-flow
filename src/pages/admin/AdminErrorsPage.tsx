import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/velo/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Row = { id: string; created_at: string; source: string; severity: string; message: string; url: string | null; detail: any; business_id: string | null };

export default function AdminErrorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    const [{ data, error }, { data: biz }] = await Promise.all([
      supabase.from('system_error_logs' as any).select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('businesses').select('id, name'),
    ]);
    if (error) setError(error.message);
    setRows((data as any) ?? []);
    setNames(Object.fromEntries(((biz as any[]) ?? []).map((b) => [b.id, b.name])));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shown = rows.filter((r) => !q || `${r.message} ${r.url} ${names[r.business_id ?? '']}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title="Errors" description="Problems people hit in the app, newest first (last 300)." />
      <div className="flex gap-2">
        <Input placeholder="Search message, page or dealership" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No errors recorded.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <Card key={r.id} className="cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(r.created_at).toLocaleString('en-GB')}</span>
                  <Badge variant="outline">{r.source}</Badge>
                  <span>{names[r.business_id ?? ''] ?? 'Unknown dealership'}</span>
                  {r.url && <span className="truncate">{r.url}</span>}
                </div>
                <p className="text-sm break-words">{r.message}</p>
                {open === r.id && r.detail && (
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{JSON.stringify(r.detail, null, 2)}</pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
