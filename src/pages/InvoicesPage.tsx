import PlaceholderPage from '@/components/PlaceholderPage';
import { FileText } from 'lucide-react';

export default function InvoicesPage() {
  const features = [
    'Create sale and service invoices',
    'Handle VAT calculations and schemes',
    'Track payment status',
    'Generate PDF invoices',
    'Manage customer billing',
    'Record transactions',
    'Financial reporting integration'
  ];

  return (
    <PlaceholderPage
      title="Invoices"
      description="Handle billing and payments"
      icon={FileText}
      features={features}
    />
  );
}