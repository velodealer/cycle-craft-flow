import PlaceholderPage from '@/components/PlaceholderPage';
import { Users } from 'lucide-react';

export default function OwnersPage() {
  const features = [
    'Manage bike owners and customers',
    'Track consignment agreements',
    'Handle external owner information',
    'Send approval notifications',
    'Manage contact details',
    'View owner transaction history',
    'Customer communication portal'
  ];

  return (
    <PlaceholderPage
      title="Owners"
      description="Manage customer relationships"
      icon={Users}
      features={features}
    />
  );
}