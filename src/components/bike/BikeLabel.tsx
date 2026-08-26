import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface BikeLabelProps {
  bike: {
    id: string;
    make: string;
    model: string;
    size?: string | null;
    colour?: string | null;
  };
  onClose: () => void;
}

export default function BikeLabel({ bike, onClose }: BikeLabelProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden sticky top-0 bg-background border-b p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Bike Label Preview (4" x 6")</h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="default">
            <Printer className="h-4 w-4 mr-2" />
            Print Label
          </Button>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>

      {/* Label Container - Centered on screen */}
      <div className="print:hidden flex items-center justify-center min-h-[calc(100vh-80px)] p-8">
        <div className="border-2 border-dashed border-muted-foreground/30 p-4">
          <LabelContent bike={bike} />
        </div>
      </div>

      {/* Label for printing - Hidden on screen */}
      <div className="hidden print:block">
        <LabelContent bike={bike} />
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

function LabelContent({ bike }: { bike: BikeLabelProps['bike'] }) {
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
        <p className="text-xs mt-2 text-center text-gray-600">Scan to view bike details</p>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500">
        <p>
          {bike.id.slice(0, 8)} • {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
