import {
  LayoutDashboard, Palette, Users, Calendar, CalendarDays, Settings,
  ClipboardList, DollarSign, Building2, UserCircle, Sparkles, LogOut, Moon, Sun, Crown, Star, Megaphone, Gift, Banknote, TrendingUp, MessageSquare, CreditCard, PhoneCall, Scissors,
  ChevronDown, Briefcase, BarChart3, PenTool
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const clientNav = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "Consultation", url: "/consultation", icon: Sparkles },
  { title: "Style Board", url: "/dashboard/style-board", icon: Palette },
  { title: "Book Now", url: "/dashboard/book", icon: Calendar },
  { title: "Appointments", url: "/dashboard/appointments", icon: ClipboardList },
  { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
  { title: "My Rewards", url: "/dashboard/loyalty", icon: Gift },
  { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
  { title: "Membership", url: "/dashboard/membership", icon: Crown },
];

const stylistNav = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Earnings", url: "/dashboard/earnings", icon: TrendingUp },
  { title: "Book for Client", url: "/dashboard/book", icon: Calendar },
  { title: "Consultation Queue", url: "/dashboard/consultations", icon: ClipboardList },
  { title: "My Schedule", url: "/dashboard/schedule", icon: Calendar },
  { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
  { title: "Clients", url: "/dashboard/clients", icon: Users },
  { title: "My Profile", url: "/dashboard/profile", icon: UserCircle },
];

const adminNavGroups = [
  {
    label: "Operations",
    icon: Briefcase,
    items: [
      { title: "Appointments", url: "/dashboard/appointments", icon: Calendar },
      { title: "Staff Calendar", url: "/dashboard/calendar", icon: CalendarDays },
      { title: "Book for Client", url: "/dashboard/book", icon: ClipboardList },
      { title: "Consultations", url: "/dashboard/consultations", icon: Sparkles },
      { title: "Messages", url: "/dashboard/messages", icon: MessageSquare },
    ],
  },
  {
    label: "Clients",
    icon: Users,
    items: [
      { title: "Client List", url: "/dashboard/clients", icon: Users },
      { title: "Loyalty", url: "/dashboard/loyalty", icon: Gift },
      { title: "Reviews", url: "/dashboard/reviews", icon: Star },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { title: "Campaigns", url: "/dashboard/campaigns", icon: Megaphone },
      { title: "Voice Agent", url: "/dashboard/voice-agent", icon: PhoneCall },
    ],
  },
  {
    label: "Finance",
    icon: BarChart3,
    items: [
      { title: "Payments", url: "/dashboard/payments", icon: CreditCard },
      { title: "Payroll", url: "/dashboard/payroll", icon: Banknote },
      { title: "Financials", url: "/dashboard/financials", icon: DollarSign },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { title: "Staff", url: "/dashboard/staff", icon: Users },
      { title: "Services", url: "/dashboard/services", icon: Scissors },
      { title: "Forms", url: "/dashboard/forms", icon: PenTool },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
];

const adminNav = adminNavGroups.flatMap((g) => g.items);

const navByRole: Record<AppRole, typeof clientNav> = {
  client: clientNav,
  stylist: stylistNav,
  salon_admin: adminNav,
};

export function AppSidebar({ role, userName }: { role: AppRole; userName: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const items = navByRole[role] || clientNav;
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="dark:glass-subtle">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-prism rounded-lg rotate-45 shrink-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-white/30 rounded-sm rotate-0" />
          </div>
          {!collapsed && (
            <span className="text-gradient-brand font-medium text-lg tracking-tight">
              Prism
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Overview link — always visible for all roles */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard"
                    end
                    className="hover:bg-primary/5 transition-colors duration-150 rounded-lg"
                    activeClassName="bg-primary/10 text-primary font-medium"
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="ml-2">Overview</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === "salon_admin" ? (
          /* Admin: collapsible grouped navigation */
          adminNavGroups.map((group) => {
            const isActive = group.items.some((item) => location.pathname === item.url || (item.url !== "/dashboard" && location.pathname.startsWith(item.url)));
            return (
              <Collapsible key={group.label} defaultOpen={isActive} className="group/collapsible">
                <SidebarGroup>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer hover:bg-primary/5 transition-colors duration-150 rounded-lg px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-medium flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <group.icon className="h-3.5 w-3.5" />
                        {!collapsed && group.label}
                      </span>
                      {!collapsed && (
                        <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                      )}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="collapsible-content">
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.url}
                                className="hover:bg-primary/5 transition-colors duration-150 rounded-lg"
                                activeClassName="bg-primary/10 text-primary font-medium"
                              >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {!collapsed && <span className="ml-2">{item.title}</span>}
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })
        ) : (
          /* Client / Stylist: flat list */
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="uppercase text-[10px] tracking-widest text-champagne font-medium">
                {role === "stylist" ? "Stylist" : "Client"}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.filter((i) => i.url !== "/dashboard").map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-primary/5 transition-colors duration-150 rounded-lg"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="ml-2">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50 space-y-2">
        {!collapsed && (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{role.replace("_", " ")}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme" className="hover:bg-primary/5 transition-all duration-200 rounded-xl">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out" aria-label="Log out" className="hover:bg-primary/5 transition-all duration-200 rounded-xl">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme" className="hover:bg-primary/5 transition-all duration-200 rounded-xl">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out" aria-label="Log out" className="hover:bg-primary/5 transition-all duration-200 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
