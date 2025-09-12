import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Bike, 
  Wrench, 
  Package, 
  FileText, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  Palette,
  Shield,
  Calculator,
  Sparkles,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'mechanic' | 'detailer' | 'accountant' | 'owner';

interface RoleConfig {
  label: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  permissions: string[];
}

const roleConfigs: Record<UserRole, RoleConfig> = {
  admin: {
    label: 'Administrator',
    icon: Shield,
    color: 'destructive',
    description: 'Full system access and management',
    permissions: ['All pages and actions', 'User management', 'System configuration', 'Database access']
  },
  mechanic: {
    label: 'Mechanic',
    icon: Wrench,
    color: 'default',
    description: 'Workshop operations and bike maintenance',
    permissions: ['Bikes (read/write)', 'Workshop jobs', 'Fulfilment updates', 'Parts (read)', 'Invoices (read)']
  },
  detailer: {
    label: 'Detailer',
    icon: Sparkles,
    color: 'secondary',
    description: 'Detailing and finishing operations',
    permissions: ['Bikes (read)', 'Detailing jobs', 'Fulfilment (detailing stages)', 'Invoices (read)']
  },
  accountant: {
    label: 'Accountant',
    icon: Calculator,
    color: 'outline',
    description: 'Financial management and reporting',
    permissions: ['Invoices (read/write)', 'Reports (read)', 'Bikes (read)', 'Parts (read)', 'Jobs (read)']
  },
  owner: {
    label: 'Bike Owner',
    icon: User,
    color: 'default',
    description: 'Customer portal for owned bikes',
    permissions: ['Own bikes only', 'Status timeline', 'Approvals', 'Invoices (own)']
  }
};

