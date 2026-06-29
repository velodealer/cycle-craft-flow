import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function ScriptForm({ script, onSuccess, onCancel }: {
  script?: any; onSuccess: () => void; onCancel: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(script?.name || '');
  const [category, setCategory] = useState(script?.category || 'walkaround');
  const [body, setBody] = useState(script?.body || '');

  const save = async () => {
    if (!user || !name) return;
    const payload = { name, category, body, created_by: user.id };
    const res = script?.id
      ? await supabase.from('social_scripts').update({ name, category, body }).eq('id', script.id)
      : await supabase.from('social_scripts').insert(payload);
    if (res.error) { toast({ title: 'Save failed', description: res.error.message, variant: 'destructive' }); return; }
    toast({ title: script?.id ? 'Script updated' : 'Script created' });
    onSuccess();
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="3-point walkaround" />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="walkaround">Walkaround</SelectItem>
            <SelectItem value="feature">Feature spotlight</SelectItem>
            <SelectItem value="testimonial">Testimonial</SelectItem>
            <SelectItem value="promo">Promo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Body (use {'{make}'}, {'{model}'} as placeholders)</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  );
}
