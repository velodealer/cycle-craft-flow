import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const PLATFORMS = ['tiktok', 'instagram', 'facebook', 'youtube', 'reels'] as const;

const schema = z.object({
  title: z.string().min(2, 'Title is required'),
  hook: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.string().optional(),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  status: z.enum(['draft', 'scheduled', 'posted', 'archived']),
  scheduled_at: z.string().optional(),
  vehicle_id: z.string().optional(),
  script_id: z.string().optional(),
  assigned_to: z.string().optional(),
  video_url: z.string().url().optional().or(z.literal('')),
});

type FormVals = z.infer<typeof schema>;

interface PostFormProps {
  post?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PostForm({ post, onSuccess, onCancel }: PostFormProps) {
  const { user } = useAuth();
  const [bikes, setBikes] = useState<any[]>([]);
  const [scripts, setScripts] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: post?.title || '',
      hook: post?.hook || '',
      caption: post?.caption || '',
      hashtags: (post?.hashtags || []).join(' '),
      platforms: post?.platforms || ['tiktok'],
      status: post?.status || 'draft',
      scheduled_at: post?.scheduled_at ? post.scheduled_at.slice(0, 16) : '',
      vehicle_id: post?.vehicle_id || undefined,
      script_id: post?.script_id || undefined,
      assigned_to: post?.assigned_to || undefined,
      video_url: post?.video_url || '',
    },
  });

  useEffect(() => {
    (async () => {
      const [b, s, p] = await Promise.all([
        supabase.from('bikes').select('id, make, model, frame_number').order('created_at', { ascending: false }).limit(200),
        supabase.from('social_scripts').select('id, name, category').order('name'),
        supabase.from('profiles').select('user_id, name, email'),
      ]);
      setBikes(b.data || []);
      setScripts(s.data || []);
      setTeam(p.data || []);
    })();
  }, []);

  const platforms = form.watch('platforms');
  const togglePlatform = (p: string) => {
    const next = platforms.includes(p) ? platforms.filter(x => x !== p) : [...platforms, p];
    form.setValue('platforms', next, { shouldValidate: true });
  };

  const onSubmit = async (vals: FormVals) => {
    if (!user) return;
    const payload: any = {
      title: vals.title,
      hook: vals.hook || null,
      caption: vals.caption || '',
      hashtags: (vals.hashtags || '').split(/\s+/).filter(Boolean).map(t => t.replace(/^#/, '')),
      platforms: vals.platforms,
      status: vals.status,
      scheduled_at: vals.scheduled_at ? new Date(vals.scheduled_at).toISOString() : null,
      vehicle_id: vals.vehicle_id || null,
      script_id: vals.script_id || null,
      assigned_to: vals.assigned_to || null,
      video_url: vals.video_url || null,
      posted_at: vals.status === 'posted' ? (post?.posted_at || new Date().toISOString()) : null,
    };

    let res;
    if (post?.id) {
      res = await supabase.from('social_posts').update(payload).eq('id', post.id);
    } else {
      res = await supabase.from('social_posts').insert({ ...payload, created_by: user.id });
    }
    if (res.error) {
      toast({ title: 'Save failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: post?.id ? 'Post updated' : 'Post created' });
    onSuccess();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input {...form.register('title')} placeholder="e.g. 2023 Honda Civic walkaround" />
        {form.formState.errors.title && (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
        )}
      </div>

      <div>
        <Label>Hook (first 3 seconds)</Label>
        <Textarea {...form.register('hook')} rows={2} placeholder="Stop the scroll..." />
      </div>

      <div>
        <Label>Caption</Label>
        <Textarea {...form.register('caption')} rows={3} />
      </div>

      <div>
        <Label>Hashtags (space-separated)</Label>
        <Input {...form.register('hashtags')} placeholder="#cars #dealership #honda" />
      </div>

      <div>
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-3 mt-2">
          {PLATFORMS.map(p => (
            <label key={p} className="flex items-center gap-2 text-sm capitalize">
              <Checkbox checked={platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
              {p}
            </label>
          ))}
        </div>
        {form.formState.errors.platforms && (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.platforms.message as string}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <Select value={form.watch('status')} onValueChange={(v) => form.setValue('status', v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scheduled at</Label>
          <Input type="datetime-local" {...form.register('scheduled_at')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Vehicle (optional)</Label>
          <Select
            value={form.watch('vehicle_id') || 'none'}
            onValueChange={(v) => form.setValue('vehicle_id', v === 'none' ? undefined : v)}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {bikes.map(b => (
                <SelectItem key={b.id} value={b.id}>
                  {b.make} {b.model}{b.frame_number ? ` · ${b.frame_number}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Script (optional)</Label>
          <Select
            value={form.watch('script_id') || 'none'}
            onValueChange={(v) => form.setValue('script_id', v === 'none' ? undefined : v)}
          >
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {scripts.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Assigned to</Label>
          <Select
            value={form.watch('assigned_to') || 'none'}
            onValueChange={(v) => form.setValue('assigned_to', v === 'none' ? undefined : v)}
          >
            <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {team.map(t => (
                <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Video URL (optional)</Label>
          <Input {...form.register('video_url')} placeholder="https://..." />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {post?.id ? 'Save changes' : 'Create post'}
        </Button>
      </div>
    </form>
  );
}
