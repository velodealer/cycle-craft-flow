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
import InspectionPage from "./pages/InspectionPage";
import RepairsPage from "./pages/RepairsPage";
import SubmissionsPage from "./pages/SubmissionsPage";

import PartsPage from "./pages/PartsPage";
import ComponentsPage from "./pages/ComponentsPage";
import JobsPage from "./pages/JobsPage";
import InvoicesPage from "./pages/InvoicesPage";
import ReportsPage from "./pages/ReportsPage";
import QuoteBuilderPage from "./pages/QuoteBuilderPage";
import QuoteListPage from "./pages/QuoteListPage";
import SettingsPage from "./pages/SettingsPage";
import LogisticsPage from "./pages/LogisticsPage";
import SocialDashboardPage from "./pages/social/SocialDashboardPage";
import SocialCalendarPage from "./pages/social/SocialCalendarPage";
import SocialPostsPage from "./pages/social/SocialPostsPage";
import SocialScriptsPage from "./pages/social/SocialScriptsPage";
import SocialAnalyticsPage from "./pages/social/SocialAnalyticsPage";
import InvestorDashboardPage from "./pages/investor/InvestorDashboardPage";
import InvestorBikePage from "./pages/investor/InvestorBikePage";
import StaffActivityPage from "./pages/StaffActivityPage";
import InvestorShell from "@/components/InvestorShell";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import CookiePolicyPage from "./pages/CookiePolicyPage";
import PricingPage from "./pages/PricingPage";
import FeaturesPage from "./pages/FeaturesPage";
import UpdatesPage from "./pages/UpdatesPage";
import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import CareersPage from "./pages/CareersPage";
import CareerDetailPage from "./pages/CareerDetailPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";
import AdminShell from "@/components/admin/AdminShell";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminDealershipsPage from "./pages/admin/AdminDealershipsPage";
import AdminDealershipDetailPage from "./pages/admin/AdminDealershipDetailPage";
import AdminSubscriptionsPage from "./pages/admin/AdminSubscriptionsPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminInboxPage from "./pages/admin/AdminInboxPage";
import AdminWebsitePage from "./pages/admin/AdminWebsitePage";

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
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiePolicyPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/careers/:slug" element={<CareerDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/dashboard" element={guarded(<Layout><BPSDashboard /></Layout>)} />
            <Route path="/bikes" element={guarded(<Layout><BikesPage /></Layout>)} />
            <Route path="/bikes/:id" element={guarded(<Layout><BikeDetailPage /></Layout>)} />
            <Route path="/intake" element={guarded(<Layout><IntakePage /></Layout>)} />
            <Route path="/cleaning" element={guarded(<Layout><CleaningPage /></Layout>)} />
            <Route path="/inspection" element={guarded(<Layout><InspectionPage /></Layout>)} />
            <Route path="/repairs" element={guarded(<Layout><RepairsPage /></Layout>)} />
            <Route path="/submissions" element={guarded(<Layout><SubmissionsPage /></Layout>)} />

            <Route path="/logistics" element={guarded(<Layout><LogisticsPage /></Layout>)} />
            <Route path="/parts" element={guarded(<Layout><PartsPage /></Layout>)} />
            <Route path="/components" element={guarded(<Layout><ComponentsPage /></Layout>)} />
            <Route path="/jobs" element={guarded(<Layout><JobsPage /></Layout>)} />

            <Route path="/invoices" element={guarded(<Layout><InvoicesPage /></Layout>)} />
            <Route path="/reports" element={guarded(<Layout><ReportsPage /></Layout>)} />
            <Route path="/quote-builder" element={guarded(<Layout><QuoteListPage /></Layout>)} />
            <Route path="/quote-builder/new" element={guarded(<Layout><QuoteBuilderPage /></Layout>)} />
            <Route path="/quote-builder/:id" element={guarded(<Layout><QuoteBuilderPage /></Layout>)} />
            <Route path="/settings" element={guarded(<Layout><SettingsPage /></Layout>)} />
            <Route path="/social" element={guarded(<Layout><SocialDashboardPage /></Layout>)} />
            <Route path="/social/calendar" element={guarded(<Layout><SocialCalendarPage /></Layout>)} />
            <Route path="/social/posts" element={guarded(<Layout><SocialPostsPage /></Layout>)} />
            <Route path="/social/scripts" element={guarded(<Layout><SocialScriptsPage /></Layout>)} />
            <Route path="/social/analytics" element={guarded(<Layout><SocialAnalyticsPage /></Layout>)} />
            <Route path="/staff-activity" element={guarded(<Layout><StaffActivityPage /></Layout>)} />
            <Route path="/admin" element={<AdminShell><AdminOverviewPage /></AdminShell>} />
            <Route path="/admin/dealerships" element={<AdminShell><AdminDealershipsPage /></AdminShell>} />
            <Route path="/admin/dealerships/:id" element={<AdminShell><AdminDealershipDetailPage /></AdminShell>} />
            <Route path="/admin/subscriptions" element={<AdminShell><AdminSubscriptionsPage /></AdminShell>} />
            <Route path="/admin/analytics" element={<AdminShell><AdminAnalyticsPage /></AdminShell>} />
            <Route path="/admin/inbox" element={<AdminShell><AdminInboxPage /></AdminShell>} />
            <Route path="/admin/website" element={<AdminShell><AdminWebsitePage /></AdminShell>} />
            <Route path="/investor" element={<InvestorShell><InvestorDashboardPage /></InvestorShell>} />
            <Route path="/investor/bikes/:id" element={<InvestorShell><InvestorBikePage /></InvestorShell>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
