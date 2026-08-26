import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useStorageBays } from '@/hooks/useStorageBays';

const UNASSIGNED = '__unassigned__';

interface LocationSelectProps {
  bikeId: string;
  value: string | null;
  onChange?: (bayId: string | null) => void;
  className?: string;
  size?: 'sm' | 'default';
}

/** Dropdown that assigns a bike to a storage bay; saves immediately. */
export default function LocationSelect({
  bikeId,
  value,
  onChange,
  className,
  size = 'default',
}: LocationSelectProps) {
  const { bays } = useStorageBays();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(value ?? null);

  const handleChange = async (next: string) => {
    const bayId = next === UNASSIGNED ? null : next;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('bikes')
        .update({ storage_bay_id: bayId })
        .eq('id', bikeId);
      if (error) throw error;
      setCurrent(bayId);
      onChange?.(bayId);
      toast({
        title: 'Location updated',
        description: bayId
          ? `Moved to ${bays.find((b) => b.id === bayId)?.name ?? 'bay'}`
          : 'Location cleared',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={current ?? UNASSIGNED} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger
        className={className ?? (size === 'sm' ? 'h-8 w-full text-xs' : 'w-full')}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {bays.map((bay) => (
          <SelectItem key={bay.id} value={bay.id}>
            {bay.zone ? `${bay.zone} · ${bay.name}` : bay.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
