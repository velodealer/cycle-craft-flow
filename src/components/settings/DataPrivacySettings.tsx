import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllRows } from '@/lib/fetchAll';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Trash2 } from 'lucide-react';

// Dealership business data included in a data export (sign-in tokens and internal logs are never exported).
const EXPORT_TABLES = [
  'bikes', 'bike_components', 'bike_activity', 'bike_collections', 'build_parts', 'components', 'parts',
  'external_owners', 'fulfilment_events', 'inspections', 'inspection_faults', 'jobs', 'invoices',
  'quotes', 'quote_versions', 'sale_drafts', 'listing_templates', 'ebay_listings', 'ebay_orders',
  'shopify_listings', 'squarespace_listings', 'storage_bays', 'typeform_submissions', 'profiles',
  'social_posts', 'social_scripts', 'social_post_metrics', 'social_post_scores', 'social_post_checklist',
];

type Req = { id: string; status: string; created_at: string; decision_note: string | null };

export default function DataPrivacySettings() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState('');
  const [reason, setReason] = useState('');
  const [reqs, setReqs] = useState<Req[]>([]);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('data_deletion_requests' as any)
      .select('id,status,created_at,decision_note').order('created_at', { ascending: false });
    setReqs((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const exportData = async () => {
    if (!profile?.business_id) return;
    const out: Record<string, unknown[]> = {};
    try {
      for (const t of EXPORT_TABLES) {
        setExporting(t);
        out[t] = await fetchAllRows<any>((from, to) =>
          (supabase.from(t as any).select('*').eq('business_id', profile.business_id).range(from, to)) as any);
      }
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), tables: out }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `velodealer-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: 'Export downloaded' });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally { setExporting(''); }
  };

  const requestDeletion = async () => {
    if (!confirm('Ask VeloDealer to delete this dealership and all its data? Once approved, everyone in your dealership loses access.')) return;
    setSending(true);
    const { error } = await supabase.from('data_deletion_requests' as any).insert({
      business_id: profile!.business_id, requested_by: user!.id, requester_email: user!.email, reason: reason || null,
    });
    setSending(false);
    if (error) return toast({ title: 'Could not send request', description: error.message, variant: 'destructive' });
    setReason(''); toast({ title: 'Request sent', description: 'We will review it and email you.' }); load();
  };

  const pending = reqs.some((r) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Download your data</CardTitle>
          <CardDescription>One file with your bikes, parts, jobs, invoices, quotes, customers and listings. Sign-in details for connected services are never included.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportData} disabled={!!exporting}>
            <Download className="mr-2 h-4 w-4" />{exporting ? `Collecting ${exporting.replace(/_/g, ' ')}…` : 'Download export'}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete this dealership</CardTitle>
          <CardDescription>Sends a request to VeloDealer. Once approved, your dealership is locked and its data is removed. Download an export first if you need a copy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} />
          <Button variant="destructive" onClick={requestDeletion} disabled={pending || sending}>
            <Trash2 className="mr-2 h-4 w-4" />{pending ? 'Request waiting for review' : 'Request deletion'}
          </Button>
          {reqs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={r.status === 'rejected' ? 'secondary' : r.status === 'approved' ? 'destructive' : 'outline'}>{r.status}</Badge>
              {new Date(r.created_at).toLocaleDateString('en-GB')}{r.decision_note ? ` — ${r.decision_note}` : ''}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
