import PlaceholderPage from '@/components/PlaceholderPage';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const features = [
    'User management and roles',
    'System configuration',
    'Integration settings (Shopify, eBay)',
    'Email and notification preferences',
    'VAT and pricing schemes',
    'Backup and export options',
    'Security and access controls'
  ];

  return (
    <PlaceholderPage
      title="Settings"
      description="System configuration and preferences"
      icon={Settings}
      features={features}
    />
  );
}