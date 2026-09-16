import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bike } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface LegalPageProps {
  title: string;
  description: string;
  lastUpdated: string;
  children: ReactNode;
}

function setMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export default function LegalPage({ title, description, lastUpdated, children }: LegalPageProps) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | VeloDealer`;
    setMeta('description', description);
    return () => { document.title = previousTitle; };
  }, [title, description]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Bike className="h-5 w-5 text-primary" />
            VeloDealer
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <Separator className="my-8" />

        <article className="space-y-8 text-sm leading-relaxed text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:mt-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-foreground [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-muted-foreground">
          {children}
        </article>

        <Separator className="my-8" />

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link to="/pricing" className="text-muted-foreground transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link to="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
            End-User Licence Agreement
          </Link>
          <Link to="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/cookies" className="text-muted-foreground transition-colors hover:text-foreground">
            Cookie Policy
          </Link>
        </nav>
      </main>
    </div>
  );
}
