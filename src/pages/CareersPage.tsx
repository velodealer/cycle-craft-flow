import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Opening {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  summary: string | null;
}

export default function CareersPage() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('job_openings')
        .select('id, slug, title, location, employment_type, summary')
        .eq('is_open', true)
        .order('sort_order', { ascending: true });
      if (!active) return;
      setOpenings((data as Opening[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PublicLayout
      title="Careers"
      description="Join VeloDealer. Open roles in customer success and software development, based in Birmingham."
    >
      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Careers</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            We're a small team building software for bike shops. If you like practical problems and
            real customers, you'll fit in here.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Open roles</h2>
        <div className="mt-6 space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : openings.length === 0 ? (
            <p className="text-muted-foreground">
              No open roles right now — send us a note through the contact page and we'll keep you in
              mind.
            </p>
          ) : (
            openings.map((opening) => (
              <Card key={opening.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    {opening.location && <Badge variant="secondary">{opening.location}</Badge>}
                    {opening.employment_type && (
                      <Badge variant="outline">{opening.employment_type}</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-xl">{opening.title}</CardTitle>
                  <CardDescription>{opening.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild>
                    <Link to={`/careers/${opening.slug}`}>View role &amp; apply</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="mt-12 rounded-lg border bg-muted/40 p-6">
          <h2 className="font-semibold text-foreground">Nothing that fits?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We always want to hear from people who know bikes, shops or good software. Write to
            info@velodealer.com and tell us what you'd do here.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
