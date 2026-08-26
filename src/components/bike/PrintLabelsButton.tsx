import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { downloadBikeLabelsPdf, type PdfLabelBike } from '@/lib/bikeLabelPdf';
import { toast } from 'sonner';

export type LabelBike = PdfLabelBike;

interface PrintLabelsButtonProps {
  /** All bikes currently shown in the list */
  bikes: LabelBike[];
  /** Optional subset of selected ids; when non-empty only these are printed */
  selectedIds?: Set<string>;
  className?: string;
}

export default function PrintLabelsButton({ bikes, selectedIds, className }: PrintLabelsButtonProps) {
  const [busy, setBusy] = useState(false);

  const target =
    selectedIds && selectedIds.size > 0 ? bikes.filter((b) => selectedIds.has(b.id)) : bikes;

  const handleClick = async () => {
    if (!target.length) return;
    setBusy(true);
    try {
      await downloadBikeLabelsPdf(target, window.location.origin);
    } catch (e) {
      console.error(e);
      toast.error('Could not generate the labels PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={target.length === 0 || busy}
      onClick={handleClick}
    >
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
      Labels{target.length ? ` (${target.length})` : ''}
    </Button>
  );
}
