import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  catalogBrands,
  loadBrandModels,
  formatSizeLabel,
  sizeValue,
  modelSummary,
  type CatalogBrand,
  type CatalogModel,
} from '@/lib/bikeCatalog';

export interface CatalogSelection {
  make: string;
  model: string;
  size?: string;
  summary?: string;
}

interface Props {
  onApply: (selection: CatalogSelection) => void;
}

export default function BikeCatalogLookup({ onApply }: Props) {
  const [brand, setBrand] = useState<CatalogBrand | null>(null);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [model, setModel] = useState<CatalogModel | null>(null);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandOpen, setBrandOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  useEffect(() => {
    if (!brand) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setModels([]);
    setModel(null);
    setSizeIdx(null);
    loadBrandModels(brand.slug)
      .then((m) => {
        if (!cancelled) setModels(m);
      })
      .catch(() => {
        if (!cancelled) setError('Catalog unavailable — enter details manually');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  const sizes = useMemo(() => model?.sizes?.filter(Boolean) ?? [], [model]);

  const apply = () => {
    if (!brand || !model) return;
    const size = sizeIdx !== null && sizes[sizeIdx] ? sizeValue(sizes[sizeIdx]) : undefined;
    onApply({ make: brand.name, model: model.model, size, summary: modelSummary(model) });
  };

  return (
    <div className="rounded-lg border border-dashed p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Search className="h-4 w-4 text-muted-foreground" />
        Look up bike
        <span className="text-xs font-normal text-muted-foreground">
          Autofill make, model and size from the open bicycle catalog
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Brand */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Brand</Label>
          <Popover open={brandOpen} onOpenChange={setBrandOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                <span className="truncate">{brand ? brand.name : 'Select brand'}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[320px] overflow-hidden p-0" align="start">
              <Command>
                <CommandInput placeholder="Search brands..." />
                <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain touch-pan-y">
                  <CommandEmpty>No brand found.</CommandEmpty>
                  <CommandGroup>
                    {catalogBrands.map((b) => (
                      <CommandItem
                        key={b.slug}
                        value={b.name}
                        onSelect={() => {
                          setBrand(b);
                          setBrandOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', brand?.slug === b.slug ? 'opacity-100' : 'opacity-0')} />
                        {b.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Model */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Model</Label>
          <Popover open={modelOpen} onOpenChange={setModelOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                disabled={!brand || loading || !!error}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {loading ? 'Loading models...' : model ? model.model : 'Select model'}
                </span>
                {loading ? (
                  <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[320px] overflow-hidden p-0" align="start">
              <Command>
                <CommandInput placeholder="Search models..." />
                <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain touch-pan-y">
                  <CommandEmpty>No model found.</CommandEmpty>
                  <CommandGroup>
                    {models.map((m, i) => (
                      <CommandItem
                        key={`${m.model}-${i}`}
                        value={`${m.model} ${m.type ?? ''}`}
                        onSelect={() => {
                          setModel(m);
                          setSizeIdx(null);
                          setModelOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', model === m ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">
                          {m.model}
                          {modelSummary(m) && (
                            <span className="ml-2 text-xs text-muted-foreground">{modelSummary(m)}</span>
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Size */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Size (optional)</Label>
          <Popover open={sizeOpen} onOpenChange={setSizeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                disabled={sizes.length === 0}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {sizeIdx !== null && sizes[sizeIdx] ? formatSizeLabel(sizes[sizeIdx]) : 'Select size'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[320px] overflow-hidden p-0" align="start">
              <Command>
                <CommandList className="max-h-[280px] overflow-y-auto overscroll-contain touch-pan-y">
                  <CommandEmpty>No sizes recorded.</CommandEmpty>
                  <CommandGroup>
                    {sizes.map((s, i) => (
                      <CommandItem
                        key={i}
                        value={`${formatSizeLabel(s)}-${i}`}
                        onSelect={() => {
                          setSizeIdx(i);
                          setSizeOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4', sizeIdx === i ? 'opacity-100' : 'opacity-0')} />
                        {formatSizeLabel(s)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={apply} disabled={!brand || !model}>
          Apply to form
        </Button>
      </div>
    </div>
  );
}
