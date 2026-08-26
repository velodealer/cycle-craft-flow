import { bikeRef } from '@/lib/bikeReference';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export interface LabelBike {
  id: string;
  reference?: string | null;
  make: string;
  model: string;
  size?: string | null;
  colour?: string | null;
}

interface BikeLabelsProps {
  bikes: LabelBike[];
  onClose: () => void;
}

export default function BikeLabels({ bikes, onClose }: BikeLabelsProps) {
  const handlePrint = () => window.print();
  const count = bikes.length;

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-background border-b p-4 flex flex-wrap gap-2 justify-between items-center">
        <h2 className="text-lg font-semibold">
          {count === 1 ? 'Bike Label Preview' : `${count} labels`} (4" x 6")
        </h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="default" disabled={count === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {count === 1 ? 'Print label' : `Print ${count} labels`}
          </Button>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>

      {/* On-screen preview */}
      <div className="print:hidden flex flex-wrap items-start justify-center gap-6 p-8">
        {bikes.map((bike) => (
          <div key={bike.id} className="border-2 border-dashed border-muted-foreground/30 p-4">
            <LabelContent bike={bike} />
          </div>
        ))}
      </div>

      {/* Print output - one label per page */}
      <div className="hidden print:block">
        {bikes.map((bike, i) => (
          <div key={bike.id} style={i < bikes.length - 1 ? { breakAfter: 'page', pageBreakAfter: 'always' } : undefined}>
            <LabelContent bike={bike} />
          </div>
        ))}
      </div>

      <style>{`
        @media print {
          @page {
            size: 4in 6in;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function LabelContent({ bike }: { bike: LabelBike }) {
  const labelUrl = `${window.location.origin}/bikes/${bike.id}`;

  return (
    <div
      className="bg-white text-black"
      style={{
        width: '4in',
        height: '6in',
        padding: '0.3in',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Bike Info */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-600">BRAND</p>
          <p className="text-2xl font-bold leading-tight">{bike.make}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-600">MODEL</p>
          <p className="text-xl font-semibold leading-tight">{bike.model}</p>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="text-xs font-semibold text-gray-600">SIZE</p>
            <p className="text-lg font-semibold">{bike.size || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600">COLOUR</p>
            <p className="text-lg font-semibold">{bike.colour || '—'}</p>
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center border-t-2 border-black pt-3">
        <QRCodeSVG value={labelUrl} size={160} level="M" includeMargin={false} />
        <p className="text-sm mt-2 text-center font-mono font-bold">{bikeRef(bike)}</p>
        <p className="text-xs text-center text-gray-600">Scan to view bike details</p>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500">
        <p>
          {bikeRef(bike)} • {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
