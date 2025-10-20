import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface BikeLabelProps {
  bike: {
    id: string;
    make: string;
    model: string;
    frame_number?: string;
    year?: number;
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
  const labelUrl = `${window.location.origin}/bikes?id=${bike.id}`;
  
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
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-2">
        <h1 className="text-2xl font-bold">VeloDealer</h1>
        <p className="text-sm">Bike Tracking Label</p>
      </div>

      {/* Bike Info */}
      <div className="flex-1 flex flex-col justify-center space-y-3 py-4">
        <div>
          <p className="text-xs font-semibold text-gray-600">MAKE & MODEL</p>
          <p className="text-xl font-bold">{bike.make} {bike.model}</p>
        </div>
        
        {bike.year && (
          <div>
            <p className="text-xs font-semibold text-gray-600">YEAR</p>
            <p className="text-lg font-semibold">{bike.year}</p>
          </div>
        )}
        
        {bike.frame_number && (
          <div>
            <p className="text-xs font-semibold text-gray-600">FRAME NUMBER</p>
            <p className="text-base font-mono font-semibold break-all">{bike.frame_number}</p>
          </div>
        )}
        
        <div>
          <p className="text-xs font-semibold text-gray-600">BIKE ID</p>
          <p className="text-sm font-mono">{bike.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center border-t-2 border-black pt-3">
        <QRCodeSVG 
          value={labelUrl}
          size={140}
          level="M"
          includeMargin={false}
        />
        <p className="text-xs mt-2 text-center text-gray-600">Scan to view bike details</p>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 mt-2">
        <p>{new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
}
