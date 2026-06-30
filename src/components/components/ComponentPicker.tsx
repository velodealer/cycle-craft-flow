import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ComponentForm, { ComponentRecord } from './ComponentForm';

interface Props {
  categorySlug: string;
  value?: string | null;       // component id
  onChange: (componentId: string | null, component: ComponentRecord | null) => void;
  placeholder?: string;
}

export default function ComponentPicker({ categorySlug, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ComponentRecord[]>([]);
  const [selected, setSelected] = useState<ComponentRecord | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('component_categories').select('id').eq('slug', categorySlug).maybeSingle()
      .then(({ data }) => setCategoryId((data as any)?.id || null));
  }, [categorySlug]);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.id === value) return;
    supabase.from('components').select('*').eq('id', value).maybeSingle()
      .then(({ data }) => setSelected((data as any) || null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open || !categoryId) return;
    let active = true;
    const q = supabase
      .from('components')
      .select('*')
      .eq('category_id', categoryId)
      .order('brand')
      .limit(50);
    const search = query.trim();
    const exec = search
      ? q.or(`brand.ilike.%${search}%,model.ilike.%${search}%,mpn.ilike.%${search}%`)
      : q;
    exec.then(({ data }) => { if (active) setResults((data || []) as ComponentRecord[]); });
    return () => { active = false; };
  }, [open, categoryId, query]);

  const label = selected ? `${selected.brand} ${selected.model}` : (placeholder || 'Select component…');

  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
          <div className="p-2 border-b">
            <Input
              autoFocus
              placeholder="Search brand, model, MPN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches</div>
            )}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelected(c); onChange(c.id, c); setOpen(false); }}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
              >
                <div>
                  <div className="font-medium">{c.brand} {c.model}</div>
                  {c.mpn && <div className="text-xs text-muted-foreground">{c.mpn}</div>}
                </div>
                <Check className={cn('h-4 w-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
              </button>
            ))}
          </div>
          <div className="border-t p-2">
            <Button size="sm" variant="ghost" className="w-full justify-start"
                    onClick={() => { setOpen(false); setCreating(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Create new component
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button type="button" variant="ghost" size="icon"
                onClick={() => { setSelected(null); onChange(null, null); }}>
          <X className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>New component</DialogTitle></DialogHeader>
          <ComponentForm
            defaultCategorySlug={categorySlug}
            onCancel={() => setCreating(false)}
            onSaved={(c) => {
              setCreating(false);
              setSelected(c);
              onChange(c.id, c);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
