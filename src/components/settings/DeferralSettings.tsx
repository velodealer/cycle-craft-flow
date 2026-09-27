import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_SAFETY_KEYWORDS, deferralKey, normaliseKeywords } from '@/lib/deferredJobs';

/** Owner-editable list of safety words: jobs mentioning them show a warning when deferred. */
export default function DeferralSettings() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [text, setText] = useState(DEFAULT_SAFETY_KEYWORDS.join(', '));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: bid } = await supabase.rpc('current_business_id');
      if (!bid) return;
      setBusinessId(bid as string);
      const { data } = await supabase.from('app_settings').select('value').eq('key', deferralKey(bid as string)).maybeSingle();
      setText(normaliseKeywords(data?.value).join(', '));
    })();
  }, []);

  const save = async () => {
    if (!businessId) return;
    setSaving(true);
    const safety_keywords = text.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { error } = await supabase.from('app_settings').upsert({ key: deferralKey(businessId), value: { safety_keywords } as never }, { onConflict: 'key' });
    setSaving(false);
    if (error) toast.error(`Could not save: ${error.message}`); else toast.success('Deferral rules saved');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Deferred jobs</CardTitle>
        <CardDescription>
          Owners and admins can defer small workshop jobs so a bike can be listed. Deferred jobs must be done before collection or delivery.
          Any job can be deferred. Jobs whose title or description contains one of these safety words show an extra warning first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setText(DEFAULT_SAFETY_KEYWORDS.join(', '))}>Reset to defaults</Button>
          <Button onClick={save} disabled={saving || !businessId}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
