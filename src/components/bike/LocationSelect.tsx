import { useEffect, useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useStorageBays } from '@/hooks/useStorageBays';
import { cn } from '@/lib/utils';

interface LocationSelectProps {
  /** When provided, the location is saved to this bike immediately. */
  bikeId?: string;
  value: string | null;
  onChange?: (bayId: string | null) => void;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Free-text storage location field. Existing bays are offered as suggestions,
 * but any name can be typed; unknown names create a new bay.
 */
export default function LocationSelect({
  bikeId,
  value,
  onChange,
  className,
  size = 'default',
}: LocationSelectProps) {
  const { bays, reload } = useStorageBays();
  const listId = useId();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(value ?? null);
  const [text, setText] = useState('');

  // Keep the input in sync with the resolved bay name.
  useEffect(() => {
    setCurrent(value ?? null);
  }, [value]);

  useEffect(() => {
    const bay = bays.find((b) => b.id === current);
    setText(bay ? bay.name : '');
  }, [current, bays]);

  const commit = async () => {
    const name = text.trim();
    const currentBay = bays.find((b) => b.id === current);
    if (name === (currentBay?.name ?? '')) return;

    setSaving(true);
    try {
      let bayId: string | null = null;

      if (name) {
        const existing = bays.find((b) => b.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          bayId = existing.id;
        } else {
          const { data, error } = await supabase
            .from('storage_bays')
            .insert({ name })
            .select('id')
            .single();
          if (error) throw error;
          bayId = data.id;
          reload();
        }
      }

      if (bikeId) {
        const { error } = await supabase
          .from('bikes')
          .update({ storage_bay_id: bayId })
          .eq('id', bikeId);
        if (error) throw error;
      }

      setCurrent(bayId);
      onChange?.(bayId);
      toast({
        title: 'Location updated',
        description: name ? `Set to ${name}` : 'Location cleared',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Input
        value={text}
        list={listId}
        disabled={saving}
        placeholder="Unassigned"
        className={cn(className ?? (size === 'sm' ? 'h-8 w-full text-xs' : 'w-full'))}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <datalist id={listId}>
        {bays.map((bay) => (
          <option key={bay.id} value={bay.name}>
            {bay.zone ? `${bay.zone} · ${bay.name}` : bay.name}
          </option>
        ))}
      </datalist>
    </>
  );
}
