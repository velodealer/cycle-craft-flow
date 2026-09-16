import { useState } from 'react';
import PublicLayout from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, MapPin, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-contact', { body: form });
      const failure = error ? 'We could not send your message. Please try again.' : (data as any)?.error;
      if (failure) {
        toast({ title: 'Message not sent', description: failure, variant: 'destructive' });
        return;
      }
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicLayout
      title="Contact"
      description="Get in touch with the VeloDealer team about pricing, a demo, or anything you need from the system."
    >
      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Contact us</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Tell us about your shop and what you need. We read every message and reply by email.
          </p>
        </div>
      </section>

      <section className="container mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Send us a message</CardTitle>
            <CardDescription>We usually reply within one working day.</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <p className="mt-4 font-medium text-foreground">Thanks — your message is with us.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  We'll reply to {form.email} shortly.
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
                      onChange={(e) => update('name')(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update('email')(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Shop or company (optional)</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => update('company')(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    required
                    value={form.subject}
                    onChange={(e) => update('subject')(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={(e) => update('message')(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={sending}>
                  {sending ? 'Sending…' : 'Send message'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 text-sm">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Mail className="h-4 w-4 text-primary" /> Email
            </h2>
            <p className="mt-2 text-muted-foreground">info@velodealer.com</p>
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" /> Address
            </h2>
            <p className="mt-2 text-muted-foreground">
              VDMS Ltd
              <br />
              30 Wake Green Road
              <br />
              Birmingham
              <br />
              B13 9PB
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
