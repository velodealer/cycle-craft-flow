import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Download, Mail, RefreshCw } from 'lucide-react';

interface Ticket {
  id: string;
  name: string;
  email: string;
  company: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

interface Reply {
  id: string;
  ticket_id: string;
  body: string;
  sent_by_name: string | null;
  sent_at: string;
}

interface Application {
  id: string;
  role_title: string;
  name: string;
  email: string;
  phone: string | null;
  links: string | null;
  cover_note: string | null;
  cv_path: string | null;
  status: string;
  created_at: string;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const ticketStatuses = ['new', 'open', 'closed'];
const applicationStatuses = ['new', 'reviewing', 'rejected', 'hired'];

export default function SupportInbox() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [t, r, a] = await Promise.all([
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('support_ticket_replies').select('*').order('sent_at', { ascending: true }),
      supabase.from('job_applications').select('*').order('created_at', { ascending: false }),
    ]);
    setTickets((t.data as Ticket[]) ?? []);
    setReplies((r.data as Reply[]) ?? []);
    setApplications((a.data as Application[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setTicketStatus = async (id: string, status: string) => {
    await supabase.from('support_tickets').update({ status }).eq('id', id);
    setTickets((list) => list.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const setApplicationStatus = async (id: string, status: string) => {
    await supabase.from('job_applications').update({ status }).eq('id', id);
    setApplications((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  const sendReply = async (ticket: Ticket) => {
    const body = (drafts[ticket.id] ?? '').trim();
    if (body.length < 2) {
      toast({ title: 'Write a reply first', variant: 'destructive' });
      return;
    }
    setSendingId(ticket.id);
    try {
      const { data, error } = await supabase.functions.invoke('reply-support-ticket', {
        body: { ticket_id: ticket.id, body },
      });
      const failure = error ? 'The reply could not be sent.' : (data as any)?.error;
      if (failure) {
        toast({ title: 'Reply not sent', description: String(failure), variant: 'destructive' });
        return;
      }
      toast({ title: 'Reply sent', description: `Emailed to ${ticket.email}` });
      setDrafts((d) => ({ ...d, [ticket.id]: '' }));
      await load();
    } finally {
      setSendingId(null);
    }
  };

  const downloadCv = async (path: string) => {
    const { data, error } = await supabase.storage.from('job-applications').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open the CV', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Inbox
          </CardTitle>
          <CardDescription>
            Enquiries from the website contact form and applications from the careers page.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="tickets">
          <TabsList>
            <TabsTrigger value="tickets">Enquiries ({tickets.length})</TabsTrigger>
            <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-4 pt-4">
            {tickets.length === 0 && (
              <p className="text-sm text-muted-foreground">No enquiries yet.</p>
            )}
            {tickets.map((ticket) => {
              const thread = replies.filter((r) => r.ticket_id === ticket.id);
              return (
                <div key={ticket.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.name} · {ticket.email}
                        {ticket.company ? ` · ${ticket.company}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ticket.status === 'new' ? 'default' : 'secondary'}>
                        {ticket.status}
                      </Badge>
                      <Select
                        value={ticket.status}
                        onValueChange={(value) => setTicketStatus(ticket.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ticketStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {ticket.message}
                  </p>

                  {thread.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="space-y-2">
                        {thread.map((reply) => (
                          <div key={reply.id} className="rounded bg-muted/50 p-3 text-sm">
                            <p className="text-xs text-muted-foreground">
                              {reply.sent_by_name ?? 'VeloDealer'} · {formatDate(reply.sent_at)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="mt-3 space-y-2">
                    <Textarea
                      rows={3}
                      placeholder={`Reply to ${ticket.name}…`}
                      value={drafts[ticket.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [ticket.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      onClick={() => sendReply(ticket)}
                      disabled={sendingId === ticket.id}
                    >
                      {sendingId === ticket.id ? 'Sending…' : 'Send reply'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="applications" className="space-y-4 pt-4">
            {applications.length === 0 && (
              <p className="text-sm text-muted-foreground">No applications yet.</p>
            )}
            {applications.map((application) => (
              <div key={application.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {application.name} — {application.role_title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {application.email}
                      {application.phone ? ` · ${application.phone}` : ''}
                    </p>
                    {application.links && (
                      <p className="text-sm text-muted-foreground">{application.links}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(application.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {application.cv_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCv(application.cv_path as string)}
                      >
                        <Download className="mr-2 h-4 w-4" /> CV
                      </Button>
                    )}
                    <Select
                      value={application.status}
                      onValueChange={(value) => setApplicationStatus(application.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {applicationStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {application.cover_note && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {application.cover_note}
                  </p>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
