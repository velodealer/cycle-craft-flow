import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Bookmark, Bike as BikeIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  searchSpokesDetailed,
  searchLocalCatalog,
  getSpokesBike,
  getLocalCatalogBike,
  mapSpokesBike,
  type SpokesSearchItem,
  type MappedBike,
  type SpokesSearchResult,
  type MappedComponent,
} from '@/lib/spokes';
import {
  colourSummary,
  differingDetails,
  similarSpokesKey,
  spokesResultTitle,
} from '@/lib/spokes-result-comparison';

interface SpokesLookupProps {
  /** Fired when the user confirms a bike (raw record + mapped values). */
  onSelect: (payload: { raw: any; mapped: MappedBike; size: string | null }) => void;
  confirmLabel?: string;
  initialQuery?: string;
}

const PART_GROUPS: Array<{ label: string; slots: string[] }> = [
  { label: 'Frame', slots: ['frame', 'fork', 'rear_shock', 'headset'] },
  { label: 'Wheels & tyres', slots: ['wheelset', 'front_hub', 'rear_hub', 'spokes', 'front_tyre', 'rear_tyre'] },
  { label: 'Drivetrain', slots: ['crank', 'power_meter', 'cassette', 'chain', 'front_derailleur', 'rear_derailleur', 'shifters', 'bottom_bracket', 'groupset_battery'] },
  { label: 'Brakes', slots: ['brakes', 'brake_levers', 'disc_rotors'] },
  { label: 'Cockpit & finishing kit', slots: ['handlebars', 'stem', 'grips', 'saddle', 'seatpost', 'pedals'] },
  { label: 'Electric system', slots: ['ebike_system', 'ebike_battery', 'ebike_display', 'ebike_charger'] },
  { label: 'Accessories', slots: ['mudguards', 'rack', 'lights', 'bell', 'kickstand', 'lock'] },
];

