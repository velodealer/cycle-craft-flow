import PlaceholderPage from '@/components/PlaceholderPage';
import { Package } from 'lucide-react';

export default function PartsPage() {
  const features = [
    'Manage parts inventory',
    'Track part types (secondhand, new, stripped, fitted)',
    'Set cost and sale prices',
    'Assign parts to specific bikes',
    'Monitor stock levels',
    'Generate parts reports',
    'Handle supplier relationships'
  ];

  return (
    <PlaceholderPage
      title="Parts"
      description="Track parts inventory and pricing"
      icon={Package}
      features={features}
    />
  );
}