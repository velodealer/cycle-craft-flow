import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import ComponentForm, { ComponentCategory, ComponentRecord } from './ComponentForm';
import { toast } from '@/hooks/use-toast';

type Row = ComponentRecord & { component_categories: { name: string; slug: string } | null };

export default function ComponentList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<ComponentCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ComponentRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('components')
      .select('*, component_categories(name, slug)')
      .order('brand');
    if (categoryId !== 'all') q = q.eq('category_id', categoryId);
    const search = query.trim();
    if (search) q = q.or(`brand.ilike.%${search}%,model.ilike.%${search}%,mpn.ilike.%${search}%`);
    const { data, error } = await q.limit(200);
    if (!error) setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('component_categories').select('id, slug, name').order('sort_order')
      .then(({ data }) => setCategories((data || []) as ComponentCategory[]));
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [categoryId, query]);

  const remove = async (id: string) => {
    if (!confirm('Delete this component? It will be removed from the library.')) return;
    const { error } = await supabase.from('components').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Component deleted' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Search brand, model, MPN…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="w-56">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />New component</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>MPN</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No components</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.brand}</TableCell>
                <TableCell>{r.model}</TableCell>
                <TableCell>{r.component_categories?.name || '—'}</TableCell>
                <TableCell>{r.mpn || '—'}</TableCell>
                <TableCell>{r.weight_g ? `${r.weight_g} g` : '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Edit component' : 'New component'}</DialogTitle></DialogHeader>
          <ComponentForm
            component={editing}
            onCancel={() => { setCreating(false); setEditing(null); }}
            onSaved={() => { setCreating(false); setEditing(null); load(); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
