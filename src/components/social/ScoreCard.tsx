import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const FIELDS = [
  { key: 'hook_score', label: 'Hook' },
  { key: 'retention_score', label: 'Retention' },
  { key: 'cta_score', label: 'CTA' },
  { key: 'production_score', label: 'Production' },
];

export default function ScoreCard({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [score, setScore] = useState<any>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('social_post_scores')
      .select('*')
      .eq('post_id', postId)
      .order('scored_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setScore(data);
    if (data) {
      setVals({
        hook_score: data.hook_score?.toString() || '',
        retention_score: data.retention_score?.toString() || '',
        cta_score: data.cta_score?.toString() || '',
        production_score: data.production_score?.toString() || '',
      });
      setNotes(data.notes || '');
    }
  };

  useEffect(() => { load(); }, [postId]);

  const save = async () => {
    if (!user) return;
    const payload: any = {
      post_id: postId,
      scored_by: user.id,
      notes,
    };
    for (const f of FIELDS) {
      const n = parseFloat(vals[f.key]);
      payload[f.key] = isFinite(n) ? n : null;
    }
    let res;
    if (score?.id) {
      res = await supabase.from('social_post_scores').update(payload).eq('id', score.id);
    } else {
      res = await supabase.from('social_post_scores').insert(payload);
    }
    if (res.error) {
      toast({ title: 'Save failed', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Score saved' });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FIELDS.map(f => (
          <div key={f.key}>
            <Label className="text-xs">{f.label} (0–10)</Label>
            <Input
              type="number" min={0} max={10} step={0.1}
              value={vals[f.key] || ''}
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {score?.overall_score != null && (
        <div className="text-sm">
          <span className="text-muted-foreground">Overall: </span>
          <span className="font-semibold">{Number(score.overall_score).toFixed(1)} / 10</span>
        </div>
      )}
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button size="sm" onClick={save}>Save score</Button>
    </div>
  );
}
