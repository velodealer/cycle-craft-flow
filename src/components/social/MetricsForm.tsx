import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const FIELDS = ['views', 'likes', 'comments', 'shares', 'saves'] as const;

export default function MetricsForm({ postId, platforms }: { postId: string; platforms: string[] }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [platform, setPlatform] = useState(platforms[0] || 'tiktok');
  const [vals, setVals] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from('social_post_metrics')
      .select('*')
      .eq('post_id', postId)
      .order('recorded_at', { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, [postId]);

  const add = async () => {
    if (!user) return;
    const payload: any = { post_id: postId, platform, recorded_by: user.id };
    for (const f of FIELDS) payload[f] = parseInt(vals[f] || '0', 10) || 0;
    const { error } = await supabase.from('social_post_metrics').insert(payload);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    setVals({});
    toast({ title: 'Metrics added' });
    load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-xs">Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['tiktok','instagram','facebook','youtube','reels'].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {FIELDS.map(f => (
          <div key={f}>
            <Label className="text-xs capitalize">{f}</Label>
            <Input type="number" min={0} value={vals[f] || ''} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={add}>Add snapshot</Button>

      {rows.length > 0 && (
        <div className="text-xs space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
          {rows.map(r => (
            <div key={r.id} className="flex justify-between border-b last:border-0 py-1">
              <span className="capitalize">{r.platform}</span>
              <span className="text-muted-foreground">
                {r.views} views · {r.likes} likes · {r.comments} comments
              </span>
              <span className="text-muted-foreground">{new Date(r.recorded_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
