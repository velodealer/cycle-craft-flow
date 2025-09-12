import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Sparkles, 
  Search, 
  AlertCircle, 
  Wrench, 
  CheckCircle, 
  Eye, 
  ShoppingCart,
  Clock
} from 'lucide-react';

interface StatusCard {
  title: string;
  count: number;
  description: string;
  icon: React.ComponentType<any>;
  color: 'default' | 'secondary' | 'destructive' | 'outline';
  trend?: string;
}

const bikeStatusCards: StatusCard[] = [
  {
    title: 'In Intake',
    count: 12,
    description: 'Bikes just received and being processed',
    icon: Package,
    color: 'secondary',
    trend: '+3 today'
  },
  {
    title: 'Cleaning',
    count: 8,
    description: 'Bikes currently being cleaned',
    icon: Sparkles,
    color: 'default',
    trend: '2 completed today'
  },
  {
    title: 'Inspection',
    count: 15,
    description: 'Mechanical inspection in progress',
    icon: Search,
    color: 'default',
    trend: '5 pending reports'
  },
  {
    title: 'Awaiting Owner Approval',
    count: 6,
    description: 'Waiting for owner repair approval',
    icon: AlertCircle,
    color: 'destructive',
    trend: '2 overdue'
  },
  {
    title: 'Repair in Progress',
    count: 9,
    description: 'Currently being repaired',
    icon: Wrench,
    color: 'outline',
    trend: '3 due today'
  },
  {
    title: 'Ready to List',
    count: 4,
    description: 'Completed and ready for sale',
    icon: CheckCircle,
    color: 'default',
    trend: 'All processed'
  },
  {
    title: 'Listed',
    count: 18,
    description: 'Currently listed for sale',
    icon: Eye,
    color: 'secondary',
    trend: '6 views today'
  },
  {
    title: 'Sold',
    count: 23,
    description: 'Successfully sold this month',
    icon: ShoppingCart,
    color: 'default',
    trend: '+2 this week'
  }
];

const jobStatusCards: StatusCard[] = [
  {
    title: 'Jobs in Progress',
    count: 14,
    description: 'Active workshop and detailing jobs',
    icon: Clock,
    color: 'outline',
    trend: '8 workshop, 6 detailing'
  }
];

export default function BPSDashboard() {
  const allStatusCards = [...bikeStatusCards, ...jobStatusCards];
  const totalBikes = bikeStatusCards.reduce((sum, card) => sum + card.count, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your bike processing system • {totalBikes} bikes in system
        </p>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {allStatusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.count}</div>
                <p className="text-xs text-muted-foreground mb-2">
                  {card.description}
                </p>
                {card.trend && (
                  <Badge variant={card.color} className="text-xs">
                    {card.trend}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing Pipeline</CardTitle>
            <CardDescription>Bikes moving through the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Intake → Cleaning</span>
                <span className="text-sm font-medium">8 bikes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Cleaning → Inspection</span>
                <span className="text-sm font-medium">6 bikes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Inspection → Approval</span>
                <span className="text-sm font-medium">4 bikes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Tracking</CardTitle>
            <CardDescription>This month's performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Sales</span>
                <span className="text-sm font-medium">£24,580</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg. Sale Price</span>
                <span className="text-sm font-medium">£1,069</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Jobs Revenue</span>
                <span className="text-sm font-medium">£3,240</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
            <CardDescription>Current system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Database</span>
                <Badge variant="default" className="text-xs">Active</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Authentication</span>
                <Badge variant="default" className="text-xs">Connected</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Last Sync</span>
                <span className="text-xs text-muted-foreground">2 min ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}