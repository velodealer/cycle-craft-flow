import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PostDetailView from '@/components/social/PostDetailView';

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

export default function SocialCalendarPage() {
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [posts, setPosts] = useState<any[]>([]);
  const [viewing, setViewing] = useState<any>(null);

  useEffect(() => {
    const from = startOfMonth(cursor).toISOString();
    const to = addMonths(cursor, 1).toISOString();
    supabase.from('social_posts')
      .select('id, title, scheduled_at, posted_at, status, platforms')
      .or(`scheduled_at.gte.${from},posted_at.gte.${from}`)
      .lt('scheduled_at', to)
      .then(({ data }) => setPosts(data || []));
  }, [cursor]);

  const grid = useMemo(() => {
    const first = startOfMonth(cursor);
    const startDay = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startDay; i++) cells.push({ date: null });
    for (let i = 1; i <= daysInMonth; i++) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), i) });
    while (cells.length % 7) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of posts) {
      const d = p.scheduled_at || p.posted_at;
      if (!d) continue;
      const key = new Date(d).toDateString();
      (map[key] = map[key] || []).push(p);
    }
    return map;
  }, [posts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Calendar</h1>
          <p className="text-muted-foreground">Plan what posts when across every channel.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="font-medium w-40 text-center">{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((c, i) => {
              const dayPosts = c.date ? (postsByDay[c.date.toDateString()] || []) : [];
              return (
                <div key={i} className={`min-h-24 border rounded-md p-1 text-xs ${c.date ? 'bg-card' : 'bg-muted/30'}`}>
                  {c.date && (
                    <>
                      <div className="font-medium mb-1">{c.date.getDate()}</div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map(p => (
                          <button
                            key={p.id}
                            onClick={() => setViewing(p)}
                            className="block w-full text-left truncate p-1 rounded bg-primary/10 hover:bg-primary/20"
                          >
                            {p.title}
                          </button>
                        ))}
                        {dayPosts.length > 3 && (
                          <div className="text-muted-foreground">+{dayPosts.length - 3} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          {viewing && <PostDetailView post={viewing} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
