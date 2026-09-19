import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Badge } from '@/components/ui/badge';
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
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <h1 className="font-display text-[40px] font-bold leading-tight text-foreground md:text-[56px]">Careers</h1>
          <p className="mt-4 max-w-[65ch] text-lg text-muted-foreground">
            We're a small team building software for bike shops. If you like practical problems and
            real customers, you'll fit in here.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-12">
        <h2 className="font-display text-xl font-semibold text-foreground">Open roles</h2>
        <div className="mt-4 border-y border-border">
          {loading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : openings.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              No open roles right now — send us a note through the contact page and we'll keep you in mind.
            </p>
          ) : (
            openings.map((opening) => (
              <Link
                key={opening.id}
                to={`/careers/${opening.slug}`}
                className="flex flex-col gap-2 border-b border-border py-5 last:border-b-0 transition-colors hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
              >
                <span className="min-w-0">
                  <span className="font-display text-lg font-semibold text-foreground">{opening.title}</span>
                  {opening.summary ? (
                    <span className="mt-1 block max-w-[70ch] text-sm text-muted-foreground">{opening.summary}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {opening.location && <Badge variant="secondary">{opening.location}</Badge>}
                  {opening.employment_type && <Badge variant="outline">{opening.employment_type}</Badge>}
                  <span className="text-sm font-medium text-primary">View &amp; apply</span>
                </span>
              </Link>
            ))
          )}
        </div>

        <div className="mt-12 rounded-[4px] border border-border bg-card p-6">
          <h2 className="font-display font-semibold text-foreground">Nothing that fits?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We always want to hear from people who know bikes, shops or good software. Write to
            info@velodealer.com and tell us what you'd do here.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
