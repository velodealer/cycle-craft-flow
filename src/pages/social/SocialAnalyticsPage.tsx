import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/velo/PageShell';
import { StatBlock } from '@/components/velo/StatBlock';

export default function SocialAnalyticsPage() {
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [perUser, setPerUser] = useState<any[]>([]);
  const [totals, setTotals] = useState({ views: 0, likes: 0, comments: 0 });

  useEffect(() => {
    (async () => {
      const { data: metrics } = await supabase.from('social_post_metrics').select('views, likes, comments');
      if (metrics) {
        setTotals({
          views: metrics.reduce((s, m) => s + (m.views || 0), 0),
          likes: metrics.reduce((s, m) => s + (m.likes || 0), 0),
          comments: metrics.reduce((s, m) => s + (m.comments || 0), 0),
        });
      }

      const { data: scores } = await supabase.from('social_post_scores')
        .select('overall_score, social_posts(title, assigned_to)')
        .order('overall_score', { ascending: false })
        .limit(10);
      setTopPosts(scores || []);

      const [{ data: posts }, { data: profiles }] = await Promise.all([
        supabase.from('social_posts').select('assigned_to, status'),
        supabase.from('profiles').select('user_id, name, email'),
      ]);
      if (posts) {
        const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p.name || p.email || 'Unknown']));
        const byUser: Record<string, { name: string; total: number; posted: number }> = {};
        for (const p of posts as any[]) {
          if (!p.assigned_to) continue;
          const key = p.assigned_to;
          if (!byUser[key]) byUser[key] = { name: profMap.get(key) || 'Unknown', total: 0, posted: 0 };
          byUser[key].total++;
          if (p.status === 'posted') byUser[key].posted++;
        }
        setPerUser(Object.values(byUser).sort((a, b) => b.posted - a.posted));
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Performance" description="What content is actually pulling attention." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatBlock label="Total views" value={totals.views.toLocaleString()} />
        <StatBlock label="Total likes" value={totals.likes.toLocaleString()} />
        <StatBlock label="Total comments" value={totals.comments.toLocaleString()} />
      </div>

      <Card>
        <CardHeader><CardTitle>Top-scoring posts</CardTitle></CardHeader>
        <CardContent>
          {topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No scores yet.</p>
          ) : (
            <div className="space-y-2">
              {topPosts.map((s: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 border rounded-md">
                  <div className="text-sm font-medium">{s.social_posts?.title || '—'}</div>
                  <Badge>{Number(s.overall_score).toFixed(1)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Team accountability</CardTitle></CardHeader>
        <CardContent>
          {perUser.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No assignments yet.</p>
          ) : (
            <div className="space-y-2">
              {perUser.map((u, i) => (
                <div key={i} className="flex justify-between items-center p-3 border rounded-md">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.posted} posted / {u.total} assigned
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
