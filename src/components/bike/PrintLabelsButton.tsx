import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import BikeLabels, { type LabelBike } from './BikeLabels';

interface PrintLabelsButtonProps {
  /** All bikes currently shown in the list */
  bikes: LabelBike[];
  /** Optional subset of selected ids; when non-empty only these are printed */
  selectedIds?: Set<string>;
  className?: string;
}

export default function PrintLabelsButton({ bikes, selectedIds, className }: PrintLabelsButtonProps) {
  const [open, setOpen] = useState(false);

  const target =
    selectedIds && selectedIds.size > 0 ? bikes.filter((b) => selectedIds.has(b.id)) : bikes;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={className}
        disabled={target.length === 0}
        onClick={() => setOpen(true)}
      >
        <Printer className="h-4 w-4 mr-2" />
        Print labels{target.length ? ` (${target.length})` : ''}
      </Button>
      {open && <BikeLabels bikes={target} onClose={() => setOpen(false)} />}
    </>
  );
}
