import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatPostDate } from './BlogPage';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  tags: string[] | null;
  author_name: string | null;
  published_at: string | null;
}

function renderBody(body: string) {
  const blocks = body.split(/\n\s*\n/);
  return blocks.map((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={index} className="mt-10 text-2xl font-semibold tracking-tight text-foreground">
          {trimmed.slice(3)}
        </h2>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={index} className="mt-8 text-xl font-semibold text-foreground">
          {trimmed.slice(4)}
        </h3>
      );
    }
    if (/^[-*] /m.test(trimmed) && trimmed.split('\n').every((line) => /^[-*] /.test(line.trim()))) {
      return (
        <ul key={index} className="mt-4 list-disc space-y-1 pl-6 text-muted-foreground">
          {trimmed.split('\n').map((line, i) => (
            <li key={i}>{line.trim().replace(/^[-*] /, '')}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={index} className="mt-4 text-muted-foreground">
        {trimmed}
      </p>
    );
  });
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('blog_posts')
        .select('id, slug, title, excerpt, body, cover_image_url, tags, author_name, published_at')
        .eq('slug', slug ?? '')
        .eq('status', 'published')
        .maybeSingle();
      if (!active) return;
      setPost((data as BlogPost) ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <PublicLayout
      title={post?.title ?? 'Blog'}
      description={post?.excerpt ?? 'An article from the VeloDealer blog.'}
    >
      <article className="container mx-auto max-w-3xl px-4 py-16">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !post ? (
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">We couldn't find that article</h1>
            <p className="mt-2 text-muted-foreground">It may have been moved or unpublished.</p>
            <Button asChild className="mt-6">
              <Link to="/blog">Back to the blog</Link>
            </Button>
          </div>
        ) : (
          <>
            <Link to="/blog" className="text-sm text-primary hover:underline">
              ← All articles
            </Link>
            <div className="mt-6 flex flex-wrap gap-2">
              {(post.tags ?? []).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-foreground">{post.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatPostDate(post.published_at)}
              {post.author_name ? ` · ${post.author_name}` : ''}
            </p>
            {post.cover_image_url && (
              <img
                src={post.cover_image_url}
                alt={post.title}
                loading="lazy"
                className="mt-8 w-full rounded-lg object-cover"
              />
            )}
            <div className="mt-8 leading-relaxed">{renderBody(post.body)}</div>

            <div className="mt-12 rounded-lg border bg-muted/40 p-6 text-center">
              <p className="font-medium text-foreground">Want this running in your shop?</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/contact">Talk to us</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </article>
    </PublicLayout>
  );
}
