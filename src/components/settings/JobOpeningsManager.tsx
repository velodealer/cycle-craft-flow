import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';

interface Opening {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  summary: string | null;
  description: string | null;
  is_open: boolean;
  sort_order: number | null;
}

const empty = {
  id: '',
  slug: '',
  title: '',
  location: '',
  employment_type: '',
  summary: '',
  description: '',
  is_open: true,
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

export default function JobOpeningsManager() {
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from('job_openings')
      .select('*')
      .order('sort_order', { ascending: true });
    setOpenings((data as Opening[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (opening: Opening) => {
    setForm({
      id: opening.id,
      slug: opening.slug,
      title: opening.title,
      location: opening.location ?? '',
      employment_type: opening.employment_type ?? '',
      summary: opening.summary ?? '',
      description: opening.description ?? '',
      is_open: opening.is_open,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Add a job title', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim() || slugify(form.title),
        title: form.title.trim(),
        location: form.location.trim() || null,
        employment_type: form.employment_type.trim() || null,
        summary: form.summary.trim() || null,
        description: form.description || null,
        is_open: form.is_open,
      };
      const query = form.id
        ? supabase.from('job_openings').update(payload).eq('id', form.id)
        : supabase.from('job_openings').insert(payload);
      const { error } = await query;
      if (error) {
        toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: form.id ? 'Role updated' : 'Role created' });
      setOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (opening: Opening) => {
    if (!window.confirm(`Delete "${opening.title}"?`)) return;
    const { error } = await supabase.from('job_openings').delete().eq('id', opening.id);
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
            <Briefcase className="h-5 w-5" /> Job openings
          </CardTitle>
          <CardDescription>Roles shown on the careers page.</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm({ ...empty });
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> New role
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {openings.length === 0 && <p className="text-sm text-muted-foreground">No roles yet.</p>}
        {openings.map((opening) => (
          <div
            key={opening.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium text-foreground">{opening.title}</p>
              <p className="text-xs text-muted-foreground">
                /careers/{opening.slug}
                {opening.location ? ` · ${opening.location}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={opening.is_open ? 'default' : 'secondary'}>
                {opening.is_open ? 'Open' : 'Closed'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => startEdit(opening)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => remove(opening)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit role' : 'New role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="job-title">Title</Label>
              <Input
                id="job-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-location">Location</Label>
                <Input
                  id="job-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-type">Employment type</Label>
                <Input
                  id="job-type"
                  value={form.employment_type}
                  onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-summary">Summary</Label>
              <Textarea
                id="job-summary"
                rows={2}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-description">Full description</Label>
              <Textarea
                id="job-description"
                rows={14}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_open}
                onCheckedChange={(checked) => setForm({ ...form, is_open: checked })}
              />
              <Label>Accepting applications</Label>
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
