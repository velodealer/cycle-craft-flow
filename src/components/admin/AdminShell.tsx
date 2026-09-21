import { ReactNode } from 'react';
import { Navigate, NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { VeloDealerLogo } from '@/components/brand/VeloDealerLogo';
import { LogOut, LayoutDashboard, Building2, CreditCard, BarChart3, Inbox, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Overview', url: '/admin', icon: LayoutDashboard, exact: true },
  { title: 'Dealerships', url: '/admin/dealerships', icon: Building2 },
  { title: 'Subscriptions', url: '/admin/subscriptions', icon: CreditCard },
  { title: 'Analytics', url: '/admin/analytics', icon: BarChart3 },
  { title: 'Inbox', url: '/admin/inbox', icon: Inbox },
  { title: 'Website', url: '/admin/website', icon: Globe },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, isSuperAdmin, profile, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  // Wait for the profile lookup before deciding
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex h-14 items-center gap-4 px-4 md:px-6">
          <Link to="/admin" className="flex items-center gap-2">
            <VeloDealerLogo variant="symbol" className="size-7" />
            <span className="font-display text-lg font-bold">VeloDealer</span>
            <span className="label-text ml-1 rounded-[4px] border border-border px-2 py-0.5 text-muted-foreground">
              Platform
            </span>
          </Link>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-1 md:px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.exact}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-[4px] px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
