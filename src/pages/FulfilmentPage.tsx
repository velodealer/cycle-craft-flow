import PlaceholderPage from '@/components/PlaceholderPage';
import { ClipboardList } from 'lucide-react';

export default function FulfilmentPage() {
  const features = [
    'Track bikes through fulfilment stages',
    'Update bike status (intake → cleaning → inspection → repair → ready)',
    'Log fulfilment events and timestamps',
    'Notify owners of status changes',
    'Generate stage completion reports',
    'Manage approval workflows',
    'Monitor pipeline bottlenecks'
  ];

  return (
    <PlaceholderPage
      title="Fulfilment"
      description="Track bikes through the processing pipeline"
      icon={ClipboardList}
      features={features}
    />
  );
}