import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  tags: string[] | null;
  status: string;
  author_name: string | null;
  published_at: string | null;
}

const emptyPost = {
  id: '',
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  cover_image_url: '',
  tags: '',
  status: 'draft',
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

export default function BlogManager() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyPost });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });
    setPosts((data as Post[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setForm({ ...emptyPost });
    setOpen(true);
  };

  const startEdit = (post: Post) => {
    setForm({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? '',
      body: post.body,
      cover_image_url: post.cover_image_url ?? '',
      tags: (post.tags ?? []).join(', '),
      status: post.status,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: 'Add a title and some text', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim() || slugify(form.title),
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        body: form.body,
        cover_image_url: form.cover_image_url.trim() || null,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        status: form.status,
        author_name: profile?.name ?? 'VeloDealer',
        published_at: form.status === 'published' ? new Date().toISOString() : null,
      };

      const existing = posts.find((p) => p.id === form.id);
      const query = form.id
        ? supabase
            .from('blog_posts')
            .update({
              ...payload,
              author_name: existing?.author_name ?? payload.author_name,
              published_at:
                form.status === 'published'
                  ? existing?.published_at ?? new Date().toISOString()
                  : null,
            })
            .eq('id', form.id)
        : supabase.from('blog_posts').insert(payload);

      const { error } = await query;
      if (error) {
        toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: form.id ? 'Post updated' : 'Post created' });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: Post) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', post.id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Blog posts
          </CardTitle>
          <CardDescription>Write and publish articles on the public website.</CardDescription>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" /> New post
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet.</p>}
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium text-foreground">{post.title}</p>
              <p className="text-xs text-muted-foreground">/blog/{post.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                {post.status}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => startEdit(post)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => remove(post)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit post' : 'New post'}</DialogTitle>
            <DialogDescription>
              Use a blank line between paragraphs. Start a line with ## for a heading or - for a
              bullet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slug">Web address (optional)</Label>
                <Input
                  id="slug"
                  placeholder={slugify(form.title)}
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Summary</Label>
              <Textarea
                id="excerpt"
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover">Cover image address (optional)</Label>
              <Input
                id="cover"
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Article</Label>
              <Textarea
                id="body"
                rows={16}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
