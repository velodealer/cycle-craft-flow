import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, Calendar, FileText, Star } from 'lucide-react';

export default function SocialDashboardPage() {
  const [stats, setStats] = useState({ week: 0, scheduled: 0, drafts: 0, avgScore: 0 });
  const [today, setToday] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const dayStart = new Date(); dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

      const [wk, sch, dr, tdy, scores] = await Promise.all([
        supabase.from('social_posts').select('id', { count: 'exact', head: true }).gte('posted_at', weekAgo.toISOString()),
        supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('social_posts').select('id, title, status, platforms, scheduled_at')
          .gte('scheduled_at', dayStart.toISOString()).lt('scheduled_at', dayEnd.toISOString())
          .order('scheduled_at'),
        supabase.from('social_post_scores').select('overall_score, post_id, social_posts(title)').order('overall_score', { ascending: false }).limit(5),
      ]);

      const avg = scores.data?.length
        ? scores.data.reduce((s: number, r: any) => s + (Number(r.overall_score) || 0), 0) / scores.data.length
        : 0;

      setStats({ week: wk.count || 0, scheduled: sch.count || 0, drafts: dr.count || 0, avgScore: avg });
      setToday(tdy.data || []);
      setTop(scores.data || []);
    })();
  }, []);

  const cards = [
    { label: 'Posted this week', value: stats.week, icon: TrendingUp },
    { label: 'Scheduled', value: stats.scheduled, icon: Calendar },
    { label: 'Drafts', value: stats.drafts, icon: FileText },
    { label: 'Avg score', value: stats.avgScore.toFixed(1), icon: Star },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Social Planner</h1>
          <p className="text-muted-foreground">One operating system so no vehicle stays invisible.</p>
        </div>
        <Button asChild><Link to="/social/posts"><Plus className="h-4 w-4 mr-2" />New post</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                  <div>
                    <div className="text-2xl font-bold">{c.value}</div>
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Going out today</CardTitle></CardHeader>
          <CardContent>
            {today.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nothing scheduled today.</p>
            ) : (
              <div className="space-y-2">
                {today.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 border rounded-md">
                    <div>
                      <div className="font-medium text-sm">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{new Date(p.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="flex gap-1">
                      {p.platforms?.map((pl: string) => <Badge key={pl} variant="outline" className="capitalize">{pl}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top-scoring posts</CardTitle></CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No scores recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {top.map((s: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 border rounded-md">
                    <div className="text-sm font-medium">{s.social_posts?.title || '—'}</div>
                    <Badge>{Number(s.overall_score).toFixed(1)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
