import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import SearchBar from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Footer from './Footer';
import { VeloDealerLogo } from '@/components/brand/VeloDealerLogo';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, profile, signOut, loading, businessStatus, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading VeloDealer...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Block businesses that haven't been approved yet or have been suspended
  if (profile && businessStatus && businessStatus !== 'active' && !isSuperAdmin) {
    const pending = businessStatus === 'pending';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">
            {pending ? 'Your account is awaiting approval' : 'Your account has been suspended'}
          </h1>
          <p className="text-muted-foreground">
            {pending
              ? 'Thanks for signing up. A VeloDealer administrator will review your business and activate your account shortly.'
              : 'Access to this business account has been suspended. Please contact VeloDealer support if you believe this is a mistake.'}
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    );
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="border-b border-border bg-card sticky top-0 z-40">
            <div className="flex h-14 items-center gap-4 px-4 md:px-6">
              <SidebarTrigger className="md:-ml-1" />
              
              <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                <VeloDealerLogo variant="symbol" className="size-7 md:hidden" />
                <div className="hidden sm:block flex-1">
                  <SearchBar />
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Mobile Search Bar */}
            <div className="sm:hidden px-4 pb-4">
              <SearchBar />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>

          {/* Footer */}
          <Footer />
        </div>
      </div>
    </SidebarProvider>
  );
}