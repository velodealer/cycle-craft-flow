import PlaceholderPage from '@/components/PlaceholderPage';
import { Wrench } from 'lucide-react';

export default function JobsPage() {
  const features = [
    'Create workshop and detailing jobs',
    'Assign jobs to mechanics and detailers',
    'Track job progress and status',
    'Estimate and record costs',
    'Generate job invoices',
    'Monitor completion times',
    'View job history and performance'
  ];

  return (
    <PlaceholderPage
      title="Jobs"
      description="Manage repair and service jobs"
      icon={Wrench}
      features={features}
    />
  );
}