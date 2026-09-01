import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Bookmark, Bike as BikeIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  searchSpokes,
  searchLocalCatalog,
  getSpokesBike,
  getLocalCatalogBike,
  mapSpokesBike,
  type SpokesSearchItem,
  type MappedBike,
} from '@/lib/spokes';

interface SpokesLookupProps {
  /** Fired when the user confirms a bike (raw record + mapped values). */
  onSelect: (payload: { raw: any; mapped: MappedBike; size: string | null }) => void;
  confirmLabel?: string;
  initialQuery?: string;
}

export default function SpokesLookup({ onSelect, confirmLabel = 'Use this bike', initialQuery = '' }: SpokesLookupProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SpokesSearchItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SpokesSearchItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [raw, setRaw] = useState<any>(null);
  const [size, setSize] = useState<string>('');

  const mapped = useMemo(() => (raw ? mapSpokesBike(raw, size || null) : null), [raw, size]);

  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) {
      void runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(q: string) {
    const term = q.trim();
    if (term.length < 2) return;
    setSearching(true);
    setSearched(true);
    setSelected(null);
    setRaw(null);
    try {
      const [local, remote] = await Promise.all([
        searchLocalCatalog(term),
        searchSpokes(term).catch((e) => {
          toast({ title: '99spokes search failed', description: e.message, variant: 'destructive' });
          return [] as SpokesSearchItem[];
        }),
      ]);
      const localIds = new Set(local.map((l) => l.id));
      setResults([...local, ...remote.filter((r) => !localIds.has(r.id))]);
    } finally {
      setSearching(false);
    }
  }

  async function pick(item: SpokesSearchItem) {
    setSelected(item);
    setLoadingDetail(true);
    setRaw(null);
    setSize('');
    try {
      let record = item.local ? await getLocalCatalogBike(item.id) : null;
      if (!record) record = await getSpokesBike(item.id);
      setRaw(record);
    } catch (e: any) {
      toast({ title: 'Could not load specification', description: e.message, variant: 'destructive' });
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch(query);
              }
            }}
            placeholder="Search 99spokes, e.g. Specialized Tarmac SL7"
            className="pl-9"
          />
        </div>
        <Button type="button" onClick={() => void runSearch(query)} disabled={searching || query.trim().length < 2}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {searched && !searching && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No matching bikes found.</p>
      )}

      {results.length > 0 && !selected && (
        <div className="max-h-[280px] overflow-y-auto rounded-md border divide-y">
          {results.map((r) => (
            <button
              key={`${r.local ? 'l' : 'r'}-${r.id}`}
              type="button"
              onClick={() => void pick(r)}
              className="w-full flex items-center gap-3 p-2 text-left hover:bg-muted/60"
            >
              {r.thumbnailUrl ? (
                <img src={r.thumbnailUrl} alt={`${r.maker} ${r.model}`} className="h-10 w-14 object-contain" loading="lazy" />
              ) : (
                <div className="h-10 w-14 flex items-center justify-center text-muted-foreground">
                  <BikeIcon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium break-words">
                  {r.year ? `${r.year} ` : ''}{r.maker} {[r.family, r.model].filter(Boolean).join(' ')}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[r.category, r.subcategory].filter(Boolean).join(' · ')}
                </div>
                {(r.groupset || r.wheelset) && (
                  <div className="text-xs text-muted-foreground break-words">
                    {[r.groupset, r.wheelset].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              {r.local && (
                <Badge variant="secondary" className="gap-1 shrink-0">
                  <Bookmark className="h-3 w-3" /> Saved
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {selected.year ? `${selected.year} ` : ''}{selected.maker}{' '}
                {[selected.family, selected.model].filter(Boolean).join(' ')}
              </div>
              <div className="text-xs text-muted-foreground">
                {[selected.category, selected.subcategory].filter(Boolean).join(' · ')}
              </div>
              {(selected.groupset || selected.wheelset) && (
                <div className="text-xs text-muted-foreground">
                  {[selected.groupset, selected.wheelset].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSelected(null); setRaw(null); }}>
              Change
            </Button>
          </div>

          {loadingDetail && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading specification…
            </div>
          )}

          {mapped && (
            <>
              {mapped.sizes.length > 0 && (
                <div className="space-y-1">
                  <Label>Frame size</Label>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a size (optional)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px] overflow-y-auto">
                      {mapped.sizes.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {mapped.components.length} components and {Object.keys(mapped.specValues).length} spec sections found.
              </p>

              <Button
                type="button"
                className="w-full"
                onClick={() => onSelect({ raw, mapped, size: size || null })}
              >
                {confirmLabel}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
