import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2 } from 'lucide-react';

interface Opening {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  summary: string | null;
  description: string | null;
}

const MAX_CV_BYTES = 10 * 1024 * 1024;

function renderDescription(text: string) {
  return text.split(/\n\s*\n/).map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={index} className="mt-8 text-xl font-semibold text-foreground">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.split('\n').every((line) => /^[-*] /.test(line.trim()))) {
      return (
        <ul key={index} className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
          {trimmed.split('\n').map((line, i) => (
            <li key={i}>{line.trim().replace(/^[-*] /, '')}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="mt-3 text-muted-foreground">
        {trimmed}
      </p>
    );
  });
}

export default function CareerDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [opening, setOpening] = useState<Opening | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', links: '', cover_note: '' });
  const [cv, setCv] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('job_openings')
        .select('id, slug, title, location, employment_type, summary, description')
        .eq('slug', slug ?? '')
        .eq('is_open', true)
        .maybeSingle();
      if (!active) return;
      setOpening((data as Opening) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opening) return;
    if (cv && cv.size > MAX_CV_BYTES) {
      toast({
        title: 'CV too large',
        description: 'Please upload a file under 10MB.',
        variant: 'destructive',
      });
      return;
    }
    setSending(true);
    try {
      let cvPath: string | null = null;
      if (cv) {
        const safeName = cv.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
        cvPath = `${opening.slug}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('job-applications')
          .upload(cvPath, cv, { contentType: cv.type || 'application/octet-stream' });
        if (uploadError) {
          toast({
            title: 'CV upload failed',
            description: 'Please try again, or apply without a CV and email it to us.',
            variant: 'destructive',
          });
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('submit-application', {
        body: { ...form, opening_id: opening.id, cv_path: cvPath },
      });
      const failure = error
        ? 'We could not send your application. Please try again.'
        : (data as any)?.error;
      if (failure) {
        toast({ title: 'Application not sent', description: failure, variant: 'destructive' });
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout
      title={opening?.title ?? 'Careers'}
      description={opening?.summary ?? 'An open role at VeloDealer.'}
    >
      <article className="container mx-auto max-w-3xl px-4 py-16">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !opening ? (
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">This role isn't open</h1>
            <Button asChild className="mt-6">
              <Link to="/careers">See all roles</Link>
            </Button>
          </div>
        ) : (
          <>
            <Link to="/careers" className="text-sm text-primary hover:underline">
              ← All roles
            </Link>
            <div className="mt-6 flex flex-wrap gap-2">
              {opening.location && <Badge variant="secondary">{opening.location}</Badge>}
              {opening.employment_type && <Badge variant="outline">{opening.employment_type}</Badge>}
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">{opening.title}</h1>
            {opening.summary && <p className="mt-3 text-lg text-muted-foreground">{opening.summary}</p>}

            <div className="mt-6 leading-relaxed">
              {opening.description ? renderDescription(opening.description) : null}
            </div>

            <Card className="mt-12" id="apply">
              <CardHeader>
                <CardTitle>Apply for this role</CardTitle>
                <CardDescription>
                  Tell us a bit about yourself and attach your CV. We reply to every application.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sent ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                    <p className="mt-4 font-medium text-foreground">Application received.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We'll be in touch at {form.email}.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Your name</Label>
                        <Input
                          id="name"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone (optional)</Label>
                        <Input
                          id="phone"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="links">Links (optional)</Label>
                        <Input
                          id="links"
                          placeholder="LinkedIn, GitHub, portfolio"
                          value={form.links}
                          onChange={(e) => setForm({ ...form, links: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cover_note">Why you?</Label>
                      <Textarea
                        id="cover_note"
                        required
                        rows={6}
                        value={form.cover_note}
                        onChange={(e) => setForm({ ...form, cover_note: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cv">CV (PDF or Word, up to 10MB)</Label>
                      <Input
                        id="cv"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf"
                        onChange={(e) => setCv(e.target.files?.[0] ?? null)}
                      />
                    </div>
                    <Button type="submit" disabled={sending}>
                      {sending ? 'Sending…' : 'Send application'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </article>
    </PublicLayout>
  );
}
