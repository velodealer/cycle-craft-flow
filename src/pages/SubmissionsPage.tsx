import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader, Panel, EmptyState } from '@/components/velo/PageShell';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Inbox, Bike, Ban, Eye, Pencil, ArrowLeftRight } from 'lucide-react';
import { logActivity } from '@/lib/activity';
import { toast } from 'sonner';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import {
  listSubmissions,
  updateSubmissionStatus,
  convertSubmissionToBike,
  convertSubmissionToPartEx,
  listStockBikesForPartEx,
  type StockBikeOption,
  type TypeformSubmission,
} from '@/services/typeform';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  converted: 'Converted',
  rejected: 'Rejected',
};

function SubmissionJourney({ status }: { status: string }) {
  const last = status === 'rejected' ? 'Rejected' : 'Bike created';
  const steps = ['Received', 'Reviewed', last];
  const reached = status === 'new' ? 0 : status === 'reviewed' ? 1 : 2;
  return (
    <ol className="mt-3 flex items-center gap-1 text-xs" aria-label="Submission progress">
      {steps.map((label, i) => {
        const done = i <= reached;
        const tone = done
          ? i === 2 && status === 'rejected'
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground';
        return (
          <li key={label} className="flex items-center gap-1">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${tone}`}>
              {i + 1}
            </span>
            <span className={done ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
            {i < steps.length - 1 && <span className={`mx-1 h-px w-4 sm:w-8 ${i < reached ? 'bg-primary' : 'bg-border'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

const REJECT_REASONS = [
  'Asking price too high',
  'Not a brand/model we stock',
  'Condition too poor',
  'Too old',
  'Wrong size / low demand',
  'Customer unresponsive',
  'Customer declined our offer',
  'Duplicate submission',
  'Spam / test',
  'Other',
];

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
  const [pxTarget, setPxTarget] = useState<TypeformSubmission | null>(null);
  const [pxStock, setPxStock] = useState<StockBikeOption[]>([]);
  const [pxStockLoading, setPxStockLoading] = useState(false);
  const [pxBikeId, setPxBikeId] = useState('');
  const [pxValue, setPxValue] = useState('');

  const openPartEx = async (sub: TypeformSubmission) => {
    setPxTarget(sub);
    setPxBikeId('');
    setPxValue(sub.asking_price ? String(sub.asking_price) : '');
    setPxStockLoading(true);
    try {
      setPxStock(await listStockBikesForPartEx());
    } catch (e) {
      toast.error(`Could not load stock bikes: ${(e as Error).message}`);
    } finally {
      setPxStockLoading(false);
    }
  };

  const handlePartEx = async () => {
    if (!pxTarget) return;
    const stock = pxStock.find((b) => b.id === pxBikeId);
    const allowance = Number(pxValue);
    if (!stock || !(allowance > 0)) return;
    const sub = pxTarget;
    setBusyId(sub.id);
    try {
      const newId = await convertSubmissionToPartEx(sub, stock, allowance);
      const label = `${stock.reference ? stock.reference + ' · ' : ''}${stock.make} ${stock.model}`;
      logActivity(stock.id, {
        kind: 'sale',
        action: 'part_exchange_agreed',
        summary: `Part exchange agreed: ${sub.bike_make ?? ''} ${sub.bike_model ?? ''} at £${allowance.toFixed(2)}`.trim(),
        detail: { part_exchange_bike_id: newId, submission_id: sub.id },
      });
      logActivity(newId, {
        kind: 'bike',
        action: 'part_exchange_in',
        summary: `Taken in part exchange against ${label} at £${allowance.toFixed(2)}`,
        detail: { against_bike_id: stock.id, submission_id: sub.id },
      });
      toast.success('Part exchange bike created — record the sale on the stock bike when ready');
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: 'converted', bike_id: newId } : s)));
      setPxTarget(null);
      navigate(`/bikes/${newId}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCategory, setRejectCategory] = useState('');

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
      const detail = rejectReason.trim();
      const note = rejectCategory === 'Other' ? `Other: ${detail}` : detail ? `${rejectCategory}: ${detail}` : rejectCategory;
      await updateSubmissionStatus(rejectTarget.id, 'rejected', note);
      setSubmissions((prev) => prev.map((s) => (s.id === rejectTarget.id ? { ...s, status: 'rejected', notes: note } : s)));
      const wasRejected = rejectTarget.status === 'rejected';
      setRejectTarget(null);
      setRejectReason('');
      setRejectCategory('');
      toast.success(wasRejected ? 'Rejection reason updated' : 'Submission rejected');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (sub: TypeformSubmission) => {
    const saved = sub.status === 'rejected' ? sub.notes ?? '' : '';
    let category = '';
    let detail = '';
    if (saved.startsWith('Other: ')) {
      category = 'Other';
      detail = saved.slice('Other: '.length);
    } else {
      const idx = saved.indexOf(': ');
      const head = idx > 0 ? saved.slice(0, idx) : saved;
      if (REJECT_REASONS.includes(head) && head !== 'Other') {
        category = head;
        detail = idx > 0 ? saved.slice(idx + 2) : '';
      } else if (saved) {
        category = saved;
      }
    }
    setRejectCategory(category);
    setRejectReason(detail);
    setRejectTarget(sub);
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
      <PageHeader
        title="Submissions"
        density="bench"
        description="Bike sale and part-exchange enquiries received from your forms."
        actions={
          <>
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
          </>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
        </div>
      ) : submissions.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            fact="No submissions here yet."
            fix="Connect a form in Settings → Integrations and responses land in this queue."
          />
        </Panel>
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

                    <SubmissionJourney status={sub.status} />
                    {sub.status === 'rejected' && sub.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">Reason: {sub.notes}</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetail(sub)}>
                        <Eye className="mr-2 h-4 w-4" /> View
                      </Button>
                      {sub.status === 'new' && (
                        <Button size="sm" onClick={() => handleMarkReviewed(sub)} disabled={busyId === sub.id}>
                          Mark reviewed
                        </Button>
                      )}
                      {sub.status !== 'converted' && sub.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant={sub.status === 'new' ? 'outline' : 'default'}
                          onClick={() => handleCreateBike(sub)}
                          disabled={busyId === sub.id || sub.status === 'new'}
                          title={sub.status === 'new' ? 'Mark reviewed first' : undefined}
                        >
                          {busyId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bike className="mr-2 h-4 w-4" />}
                          Create bike
                        </Button>
                      )}
                      {sub.status !== 'converted' && sub.status !== 'rejected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPartEx(sub)}
                          disabled={busyId === sub.id || sub.status === 'new'}
                          title={sub.status === 'new' ? 'Mark reviewed first' : undefined}
                        >
                          <ArrowLeftRight className="mr-2 h-4 w-4" /> Part ex
                        </Button>
                      )}
                      {sub.status !== 'converted' && sub.status !== 'rejected' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openReject(sub)}
                          disabled={sub.status === 'new'}
                          title={sub.status === 'new' ? 'Mark reviewed first' : undefined}
                        >
                          <Ban className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      )}
                      {sub.status === 'rejected' && (
                        <Button variant="outline" size="sm" onClick={() => openReject(sub)} disabled={busyId === sub.id}>
                          {busyId === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                          Edit reason
                        </Button>
                      )}
                      {sub.status === 'new' && (
                        <span className="self-center text-xs text-muted-foreground">Review first to create or reject</span>
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
            <DialogTitle>{rejectTarget?.status === 'rejected' ? 'Edit rejection reason' : 'Reject submission'}</DialogTitle>
            <DialogDescription>
              {rejectTarget?.status === 'rejected'
                ? 'Change the reason — the update is saved straight away.'
                : "Pick why you're turning this down so you can see trends later."}
            </DialogDescription>
          </DialogHeader>
          <Select value={rejectCategory} onValueChange={setRejectCategory}>
            <SelectTrigger><SelectValue placeholder="Choose a reason" /></SelectTrigger>
            <SelectContent>
              {REJECT_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder={rejectCategory === 'Other' ? 'Describe the reason (required)' : 'Extra detail (optional)'}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={busyId === rejectTarget?.id || !rejectCategory || (rejectCategory === 'Other' && !rejectReason.trim())}
            >
              {busyId === rejectTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rejectTarget?.status === 'rejected' ? 'Save reason' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pxTarget} onOpenChange={(o) => !o && setPxTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Part exchange</DialogTitle>
            <DialogDescription>
              Take in {pxTarget?.bike_make} {pxTarget?.bike_model} against one of your bikes in stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Against bike</label>
              <Select value={pxBikeId} onValueChange={setPxBikeId} disabled={pxStockLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={pxStockLoading ? 'Loading stock…' : 'Choose a bike in stock'} />
                </SelectTrigger>
                <SelectContent>
                  {pxStock.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.reference ? `${b.reference} · ` : ''}{b.make} {b.model}
                      {b.asking_price ? ` — £${Number(b.asking_price).toLocaleString()}` : ''}
                    </SelectItem>
                  ))}
                  {!pxStockLoading && pxStock.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No bikes in stock</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Part exchange allowance (£)</label>
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={pxValue} onChange={(e) => setPxValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPxTarget(null)}>Cancel</Button>
            <Button onClick={handlePartEx} disabled={busyId === pxTarget?.id || !pxBikeId || !(Number(pxValue) > 0)}>
              {busyId === pxTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create part exchange
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
