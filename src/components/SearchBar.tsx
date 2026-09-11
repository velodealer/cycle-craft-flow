import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BikeThumbnail from '@/components/bike/BikeThumbnail';
import { bikeRef } from '@/lib/bikeReference';
import { useBikeSearch } from '@/hooks/useBikeSearch';
import { useStorageBays } from '@/hooks/useStorageBays';

const statusLabel = (status: string) =>
  status === 'pending_approval'
    ? 'Awaiting Approval'
    : status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function SearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { results, loading } = useBikeSearch(searchQuery);
  const { bays } = useStorageBays();

  const bayName = (id: string | null) => {
    if (!id) return null;
    const bay = bays.find((b) => b.id === id);
    if (!bay) return null;
    return bay.zone ? `${bay.zone} · ${bay.name}` : bay.name;
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goTo = (id: string) => {
    setOpen(false);
    setSearchQuery('');
    navigate(`/bikes/${id}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) goTo(results[0].id);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setOpen(false);
  };

  const showPanel = open && searchQuery.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-lg">
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search bikes by reference, make/model, frame number or owner..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border bg-popover shadow-lg">
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No bikes found</div>
          ) : (
            <ul className="divide-y">
              {results.map((bike) => (
                <li key={bike.id}>
                  <button
                    type="button"
                    onClick={() => goTo(bike.id)}
                    className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/60"
                  >
                    <BikeThumbnail
                      photos={bike.photos}
                      alt={`${bike.make} ${bike.model}`}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-sm font-medium leading-tight break-words">
                        {bike.make} {bike.model}
                        {bike.year ? <span className="text-muted-foreground"> · {bike.year}</span> : null}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {bikeRef(bike)}
                        {bike.frame_number ? ` · ${bike.frame_number}` : ''}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{statusLabel(bike.status)}</Badge>
                        {bayName(bike.storage_bay_id) && (
                          <Badge variant="secondary">{bayName(bike.storage_bay_id)}</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
