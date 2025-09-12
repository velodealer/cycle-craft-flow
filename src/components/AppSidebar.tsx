import { 
  LayoutDashboard, 
  Bike, 
  Package, 
  Wrench, 
  ClipboardList, 
  FileText, 
  Users, 
  BarChart3, 
  Settings 
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ['admin', 'mechanic', 'detailer', 'accountant', 'owner'] },
  { title: "Bikes", url: "/bikes", icon: Bike, roles: ['admin', 'mechanic', 'detailer', 'accountant'] },
  { title: "Parts", url: "/parts", icon: Package, roles: ['admin', 'mechanic', 'accountant'] },
  { title: "Jobs", url: "/jobs", icon: Wrench, roles: ['admin', 'mechanic', 'detailer'] },
  { title: "Fulfilment", url: "/fulfilment", icon: ClipboardList, roles: ['admin', 'mechanic', 'detailer'] },
  { title: "Invoices", url: "/invoices", icon: FileText, roles: ['admin', 'accountant'] },
  { title: "Owners", url: "/owners", icon: Users, roles: ['admin', 'accountant'] },
  { title: "Reports", url: "/reports", icon: BarChart3, roles: ['admin', 'accountant'] },
  { title: "Settings", url: "/settings", icon: Settings, roles: ['admin'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { profile } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50";

  const userAccessibleItems = navigationItems.filter(item => 
    !profile?.role || item.roles.includes(profile.role)
  );

  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-16" : "w-60"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            BPS Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userAccessibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === "/"} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}