import PlaceholderPage from '@/components/PlaceholderPage';
import UserManagement from '@/components/UserManagement';
import CycleCourierIntegration from '@/components/settings/CycleCourierIntegration';
import TypeformIntegration from '@/components/settings/TypeformIntegration';
import ShopifyIntegration from '@/components/settings/ShopifyIntegration';
import EbayIntegration from '@/components/settings/EbayIntegration';
import QuickBooksIntegration from '@/components/settings/QuickBooksIntegration';
import ListingFormats from '@/components/settings/ListingFormats';
import StorageBays from '@/components/settings/StorageBays';
import InspectABikeIntegration from '@/components/settings/InspectABikeIntegration';
import EmailNotifications from '@/components/settings/EmailNotifications';
import BikeReferenceSettings from '@/components/settings/BikeReferenceSettings';
import DeliverySettings from '@/components/settings/DeliverySettings';
import VatSettings from '@/components/settings/VatSettings';

import { useAuth } from '@/hooks/useAuth';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/velo/PageShell';

export default function SettingsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    const features = [
      'User profile management',
      'Password change functionality', 
      'Notification preferences',
      'Display settings',
      'Account security options',
      'System preferences',
      'Integration settings'
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="People, system rules, integrations and listing formats."
      />

      <Tabs
        defaultValue={(() => {
          const requested = new URLSearchParams(window.location.search).get('tab') ?? 'users';
          const allowed = ['users', 'system', 'integrations', 'listings', 'bays'];
          return allowed.includes(requested) ? requested : 'users';
        })()}
        className="w-full md:flex md:items-start md:gap-6"
      >
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0 md:mb-0 md:w-56 md:shrink-0 md:flex-col md:items-stretch md:border md:border-border md:bg-card md:p-1">
          <TabsTrigger className="justify-start data-[state=active]:bg-secondary" value="users">User Management</TabsTrigger>
          <TabsTrigger className="justify-start data-[state=active]:bg-secondary" value="system">System</TabsTrigger>
          <TabsTrigger className="justify-start data-[state=active]:bg-secondary" value="integrations">Integrations</TabsTrigger>
          <TabsTrigger className="justify-start data-[state=active]:bg-secondary" value="listings">Listing Formats</TabsTrigger>
          <TabsTrigger className="justify-start data-[state=active]:bg-secondary" value="bays">Storage Bays</TabsTrigger>
        </TabsList>


        <TabsContent className="min-w-0 flex-1 space-y-4" value="users">
          <UserManagement />
        </TabsContent>

        <TabsContent className="min-w-0 flex-1 space-y-4" value="system">
          <BikeReferenceSettings />
          <DeliverySettings />
          <VatSettings />
          <EmailNotifications />
        </TabsContent>

        <TabsContent className="min-w-0 flex-1 space-y-4" value="integrations">
          <div className="grid grid-cols-1 gap-4">
            <CycleCourierIntegration />
            <TypeformIntegration />
            <ShopifyIntegration />
            <EbayIntegration />
            <QuickBooksIntegration />
            <InspectABikeIntegration />
          </div>
        </TabsContent>

        <TabsContent className="min-w-0 flex-1 space-y-4" value="listings">
          <ListingFormats />
        </TabsContent>

        <TabsContent className="min-w-0 flex-1 space-y-4" value="bays">
          <StorageBays />
        </TabsContent>





        {isSuperAdmin && (
          <TabsContent className="min-w-0 flex-1 space-y-4" value="inbox">
            <SupportInbox />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent className="min-w-0 flex-1 space-y-4" value="website">
            <BlogManager />
            <JobOpeningsManager />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent className="min-w-0 flex-1 space-y-4" value="super">
            <SuperAdminPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}