import {
  Inbox,
  LayoutDashboard, 
  Bike, 
  Package, 
  Wrench, 
  ClipboardCheck,
  Sparkles,
  FileText, 
  Users, 
  BarChart3, 
  Settings,
  Truck,
  Megaphone,
  CalendarDays,
  FileVideo,
  TrendingUp,
  Briefcase,
  Cog,
  Calculator,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const allRoles = ['admin', 'mechanic', 'detailer', 'accountant', 'owner', 'social_manager'];

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: allRoles },
    ],
  },
  {
    label: "Workshop",
    items: [
      { title: "Submissions", url: "/submissions", icon: Inbox, roles: ['admin', 'mechanic', 'detailer', 'accountant', 'owner'] },
      { title: "Intake", url: "/intake", icon: ClipboardCheck, roles: ['admin', 'mechanic', 'detailer'] },
      { title: "Cleaning", url: "/cleaning", icon: Sparkles, roles: ['admin', 'detailer'] },
      { title: "Inspection", url: "/inspection", icon: ClipboardCheck, roles: ['admin', 'mechanic'] },
      { title: "Repairs", url: "/repairs", icon: Wrench, roles: ['admin', 'owner', 'mechanic'] },
      { title: "Jobs", url: "/jobs", icon: Wrench, roles: ['admin', 'mechanic', 'detailer'] },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Bikes", url: "/bikes", icon: Bike, roles: ['admin', 'mechanic', 'detailer', 'accountant'] },
      { title: "Parts", url: "/parts", icon: Package, roles: ['admin', 'mechanic', 'accountant'] },
      { title: "Components", url: "/components", icon: Cog, roles: ['admin', 'mechanic', 'accountant'] },
      { title: "Logistics", url: "/logistics", icon: Truck, roles: ['admin', 'mechanic', 'accountant'] },
    ],
  },
  {
    label: "Sales & Money",
    items: [
      { title: "Quote Builder", url: "/quote-builder", icon: Calculator, roles: ['admin', 'mechanic', 'accountant', 'owner'] },
      { title: "Invoices", url: "/invoices", icon: FileText, roles: ['admin', 'accountant'] },
      { title: "Reports", url: "/reports", icon: BarChart3, roles: ['admin', 'accountant'] },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Staff Activity", url: "/staff-activity", icon: Users, roles: ['admin', 'owner', 'mechanic', 'detailer', 'accountant'] },
      { title: "Settings", url: "/settings", icon: Settings, roles: ['admin'] },
    ],
  },
];

const socialItems: NavItem[] = [
  { title: "Planner", url: "/social", icon: Megaphone, exact: true },
  { title: "Calendar", url: "/social/calendar", icon: CalendarDays },
  { title: "Posts", url: "/social/posts", icon: FileVideo },
  { title: "Scripts", url: "/social/scripts", icon: FileText },
  { title: "Performance", url: "/social/analytics", icon: TrendingUp },
];
const socialRoles = ['admin', 'social_manager', 'detailer', 'accountant', 'owner'];

const investorItems: NavItem[] = [
  { title: "My Investments", url: "/investor", icon: Briefcase, exact: true },
];

export function AppSidebar() {
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const location = useLocation();
  const { profile } = useAuth();
  const currentPath = location.pathname;

  const isInvestor = profile?.role === 'investor';

  const groups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(item =>
        !profile?.role || !item.roles || item.roles.includes(profile.role)
      ),
    }))
    .filter(group => group.items.length > 0);

  const handleNavItemClick = () => {
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = item.exact
        ? currentPath === item.url
        : currentPath === item.url || (item.url !== "/" && currentPath.startsWith(item.url + "/"));

      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild className="w-full">
            <NavLink 
              to={item.url} 
              end={item.exact}
              onClick={handleNavItemClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-[4px] text-sm font-medium transition-colors w-full ${
                active 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        {!isInvestor && groups.length > 0 && groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-4 py-2 label-text text-sidebar-foreground/60">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-2">
                {renderItems(group.items)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {!isInvestor && (!profile?.role || socialRoles.includes(profile.role)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 py-2 label-text text-sidebar-foreground/60">
              Social Planner
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-2">
                {renderItems(socialItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isInvestor && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 py-2 label-text text-sidebar-foreground/60">
              Investor Portal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-2">
                {renderItems(investorItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
