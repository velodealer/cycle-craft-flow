import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Inbox, Bike, Ban, Eye } from 'lucide-react';
import { toast } from 'sonner';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import {
  listSubmissions,
  updateSubmissionStatus,
  convertSubmissionToBike,
  type TypeformSubmission,
} from '@/services/typeform';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  converted: 'Converted',
  rejected: 'Rejected',
};

function statusVariant(status: string) {
  if (status === 'converted') return 'default';
  if (status === 'rejected') return 'destructive';
  if (status === 'reviewed') return 'outline';
  return 'secondary';
}

function formatPrice(price: number | null) {
  return price != null ? `£${price.toLocaleString('en-GB')}` : '—';
}

export default function SubmissionsPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<TypeformSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('new');
  const [textFilter, setTextFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TypeformSubmission | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TypeformSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await listSubmissions(statusFilter, textFilter);
      setSubmissions(rows);
    } catch (e) {
      toast.error(`Could not load submissions: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, textFilter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleCreateBike = async (sub: TypeformSubmission) => {
    setBusyId(sub.id);
    try {
      const bikeId = await convertSubmissionToBike(sub);
      toast.success('Bike created and waiting for intake');
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: 'converted', bike_id: bikeId } : s)));
      navigate(`/bikes/${bikeId}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkReviewed = async (sub: TypeformSubmission) => {
    setBusyId(sub.id);
    try {
      await updateSubmissionStatus(sub.id, 'reviewed');
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: 'reviewed' } : s)));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await updateSubmissionStatus(rejectTarget.id, 'rejected', rejectReason || null);
      setSubmissions((prev) => prev.map((s) => (s.id === rejectTarget.id ? { ...s, status: 'rejected' } : s)));
      setRejectTarget(null);
      setRejectReason('');
      toast.success('Submission rejected');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const openDetail = (sub: TypeformSubmission) => {
    setDetail(sub);
  };

  const closeDetail = () => setDetail(null);

  const rawAnswers = (sub: TypeformSubmission | null) => {
    if (!sub) return [];
    const form = sub.raw_payload?.form_response;
    const definition = form?.definition;
    const answers = form?.answers ?? [];
    const titleById = new Map<string, string>();
    for (const field of definition?.fields ?? []) {
      titleById.set(field.id, field.title);
      titleById.set(field.ref, field.title);
    }
    return answers.map((a: any) => ({
      title: titleById.get(a.field?.ref) || titleById.get(a.field?.id) || 'Question',
      value:
        a.text ??
        a.email ??
        a.phone_number ??
        a.choice?.label ??
        a.choice?.other ??
        (typeof a.number === 'number' ? String(a.number) : undefined) ??
        (a.boolean !== undefined ? (a.boolean ? 'Yes' : 'No') : undefined) ??
        a.date ??
        a.file_url ??
        '',
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Submissions</h1>
          <p className="text-muted-foreground mt-1">
            Bike sale and part-exchange enquiries received from Typeform
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search customer, bike, frame…"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            className="w-56"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p>No submissions here yet. Connect a Typeform form in Settings → Integrations to start receiving them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {submissions.map((sub) => (
            <Card key={sub.id}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <BikeThumbnail photos={sub.photo_urls} alt={sub.bike_make ?? 'Bike photo'} className="h-20 w-20" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {[sub.bike_make, sub.bike_model].filter(Boolean).join(' ') || 'Unknown bike'}
                      </span>
                      {sub.bike_year && <Badge variant="outline">{sub.bike_year}</Badge>}
                      {sub.submission_type && (
                        <Badge variant={sub.submission_type === 'part_exchange' ? 'default' : 'secondary'}>
                          {sub.submission_type === 'part_exchange' ? 'Part exchange' : 'Sale'}
                        </Badge>
                      )}
                      <Badge variant={statusVariant(sub.status)}>{STATUS_LABELS[sub.status] ?? sub.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sub.customer_name || 'Unknown customer'}
                      {sub.customer_email ? ` · ${sub.customer_email}` : ''}
                      {sub.customer_phone ? ` · ${sub.customer_phone}` : ''}
                    </p>
                    <p className="text-sm">
                      Asking <span className="font-medium">{formatPrice(sub.asking_price)}</span>
                      {sub.frame_number ? ` · Frame ${sub.frame_number}` : ''}
                      {sub.postcode ? ` · ${sub.postcode}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sub.submitted_at).toLocaleString('en-GB')}
                      {sub.bike_id ? ` · Bike created` : ''}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(sub)}>
                        <Eye className="mr-2 h-4 w-4" /> View
                      </Button>
                      {sub.status !== 'converted' && sub.status !== 'rejected' && (
                        <Button
                          size="sm"
                          onClick={() => handleCreateBike(sub)}
                          disabled={busyId === sub.id}
                        >
                          {busyId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bike className="mr-2 h-4 w-4" />}
                          Create bike
                        </Button>
                      )}
                      {sub.status === 'new' && (
                        <Button variant="outline" size="sm" onClick={() => handleMarkReviewed(sub)} disabled={busyId === sub.id}>
                          Mark reviewed
                        </Button>
                      )}
                      {sub.status !== 'converted' && sub.status !== 'rejected' && (
                        <Button variant="destructive" size="sm" onClick={() => setRejectTarget(sub)}>
                          <Ban className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      )}
                      {sub.bike_id && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/bikes/${sub.bike_id}`)}>
                          Open bike
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {[detail.bike_make, detail.bike_model].filter(Boolean).join(' ') || 'Submission'}
                </DialogTitle>
                <DialogDescription>
                  {detail.customer_name || 'Unknown customer'} ·{' '}
                  {new Date(detail.submitted_at).toLocaleString('en-GB')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {detail.photo_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {detail.photo_urls.map((url, i) => (
                      <img key={i} src={url} alt={`Submission photo ${i + 1}`} className="h-24 w-24 rounded-md border object-cover" loading="lazy" />
                    ))}
                  </div>
                )}

                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {[
                    ['Type', detail.submission_type === 'part_exchange' ? 'Part exchange' : detail.submission_type === 'sale' ? 'Sale' : '—'],
                    ['Asking price', formatPrice(detail.asking_price)],
                    ['Make', detail.bike_make ?? '—'],
                    ['Model', detail.bike_model ?? '—'],
                    ['Year', detail.bike_year ? String(detail.bike_year) : '—'],
                    ['Frame number', detail.frame_number ?? '—'],
                    ['Email', detail.customer_email ?? '—'],
                    ['Phone', detail.customer_phone ?? '—'],
                    ['Postcode', detail.postcode ?? '—'],
                    ['Notes', detail.notes ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>

                {rawAnswers(detail).length > 0 && (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-sm font-medium">All form answers</p>
                    <dl className="space-y-1.5 text-sm">
                      {rawAnswers(detail).map((a: { title: string; value: string }, i: number) => (
                        <div key={i}>
                          <dt className="text-xs text-muted-foreground">{a.title}</dt>
                          <dd className="break-words">{a.value || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
            <DialogDescription>
              Rejecting hides this enquiry from the new list. You can optionally record why.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={busyId === rejectTarget?.id}>
              {busyId === rejectTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
