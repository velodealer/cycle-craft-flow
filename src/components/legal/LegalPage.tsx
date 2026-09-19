import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { PublicHeader, PublicFooter } from '@/components/public/PublicLayout';

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

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function LegalPage({ title, description, lastUpdated, children }: LegalPageProps) {
  const articleRef = useRef<HTMLElement>(null);
  const [contents, setContents] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | VeloDealer`;
    setMeta('description', description);
    return () => { document.title = previousTitle; };
  }, [title, description]);

  useEffect(() => {
    const headings = Array.from(articleRef.current?.querySelectorAll('h2') ?? []);
    setContents(
      headings.map((heading) => {
        const label = heading.textContent?.trim() ?? '';
        const id = heading.id || slugify(label);
        heading.id = id;
        heading.classList.add('scroll-mt-24');
        return { id, label };
      }),
    );
  }, [children]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <main className="container mx-auto max-w-6xl flex-1 px-4 py-10">
        <h1 className="font-display text-[32px] font-bold leading-tight text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <Separator className="my-8" />

        <div className="gap-10 lg:grid lg:grid-cols-[240px,1fr]">
          <nav className="mb-8 hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto border-l border-border pl-4">
              <p className="label-text text-muted-foreground">On this page</p>
              <ul className="mt-3 space-y-2 text-sm">
                {contents.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article
            ref={articleRef}
            className="max-w-3xl space-y-8 text-sm leading-relaxed text-foreground [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:mt-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm [&_th]:border [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-foreground [&_td]:border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-muted-foreground"
          >
            {children}
          </article>
        </div>

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
      <PublicFooter />
    </div>
  );
}
