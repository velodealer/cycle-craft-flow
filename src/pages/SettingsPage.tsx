import PlaceholderPage from '@/components/PlaceholderPage';
import UserManagement from '@/components/UserManagement';
import { useAuth } from '@/hooks/useAuth';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      <div className="flex items-center gap-4">
        <div className="bg-accent rounded-lg p-3">
          <Settings className="h-8 w-8 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">System configuration and user management</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Configure system-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Application Settings</h4>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Data Management</h4>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>External Integrations</CardTitle>
              <CardDescription>
                Manage connections to external services and APIs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Shopify Integration</h4>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">eBay Integration</h4>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security & Access Control</CardTitle>
              <CardDescription>
                Manage security settings and access controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Authentication Settings</h4>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Audit Logs</h4>
                    <p className="text-sm text-muted-foreground">Coming soon...</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}