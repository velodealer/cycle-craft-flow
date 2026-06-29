import { 
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

const navigationItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ['admin', 'mechanic', 'detailer', 'accountant', 'owner', 'social_manager'] },
  { title: "Intake", url: "/intake", icon: ClipboardCheck, roles: ['admin', 'mechanic', 'detailer'] },
  { title: "Cleaning", url: "/cleaning", icon: Sparkles, roles: ['admin', 'detailer'] },
  { title: "Bikes", url: "/bikes", icon: Bike, roles: ['admin', 'mechanic', 'detailer', 'accountant'] },
  { title: "Logistics", url: "/logistics", icon: Truck, roles: ['admin', 'mechanic', 'accountant'] },
  { title: "Parts", url: "/parts", icon: Package, roles: ['admin', 'mechanic', 'accountant'] },
  { title: "Jobs", url: "/jobs", icon: Wrench, roles: ['admin', 'mechanic', 'detailer'] },
  
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ['admin', 'accountant'] },
  { title: "Owners", url: "/owners", icon: Users, roles: ['admin', 'accountant'] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ['admin', 'accountant'] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ['admin'] },
];

const socialItems = [
  { title: "Planner", url: "/social", icon: Megaphone, exact: true },
  { title: "Calendar", url: "/social/calendar", icon: CalendarDays },
  { title: "Posts", url: "/social/posts", icon: FileVideo },
  { title: "Scripts", url: "/social/scripts", icon: FileText },
  { title: "Performance", url: "/social/analytics", icon: TrendingUp },
];
const socialRoles = ['admin', 'social_manager', 'detailer', 'accountant', 'owner'];

const investorItems = [
  { title: "My Investments", url: "/investor", icon: Briefcase, exact: true },
];

export function AppSidebar() {
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const location = useLocation();
  const { profile } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const isInvestor = profile?.role === 'investor';

  const userAccessibleItems = isInvestor ? [] : navigationItems.filter(item =>
    !profile?.role || item.roles.includes(profile.role)
  );

  const handleNavItemClick = () => {
    // Close sidebar on mobile after navigation
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

  return (
    <Sidebar className="border-r">
      <SidebarContent className="bg-background">
        {userAccessibleItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              VeloDealer Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-2">
                {userAccessibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.url);
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="w-full">
                        <NavLink 
                          to={item.url} 
                          end={item.url === "/"} 
                          onClick={handleNavItemClick}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                            active 
                              ? "bg-accent text-accent-foreground" 
                              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(!profile?.role || socialRoles.includes(profile.role)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              Social Planner
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-2">
                {socialItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.exact ? currentPath === item.url : currentPath.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="w-full">
                        <NavLink
                          to={item.url}
                          end={item.exact}
                          onClick={handleNavItemClick}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                            active
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {profile?.role === 'investor' && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold text-foreground uppercase tracking-wider">
              Investor Portal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1 px-2">
                {investorItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.exact ? currentPath === item.url : currentPath.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild className="w-full">
                        <NavLink
                          to={item.url}
                          end={item.exact}
                          onClick={handleNavItemClick}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full ${
                            active
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}