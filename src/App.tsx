import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import BPSDashboard from "@/components/BPSDashboard";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import BikesPage from "./pages/BikesPage";
import BikeDetailPage from "./pages/BikeDetailPage";
import IntakePage from "./pages/IntakePage";
import CleaningPage from "./pages/CleaningPage";
import PartsPage from "./pages/PartsPage";
import JobsPage from "./pages/JobsPage";
import InvoicesPage from "./pages/InvoicesPage";
import OwnersPage from "./pages/OwnersPage";
import ReportsPage from "./pages/ReportsPage";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Layout><BPSDashboard /></Layout>} />
            <Route path="/bikes" element={<Layout><BikesPage /></Layout>} />
            <Route path="/bikes/:id" element={<Layout><BikeDetailPage /></Layout>} />
            <Route path="/intake" element={<Layout><IntakePage /></Layout>} />
            <Route path="/cleaning" element={<Layout><CleaningPage /></Layout>} />
            <Route path="/logistics" element={<Layout><LogisticsPage /></Layout>} />
            <Route path="/parts" element={<Layout><PartsPage /></Layout>} />
            <Route path="/jobs" element={<Layout><JobsPage /></Layout>} />
            
            <Route path="/invoices" element={<Layout><InvoicesPage /></Layout>} />
            <Route path="/owners" element={<Layout><OwnersPage /></Layout>} />
            <Route path="/reports" element={<Layout><ReportsPage /></Layout>} />
            <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
            <Route path="/social" element={<Layout><SocialDashboardPage /></Layout>} />
            <Route path="/social/calendar" element={<Layout><SocialCalendarPage /></Layout>} />
            <Route path="/social/posts" element={<Layout><SocialPostsPage /></Layout>} />
            <Route path="/social/scripts" element={<Layout><SocialScriptsPage /></Layout>} />
            <Route path="/social/analytics" element={<Layout><SocialAnalyticsPage /></Layout>} />
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
