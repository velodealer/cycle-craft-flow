import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import InvestorGuard from "@/components/InvestorGuard";
import BPSDashboard from "@/components/BPSDashboard";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import BikesPage from "./pages/BikesPage";
import BikeDetailPage from "./pages/BikeDetailPage";
import IntakePage from "./pages/IntakePage";
import CleaningPage from "./pages/CleaningPage";
import PartsPage from "./pages/PartsPage";
import ComponentsPage from "./pages/ComponentsPage";
import JobsPage from "./pages/JobsPage";
import InvoicesPage from "./pages/InvoicesPage";
import OwnersPage from "./pages/OwnersPage";
import ReportsPage from "./pages/ReportsPage";
import QuoteBuilderPage from "./pages/QuoteBuilderPage";
import SettingsPage from "./pages/SettingsPage";
import LogisticsPage from "./pages/LogisticsPage";
import SocialDashboardPage from "./pages/social/SocialDashboardPage";
import SocialCalendarPage from "./pages/social/SocialCalendarPage";
import SocialPostsPage from "./pages/social/SocialPostsPage";
import SocialScriptsPage from "./pages/social/SocialScriptsPage";
import SocialAnalyticsPage from "./pages/social/SocialAnalyticsPage";
import InvestorDashboardPage from "./pages/investor/InvestorDashboardPage";
import InvestorBikePage from "./pages/investor/InvestorBikePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const guarded = (node: React.ReactNode) => <InvestorGuard>{node}</InvestorGuard>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={guarded(<LandingPage />)} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={guarded(<Layout><BPSDashboard /></Layout>)} />
            <Route path="/bikes" element={guarded(<Layout><BikesPage /></Layout>)} />
            <Route path="/bikes/:id" element={guarded(<Layout><BikeDetailPage /></Layout>)} />
            <Route path="/intake" element={guarded(<Layout><IntakePage /></Layout>)} />
            <Route path="/cleaning" element={guarded(<Layout><CleaningPage /></Layout>)} />
            <Route path="/logistics" element={guarded(<Layout><LogisticsPage /></Layout>)} />
            <Route path="/parts" element={guarded(<Layout><PartsPage /></Layout>)} />
            <Route path="/components" element={guarded(<Layout><ComponentsPage /></Layout>)} />
            <Route path="/jobs" element={guarded(<Layout><JobsPage /></Layout>)} />

            <Route path="/invoices" element={guarded(<Layout><InvoicesPage /></Layout>)} />
            <Route path="/owners" element={guarded(<Layout><OwnersPage /></Layout>)} />
            <Route path="/reports" element={guarded(<Layout><ReportsPage /></Layout>)} />
            <Route path="/settings" element={guarded(<Layout><SettingsPage /></Layout>)} />
            <Route path="/social" element={guarded(<Layout><SocialDashboardPage /></Layout>)} />
            <Route path="/social/calendar" element={guarded(<Layout><SocialCalendarPage /></Layout>)} />
            <Route path="/social/posts" element={guarded(<Layout><SocialPostsPage /></Layout>)} />
            <Route path="/social/scripts" element={guarded(<Layout><SocialScriptsPage /></Layout>)} />
            <Route path="/social/analytics" element={guarded(<Layout><SocialAnalyticsPage /></Layout>)} />
            <Route path="/investor" element={<Layout><InvestorDashboardPage /></Layout>} />
            <Route path="/investor/bikes/:id" element={<Layout><InvestorBikePage /></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