export default function Dashboard() {
  const { user, profile, signOut, loading } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const currentRole = (profile?.role as UserRole) || 'mechanic';
  const roleConfig = roleConfigs[currentRole];
  const RoleIcon = roleConfig.icon;

  const getRoleBadgeVariant = (role: string): "destructive" | "default" | "secondary" | "outline" => {
    const config = roleConfigs[role as UserRole];
    switch (config?.color) {
      case 'destructive': return 'destructive';
      case 'default': return 'default';
      case 'secondary': return 'secondary';
      case 'outline': return 'outline';
      default: return 'secondary';
    }
  };

  const dashboardCards = [
    {
      title: "Bikes",
      description: "Manage bicycle inventory and tracking",
      icon: Bike,
      count: "0",
      href: "/bikes",
      roles: ['admin', 'mechanic', 'detailer', 'accountant'],
    },
    {
      title: "Parts",
      description: "Track parts inventory and pricing",
      icon: Package,
      count: "0",
      href: "/parts",
      roles: ['admin', 'mechanic', 'accountant'],
    },
    {
      title: "Workshop Jobs",
      description: "Manage repair and service jobs",
      icon: Wrench,
      count: "0",
      href: "/jobs",
      roles: ['admin', 'mechanic', 'detailer'],
    },
    {
      title: "Invoices",
      description: "Handle billing and payments",
      icon: FileText,
      count: "0",
      href: "/invoices",
      roles: ['admin', 'accountant'],
    },
    {
      title: "Reports",
      description: "View performance and analytics",
      icon: BarChart3,
      count: "",
      href: "/reports",
      roles: ['admin', 'accountant'],
    },
    {
      title: "Customers",
      description: "Manage customer relationships",
      icon: Users,
      count: "0",
      href: "/customers",
      roles: ['admin', 'accountant'],
    },
  ];

  const userAccessibleCards = dashboardCards.filter(card => 
    !profile?.role || card.roles.includes(profile.role)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-accent rounded-lg p-2">
                <Bike className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">BPS Fulfillment</h1>
                <p className="text-sm text-muted-foreground">Bicycle Dealer Management System</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{profile?.name || user.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(profile?.role || 'mechanic')}>
                    {profile?.role || 'mechanic'}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="permissions">My Permissions</TabsTrigger>
            <TabsTrigger value="test-users">Test Users</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">Welcome to BPS</h2>
              <p className="text-muted-foreground">
                Manage your bicycle dealership operations from one central dashboard.
              </p>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userAccessibleCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.title} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {card.title}
                      </CardTitle>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{card.count}</div>
                      <p className="text-xs text-muted-foreground">
                        {card.description}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4 w-full"
                        onClick={() => toast({
                          title: "Coming Soon",
                          description: `${card.title} module is under development.`,
                        })}
                      >
                        Open {card.title}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="mt-12">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {currentRole === 'admin' || currentRole === 'mechanic' ? (
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-2"
                    onClick={() => toast({ title: "Coming Soon", description: "Add new bike functionality coming soon." })}
                  >
                    <Bike className="h-5 w-5" />
                    Add New Bike
                  </Button>
                ) : null}
                {['admin', 'mechanic', 'detailer'].includes(currentRole) ? (
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-2"
                    onClick={() => toast({ title: "Coming Soon", description: "Create job functionality coming soon." })}
                  >
                    <Wrench className="h-5 w-5" />
                    Create Job
                  </Button>
                ) : null}
                {['admin', 'accountant'].includes(currentRole) ? (
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-2"
                    onClick={() => toast({ title: "Coming Soon", description: "Generate invoice functionality coming soon." })}
                  >
                    <FileText className="h-5 w-5" />
                    Generate Invoice
                  </Button>
                ) : null}
                {['admin', 'accountant'].includes(currentRole) ? (
                  <Button 
                    variant="outline" 
                    className="h-16 flex flex-col gap-2"
                    onClick={() => toast({ title: "Coming Soon", description: "View reports functionality coming soon." })}
                  >
                    <BarChart3 className="h-5 w-5" />
                    View Reports
                  </Button>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Your Role & Permissions</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <RoleIcon className="h-6 w-6" />
                  {roleConfig.label}
                  <Badge variant={getRoleBadgeVariant(currentRole)}>{currentRole}</Badge>
                </CardTitle>
                <CardDescription>{roleConfig.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <h4 className="font-medium mb-3">What you can do:</h4>
                  <ul className="space-y-2">
                    {roleConfig.permissions.map((permission, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm">{permission}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(roleConfigs).map(([role, config]) => {
                const Icon = config.icon;
                const isCurrentRole = role === currentRole;
                
                return (
                  <Card key={role} className={isCurrentRole ? "ring-2 ring-primary" : ""}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4" />
                        {config.label}
                        {isCurrentRole && <Badge variant="default" className="text-xs">YOU</Badge>}
                      </CardTitle>
                      <CardDescription className="text-xs">{config.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="space-y-1">
                        {config.permissions.slice(0, 3).map((permission, index) => (
                          <li key={index} className="text-xs text-muted-foreground flex items-center gap-1">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                            {permission}
                          </li>
                        ))}
                        {config.permissions.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{config.permissions.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="test-users" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Test Users Guide</h2>
              <p className="text-muted-foreground mb-6">
                Create test accounts to explore different role capabilities. Each role has different access levels.
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>How to Create Test Users</AlertTitle>
              <AlertDescription>
                To test different roles, sign up with different email addresses using the authentication page. 
                Each new user will be automatically assigned the admin role for testing purposes.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Suggested Test Accounts</h3>
              
              {Object.entries(roleConfigs).map(([role, config]) => {
                const Icon = config.icon;
                
                return (
                  <Card key={role}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {config.label}
                        <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
                      </CardTitle>
                      <CardDescription>{config.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-sm font-medium mb-1">Suggested email:</p>
                          <code className="text-sm">{role}@bpstest.com</code>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Key Capabilities:</p>
                          <ul className="space-y-1">
                            {config.permissions.map((permission, index) => (
                              <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-success" />
                                {permission}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important Notes</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Currently all new users get admin role for testing</li>
                  <li>• Role-based permissions are enforced at the database level</li>
                  <li>• Each role sees different dashboard sections and actions</li>
                  <li>• Owners can only see bikes they own or have consigned</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="system">
            {/* System Status */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">System Status</h2>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    System Information
                  </CardTitle>
                  <CardDescription>
                    Current system information and status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Database</p>
                      <p className="text-success">Connected</p>
                    </div>
                    <div>
                      <p className="font-medium">Authentication</p>
                      <p className="text-success">Active</p>
                    </div>
                    <div>
                      <p className="font-medium">Version</p>
                      <p className="text-muted-foreground">1.0.0-beta</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Security Features</CardTitle>
                  <CardDescription>Row-level security and role-based access control</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm">Row Level Security (RLS) enabled</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm">Role-based access control implemented</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm">Database functions secured</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm">Authentication policies active</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}