const partName = (part: MappedComponent) => [part.brand, part.model, part.mpn].filter(Boolean).join(' · ');
const slotName = (slot: string) => slot.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const partDetails = (part: MappedComponent) => {
  const attributes = Object.entries(part.attributes || {})
    .map(([key, value]) => `${slotName(key)}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  return [part.description, ...attributes].filter(Boolean);
};

export default function SpokesLookup({ onSelect, confirmLabel = 'Use this bike', initialQuery = '' }: SpokesLookupProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [paging, setPaging] = useState(false);
  const [results, setResults] = useState<SpokesSearchItem[]>([]);
  const [searched, setSearched] = useState(false);
  // 99spokes paging cursors are not permitted on this API key, so "Show more"
  // re-asks for a larger page of the same search instead of a next page.
  const MAX_FETCH = 200;
  const [fetchLimit, setFetchLimit] = useState(20);
  const [remoteCount, setRemoteCount] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [usedQuery, setUsedQuery] = useState<string>('');
  const [lastTerm, setLastTerm] = useState('');
  const [selected, setSelected] = useState<SpokesSearchItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [raw, setRaw] = useState<any>(null);
  const [size, setSize] = useState<string>('');
  const [relaxedNote, setRelaxedNote] = useState<string | null>(null);
  const canLoadMore = !selected
    && !searching
    && results.length > 0
    && fetchLimit < MAX_FETCH
    && (totalCount === null || remoteCount < totalCount);

  const mapped = useMemo(() => (raw ? mapSpokesBike(raw, size || null) : null), [raw, size]);
  const comparisonGroups = useMemo(() => {
    const groups = new Map<string, SpokesSearchItem[]>();
    for (const result of results) {
      const key = similarSpokesKey(result);
      groups.set(key, [...(groups.get(key) ?? []), result]);
    }
    return groups;
  }, [results]);

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
    setFetchLimit(20);
    setRemoteCount(0);
    setTotalCount(null);
    setUsedQuery('');
    setLastTerm(term);
    try {
      const [local, remote] = await Promise.all([
        searchLocalCatalog(term),
        searchSpokesDetailed(term).catch((e): SpokesSearchResult => {
          toast({ title: '99spokes search failed', description: e.message, variant: 'destructive' });
          return { items: [], relaxed: false, droppedTerms: [] };
        }),
      ]);
      const remoteRes = remote;
      setRelaxedNote(
        remoteRes.relaxed && remoteRes.items.length
          ? `No exact match — showing closest bikes${remoteRes.droppedTerms.length ? ` (ignored: ${remoteRes.droppedTerms.join(', ')})` : ''}. Pick the right year and spec.`
          : null,
      );
      const localIds = new Set(local.map((l) => l.id));
      setResults([...local, ...remoteRes.items.filter((r) => !localIds.has(r.id))]);
      setRemoteCount(remoteRes.items.length);
      setTotalCount(typeof remoteRes.total === 'number' ? remoteRes.total : null);
      setUsedQuery(remoteRes.usedQuery || term);
    } finally {
      setSearching(false);
    }
  }

  async function loadMore() {
    if (paging || fetchLimit >= MAX_FETCH) return;
    setPaging(true);
    try {
      const term = lastTerm || query.trim();
      const nextLimit = Math.min(fetchLimit + 50, MAX_FETCH);
      const [local, page] = await Promise.all([
        searchLocalCatalog(term),
        searchSpokesDetailed(usedQuery || term, nextLimit),
      ]);
      const localIds = new Set(local.map((l) => l.id));
      setResults([...local, ...page.items.filter((r) => !localIds.has(r.id))]);
      setRemoteCount(page.items.length);
      setTotalCount(typeof page.total === 'number' ? page.total : totalCount);
      setUsedQuery(page.usedQuery || usedQuery);
      setFetchLimit(nextLimit);
    } catch (e: any) {
      toast({ title: 'Could not load more results', description: e.message, variant: 'destructive' });
    } finally {
      setPaging(false);
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
            placeholder="Search 99spokes or paste a 99spokes link"
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

      {relaxedNote && !selected && results.length > 0 && (
        <p className="text-xs text-muted-foreground">{relaxedNote}</p>
      )}

      {results.length > 0 && !selected && (
        <div className="max-h-[280px] overflow-y-auto rounded-md border divide-y">
          {results.map((r) => {
            const comparison = differingDetails(comparisonGroups.get(similarSpokesKey(r)) ?? [r]);
            const hasComparison = comparison.brakes || comparison.cassette || comparison.showColour;
            return (
              <button
                key={`${r.local ? 'l' : 'r'}-${r.id}`}
                type="button"
                onClick={() => void pick(r)}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/60"
              >
                {r.thumbnailUrl ? (
                  <img src={r.thumbnailUrl} alt={`${r.maker} ${r.model}`} className="mt-0.5 h-12 w-16 shrink-0 object-contain" loading="lazy" />
                ) : (
                  <div className="mt-0.5 h-12 w-16 shrink-0 flex items-center justify-center text-muted-foreground">
                    <BikeIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-medium break-words">{spokesResultTitle(r)}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.category, r.subcategory].filter(Boolean).join(' · ')}
                  </div>
                  {(r.groupset || r.wheelset) && (
                    <div className="text-xs text-muted-foreground break-words">
                      {[r.groupset, r.wheelset].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {hasComparison && (
                    <div className="mt-2 space-y-1 border-l-2 border-primary/50 pl-2 text-xs">
                      <div className="font-medium text-foreground">How this one differs</div>
                      {comparison.brakes && <div><span className="text-muted-foreground">Brakes: </span>{r.brakes || 'Not supplied'}</div>}
                      {comparison.cassette && <div><span className="text-muted-foreground">Cassette: </span>{r.cassette || 'Not supplied'}</div>}
                      {comparison.showColour && <div><span className="text-muted-foreground">Colour: </span>{colourSummary(r.colours)}</div>}
                    </div>
                  )}
                </div>
                {r.local && (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <Bookmark className="h-3 w-3" /> Saved
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}

      {canLoadMore && (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void loadMore()} disabled={paging}>
          {paging ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
            </>
          ) : (
            'Show more results'
          )}
        </Button>
      )}

      {selected && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {spokesResultTitle(selected)}
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

              <div className="max-h-[320px] space-y-4 overflow-y-auto rounded-md border p-3">
                {mapped.components.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No component details were supplied by 99Spokes.</p>
                ) : (
                  PART_GROUPS.map((group) => {
                    const parts = mapped.components.filter((part) => group.slots.includes(part.slot));
                    if (!parts.length) return null;
                    return (
                      <section key={group.label} className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">{group.label}</h4>
                        {parts.map((part) => (
                          <div key={part.slot} className="border-l-2 border-border pl-3">
                            <div className="text-xs font-medium">{slotName(part.slot)}</div>
                            <div className="text-sm break-words">{partName(part)}</div>
                            {partDetails(part).map((detail, index) => (
                              <div key={`${part.slot}-${index}`} className="text-xs text-muted-foreground break-words">{detail}</div>
                            ))}
                          </div>
                        ))}
                      </section>
                    );
                  })
                )}
              </div>

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
