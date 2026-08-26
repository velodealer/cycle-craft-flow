import { useEffect, useState } from 'react';
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

/** Split a stored bay name like "A12" into its letter and number parts. */
function splitName(name: string): { bay: string; number: string } {
  const match = name.trim().match(/^([A-Za-z]*)\s*-?\s*(\d*)$/);
  if (match) return { bay: match[1].toUpperCase(), number: match[2] };
  return { bay: name.trim().toUpperCase(), number: '' };
}

/**
 * Storage location entered as two plain fields: bay letter + number.
 * Unknown combinations create a new bay automatically.
 */
export default function LocationSelect({
  bikeId,
  value,
  onChange,
  className,
  size = 'default',
}: LocationSelectProps) {
  const { bays, reload } = useStorageBays();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(value ?? null);
  const [bay, setBay] = useState('');
  const [number, setNumber] = useState('');

  useEffect(() => {
    setCurrent(value ?? null);
  }, [value]);

  useEffect(() => {
    const found = bays.find((b) => b.id === current);
    const parts = found ? splitName(found.name) : { bay: '', number: '' };
    setBay(parts.bay);
    setNumber(parts.number);
  }, [current, bays]);

  const commit = async (nextBay: string, nextNumber: string) => {
    const name = `${nextBay.trim().toUpperCase()}${nextNumber.trim()}`;
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

  const inputClass = cn(size === 'sm' ? 'h-8 text-xs' : '', className);

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        value={bay}
        disabled={saving}
        placeholder="Bay"
        aria-label="Bay"
        className={cn(inputClass, 'w-16 uppercase')}
        onChange={(e) => setBay(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
        onBlur={() => commit(bay, number)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <Input
        value={number}
        inputMode="numeric"
        disabled={saving}
        placeholder="No."
        aria-label="Bay number"
        className={cn(inputClass, 'w-16')}
        onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => commit(bay, number)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}
