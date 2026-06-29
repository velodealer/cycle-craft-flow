import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

const ITEMS = [
  { key: 'filmed', label: 'Filmed' },
  { key: 'edited', label: 'Edited' },
  { key: 'caption_written', label: 'Caption written' },
  { key: 'approved', label: 'Approved' },
  { key: 'posted', label: 'Posted' },
];

export default function PostChecklist({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('social_post_checklist')
      .select('*')
      .eq('post_id', postId);
    setRows(data || []);
  };

  useEffect(() => { load(); }, [postId]);

  const toggle = async (item: string, done: boolean) => {
    const existing = rows.find(r => r.item === item);
    if (existing) {
      await supabase
        .from('social_post_checklist')
        .update({ done, done_by: user?.id, done_at: done ? new Date().toISOString() : null })
        .eq('id', existing.id);
    } else {
      await supabase.from('social_post_checklist').insert({
        post_id: postId, item, done, done_by: user?.id, done_at: done ? new Date().toISOString() : null,
      });
    }
    load();
  };

  const doneCount = rows.filter(r => r.done).length;
  const pct = (doneCount / ITEMS.length) * 100;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Production progress</span>
          <span>{doneCount} / {ITEMS.length}</span>
        </div>
        <Progress value={pct} />
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {ITEMS.map(it => {
          const row = rows.find(r => r.item === it.key);
          return (
            <label key={it.key} className="flex items-center gap-2 text-sm border rounded-md p-2">
              <Checkbox
                checked={!!row?.done}
                onCheckedChange={(c) => toggle(it.key, !!c)}
              />
              {it.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
