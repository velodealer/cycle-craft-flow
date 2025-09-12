import PlaceholderPage from '@/components/PlaceholderPage';
import { Bike } from 'lucide-react';

export default function BikesPage() {
  const features = [
    'Add new bikes to inventory',
    'Track bike status through fulfilment pipeline',
    'Edit bike details and specifications',
    'Upload and manage bike photos',
    'Set pricing and finance schemes',
    'View bike history and timeline',
    'Export bike data for marketplaces'
  ];

  return (
    <PlaceholderPage
      title="Bikes"
      description="Manage your bicycle inventory and tracking"
      icon={Bike}
      features={features}
    />
  );
}