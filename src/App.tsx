import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import InvestorGuard from "@/components/InvestorGuard";
import BPSDashboard from "@/components/BPSDashboard";
import LandingPage from "./pages/LandingPage";
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const BikesPage = lazy(() => import("./pages/BikesPage"));
const ListingsPage = lazy(() => import("./pages/ListingsPage"));
const BikeDetailPage = lazy(() => import("./pages/BikeDetailPage"));
const BikePhotosPage = lazy(() => import("./pages/BikePhotosPage"));
const IntakePage = lazy(() => import("./pages/IntakePage"));
const CleaningPage = lazy(() => import("./pages/CleaningPage"));
const InspectionPage = lazy(() => import("./pages/InspectionPage"));
const RepairsPage = lazy(() => import("./pages/RepairsPage"));
const SubmissionsPage = lazy(() => import("./pages/SubmissionsPage"));

const PartsPage = lazy(() => import("./pages/PartsPage"));
const ComponentsPage = lazy(() => import("./pages/ComponentsPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const InvoiceDetailPage = lazy(() => import("./pages/InvoiceDetailPage"));
const PublicInvoicePage = lazy(() => import("./pages/PublicInvoicePage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const QuoteBuilderPage = lazy(() => import("./pages/QuoteBuilderPage"));
const QuoteListPage = lazy(() => import("./pages/QuoteListPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LogisticsPage = lazy(() => import("./pages/LogisticsPage"));
const SocialDashboardPage = lazy(() => import("./pages/social/SocialDashboardPage"));
const SocialCalendarPage = lazy(() => import("./pages/social/SocialCalendarPage"));
const SocialPostsPage = lazy(() => import("./pages/social/SocialPostsPage"));
const SocialScriptsPage = lazy(() => import("./pages/social/SocialScriptsPage"));
const SocialAnalyticsPage = lazy(() => import("./pages/social/SocialAnalyticsPage"));
const InvestorDashboardPage = lazy(() => import("./pages/investor/InvestorDashboardPage"));
const InvestorBikePage = lazy(() => import("./pages/investor/InvestorBikePage"));
const StaffActivityPage = lazy(() => import("./pages/StaffActivityPage"));
import InvestorShell from "@/components/InvestorShell";
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const CareerDetailPage = lazy(() => import("./pages/CareerDetailPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
import AdminShell from "@/components/admin/AdminShell";
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminDealershipsPage = lazy(() => import("./pages/admin/AdminDealershipsPage"));
const AdminDealershipDetailPage = lazy(() => import("./pages/admin/AdminDealershipDetailPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/AdminSubscriptionsPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminInboxPage = lazy(() => import("./pages/admin/AdminInboxPage"));
const AdminWebsitePage = lazy(() => import("./pages/admin/AdminWebsitePage"));
const AdminErrorsPage = lazy(() => import("./pages/admin/AdminErrorsPage"));
const AdminDeletionsPage = lazy(() => import("./pages/admin/AdminDeletionsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>
);

const guarded = (node: React.ReactNode) => <InvestorGuard>{node}</InvestorGuard>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={guarded(<LandingPage />)} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/i/:token" element={<PublicInvoicePage />} />
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
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/dashboard" element={guarded(<Layout><BPSDashboard /></Layout>)} />
            <Route path="/bikes" element={guarded(<Layout><BikesPage /></Layout>)} />
            <Route path="/listings" element={guarded(<Layout><ListingsPage /></Layout>)} />
            <Route path="/bikes/:id" element={guarded(<Layout><BikeDetailPage /></Layout>)} />
            <Route path="/bikes/:id/photos" element={guarded(<Layout><BikePhotosPage /></Layout>)} />
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
            <Route path="/invoices/:id" element={guarded(<Layout><InvoiceDetailPage /></Layout>)} />
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
            <Route path="/admin/errors" element={<AdminShell><AdminErrorsPage /></AdminShell>} />
            <Route path="/admin/deletions" element={<AdminShell><AdminDeletionsPage /></AdminShell>} />
            <Route path="/help" element={guarded(<Layout><HelpPage /></Layout>)} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/investor" element={<InvestorShell><InvestorDashboardPage /></InvestorShell>} />
            <Route path="/investor/bikes/:id" element={<InvestorShell><InvestorBikePage /></InvestorShell>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
