import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Bike, 
  Wrench, 
  Package, 
  FileText, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  Palette
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'mechanic': return 'secondary';
      case 'detailer': return 'outline';
      case 'accountant': return 'secondary';
      case 'owner': return 'outline';
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
            <Button 
              variant="outline" 
              className="h-16 flex flex-col gap-2"
              onClick={() => toast({ title: "Coming Soon", description: "Add new bike functionality coming soon." })}
            >
              <Bike className="h-5 w-5" />
              Add New Bike
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex flex-col gap-2"
              onClick={() => toast({ title: "Coming Soon", description: "Create job functionality coming soon." })}
            >
              <Wrench className="h-5 w-5" />
              Create Job
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex flex-col gap-2"
              onClick={() => toast({ title: "Coming Soon", description: "Generate invoice functionality coming soon." })}
            >
              <FileText className="h-5 w-5" />
              Generate Invoice
            </Button>
            <Button 
              variant="outline" 
              className="h-16 flex flex-col gap-2"
              onClick={() => toast({ title: "Coming Soon", description: "View reports functionality coming soon." })}
            >
              <BarChart3 className="h-5 w-5" />
              View Reports
            </Button>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Status
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
        </div>
      </main>
    </div>
  );
}