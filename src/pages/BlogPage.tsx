import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Blog</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            How each part of VeloDealer changes the way a shop actually works.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No posts yet — check back soon.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {posts.map((post) => (
              <Card key={post.id} className="flex flex-col overflow-hidden">
                {post.cover_image_url && (
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                )}
                <CardHeader>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(post.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <CardTitle className="text-lg leading-snug">
                    <Link to={`/blog/${post.slug}`} className="hover:underline">
                      {post.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {formatPostDate(post.published_at)}
                    {post.author_name ? ` · ${post.author_name}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground">{post.excerpt}</p>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    Read more
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
