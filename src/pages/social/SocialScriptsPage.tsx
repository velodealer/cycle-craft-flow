import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import ScriptForm from '@/components/social/ScriptForm';

export default function SocialScriptsPage() {
  const [scripts, setScripts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('social_scripts').select('*').order('updated_at', { ascending: false });
    setScripts(data || []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Script Library</h1>
          <p className="text-muted-foreground">Walkaround templates that maximise retention and intent.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" />New script</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scripts.length === 0 && (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No scripts yet.</CardContent></Card>
        )}
        {scripts.map(s => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setEditing(s)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <Badge variant="outline" className="capitalize">{s.category}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.body || 'No body yet.'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); }}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit script' : 'New script'}</DialogTitle></DialogHeader>
          <ScriptForm
            script={editing}
            onSuccess={() => { setCreating(false); setEditing(null); load(); }}
            onCancel={() => { setCreating(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
