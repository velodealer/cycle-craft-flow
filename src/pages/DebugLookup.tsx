import { useState } from 'react';
import { Search, Bookmark, Bike as BikeIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const results = [
  { id: '1', year: 2023, maker: 'Specialized', family: 'Tarmac', model: 'Tarmac SL7 Comp', category: 'road', subcategory: 'race', local: false },
  { id: '2', year: 2023, maker: 'Specialized', family: 'Tarmac', model: 'S-Works Tarmac SL7', category: 'road', subcategory: 'race', local: true },
  { id: '3', year: 2022, maker: 'Specialized', family: 'Tarmac', model: 'S-Works Tarmac SL7 Frameset', category: 'road', subcategory: 'race', local: false },
];

function LookupMarkup() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search 99spokes, e.g. Specialized Tarmac SL7" className="pl-9" />
        </div>
        <Button type="button">Search</Button>
      </div>
      <div className="max-h-[280px] overflow-y-auto rounded-md border divide-y">
        {results.map((r) => (
          <button key={r.id} type="button" className="w-full flex items-center gap-3 p-2 text-left hover:bg-muted/60">
            <div className="h-10 w-14 flex items-center justify-center text-muted-foreground">
              <BikeIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {r.year} {r.maker} {[r.family, r.model].filter(Boolean).join(' ')}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {[r.category, r.subcategory].filter(Boolean).join(' · ')}
              </div>
            </div>
            {r.local && (
              <Badge variant="secondary" className="gap-1 shrink-0">
                <Bookmark className="h-3 w-3" /> Saved
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DebugLookup() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Bike</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-dashed p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    Look up bike
                  </div>
                  <Tabs defaultValue="spokes">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="spokes">99spokes</TabsTrigger>
                      <TabsTrigger value="open">Open catalog</TabsTrigger>
                    </TabsList>
                    <TabsContent value="spokes" className="pt-3">
                      <LookupMarkup />
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
