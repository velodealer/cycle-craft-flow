import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PostChecklist from './PostChecklist';
import ScoreCard from './ScoreCard';
import MetricsForm from './MetricsForm';

export default function PostDetailView({ post }: { post: any }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="capitalize">{post.status}</Badge>
        {post.platforms?.map((p: string) => (
          <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
        ))}
        {post.scheduled_at && (
          <Badge variant="outline">Scheduled {new Date(post.scheduled_at).toLocaleString()}</Badge>
        )}
      </div>

      {post.hook && (
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Hook</div>
          <p className="text-sm">{post.hook}</p>
        </div>
      )}
      {post.caption && (
        <div>
          <div className="text-xs uppercase text-muted-foreground mb-1">Caption</div>
          <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
        </div>
      )}
      {post.hashtags?.length > 0 && (
        <div className="text-xs text-primary">{post.hashtags.map((h: string) => `#${h}`).join(' ')}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Production checklist</CardTitle></CardHeader>
        <CardContent><PostChecklist postId={post.id} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Performance scoring</CardTitle></CardHeader>
        <CardContent><ScoreCard postId={post.id} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Metrics</CardTitle></CardHeader>
        <CardContent><MetricsForm postId={post.id} platforms={post.platforms || []} /></CardContent>
      </Card>
    </div>
  );
}
