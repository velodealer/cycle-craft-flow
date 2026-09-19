import { useEffect, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
 * Storage location entered as bay letter + number, applied with an
 * explicit Assign button. Only existing bays can be assigned — bays are
 * created by admins in Settings → Storage bays.
 */
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
  const [bay, setBay] = useState('');
  const [number, setNumber] = useState('');
  const [editing, setEditing] = useState(!value);

  useEffect(() => {
    setCurrent(value ?? null);
    setEditing(!value);
  }, [value]);

  useEffect(() => {
    const found = bays.find((b) => b.id === current);
    const parts = found ? splitName(found.name) : { bay: '', number: '' };
    setBay(parts.bay);
    setNumber(parts.number);
  }, [current, bays]);

  const revert = () => {
    const found = bays.find((b) => b.id === current);
    const parts = found ? splitName(found.name) : { bay: '', number: '' };
    setBay(parts.bay);
    setNumber(parts.number);
  };

  const assign = async () => {
    const name = `${bay.trim().toUpperCase()}${number.trim()}`;
    const currentBay = bays.find((b) => b.id === current);
    if (name === (currentBay?.name ?? '')) return;

    let bayId: string | null = null;
    if (name) {
      const existing = bays.find((b) => b.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        toast({
          title: 'Unknown bay',
          description: `${name} doesn't exist. An admin can add it in Settings → Storage bays.`,
          variant: 'destructive',
        });
        revert();
        return;
      }
      bayId = existing.id;
    }

    setSaving(true);
    try {
      if (bikeId) {
        const { error } = await supabase
          .from('bikes')
          .update({ storage_bay_id: bayId })
          .eq('id', bikeId);
        if (error) throw error;
      }

      setCurrent(bayId);
      setEditing(!bayId);
      onChange?.(bayId);
      toast({
        title: 'Location updated',
        description: name ? `Set to ${name}` : 'Location cleared',
      });
    } catch (error: any) {
      revert();
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      assign();
    }
  };

  const inputClass = cn(size === 'sm' ? 'h-8 text-xs' : '', className);
  const currentBay = bays.find((item) => item.id === current);

  if (currentBay && !editing) {
    return (
      <div className={cn('flex min-w-0 flex-col items-start gap-1', className)} onClick={(e) => e.stopPropagation()}>
        <span className="max-w-full font-medium leading-tight break-words">
          {currentBay.zone ? `${currentBay.zone} · ${currentBay.name}` : currentBay.name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setEditing(true)}
        >
          <Pencil className="mr-1 h-3 w-3" />
          Change bay
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('grid min-w-0 grid-cols-[minmax(3.5rem,0.8fr)_minmax(3.5rem,0.8fr)] gap-1', className)} onClick={(e) => e.stopPropagation()}>
      <Input value={bay} disabled={saving} placeholder="Bay" aria-label="Bay" className={cn(inputClass, 'w-full uppercase')} onChange={(e) => setBay(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())} onKeyDown={handleKeyDown} />
      <Input value={number} inputMode="numeric" disabled={saving} placeholder="No." aria-label="Bay number" className={cn(inputClass, 'w-full')} onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={handleKeyDown} />
      <Button type="button" variant="outline" size={size === 'sm' ? 'sm' : 'default'} className={current ? '' : 'col-span-2'} disabled={saving} onClick={assign} aria-label="Assign location">
        <Check className="mr-1 h-4 w-4" /> Assign
      </Button>
      {current && (
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { revert(); setEditing(false); }}>
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
      )}
    </div>
  );
}
