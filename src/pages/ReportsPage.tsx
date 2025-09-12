import PlaceholderPage from '@/components/PlaceholderPage';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
  const features = [
    'Stock aging reports',
    'Sales pipeline analysis',
    'Workshop performance metrics',
    'Margin analysis and profitability',
    'Revenue tracking',
    'Inventory turnover rates',
    'Custom report builder'
  ];

  return (
    <PlaceholderPage
      title="Reports"
      description="View performance and analytics"
      icon={BarChart3}
      features={features}
    />
  );
}