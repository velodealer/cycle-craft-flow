import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  tags: string[] | null;
  author_name: string | null;
  published_at: string | null;
}

export const formatPostDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, slug, title, excerpt, cover_image_url, tags, author_name, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (!active) return;
      setPosts((data as BlogPostSummary[]) ?? []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PublicLayout
      title="Blog"
      description="Guides and thinking on running a bicycle shop: intake, workshop flow, inspections, margin, accounting and selling online."
    >
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <h1 className="font-display text-[40px] font-bold leading-tight text-foreground md:text-[56px]">Blog</h1>
          <p className="mt-4 max-w-[65ch] text-lg text-muted-foreground">
            How each part of VeloDealer changes the way a shop actually works.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet — check back soon.</p>
        ) : (
          <div className="border-y border-border">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="grid gap-1 border-b border-border px-1 py-5 last:border-b-0 transition-colors hover:bg-muted/40 md:grid-cols-[140px,1fr] md:gap-6"
              >
                <span className="id-text text-sm text-muted-foreground">{formatPostDate(post.published_at)}</span>
                <span>
                  <span className="font-display text-lg font-semibold text-foreground">{post.title}</span>
                  {post.excerpt ? (
                    <span className="mt-1 block max-w-[75ch] text-sm text-muted-foreground">{post.excerpt}</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
