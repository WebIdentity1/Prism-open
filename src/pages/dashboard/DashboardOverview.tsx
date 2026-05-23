import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles, Calendar, ClipboardList, Users, DollarSign, Clock,
  ArrowRight, Crown, Scissors, Settings, UserCheck, BookOpen, Star, Heart, RotateCcw, Gift
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfDay, endOfDay, addDays } from "date-fns";

interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  services: { name: string; price: number } | null;
  client_profile: { full_name: string } | null;
  stylist_profile: { full_name: string } | null;
}

interface ConsultationRow {
  id: string;
  created_at: string;
  status: string;
  face_shape: string | null;
  client_profile: { full_name: string } | null;
}

interface StaffOnDuty {
  stylist_id: string;
  start_time: string;
  end_time: string;
  profile: { full_name: string } | null;
}

import { appointmentStatusColor, consultationStatusColor } from "@/lib/status-colors";
const statusColor: Record<string, string> = { ...appointmentStatusColor, ...consultationStatusColor };

// --- Metric Card ---
const MetricCard = ({ icon: Icon, label, value, sub, to }: {
  icon: any; label: string; value: string | number; sub?: string; to?: string;
}) => {
  const content = (
    <Card className="glass border-0 transition-colors duration-150 hover:bg-[var(--glass-bg-elevated)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          {to && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <p className="text-2xl font-medium tracking-tight">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-primary/70 font-medium mt-1.5">{sub}</p>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
};

const MetricSkeleton = () => (
  <Card className="glass border-0"><CardContent className="p-6"><Skeleton className="h-9 w-9 rounded-lg mb-3" /><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-4 w-24" /></CardContent></Card>
);

// ===================== ADMIN DASHBOARD =====================
const AdminOverview = ({ user }: { user: any }) => {
  const [loading, setLoading] = useState(true);
  const [todayAppts, setTodayAppts] = useState<AppointmentRow[]>([]);
  const [staffOnDuty, setStaffOnDuty] = useState<StaffOnDuty[]>([]);
  const [recentConsults, setRecentConsults] = useState<ConsultationRow[]>([]);
  const [metrics, setMetrics] = useState({ todayCount: 0, revenue: 0, pendingConsults: 0, activeMembers: 0 });

  const loadAdmin = async () => {
    const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user!.id).single();
    if (!salon) { setLoading(false); return; }
    setSalonId(salon.id);

    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const dayOfWeek = now.getDay();

    const [apptRes, revenueRes, consultRes, memberRes, staffRes, consultListRes] = await Promise.all([
      supabase.from("appointments")
        .select("*, services:service_id(name, price), client_profile:profiles!appointments_client_id_profiles_fkey(full_name), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name)")
        .eq("salon_id", salon.id).gte("start_time", dayStart).lt("start_time", dayEnd)
        .in("status", ["booked", "confirmed", "completed"])
        .order("start_time"),
      supabase.from("appointments")
        .select("services:service_id(price)")
        .eq("salon_id", salon.id).eq("status", "completed")
        .gte("start_time", dayStart).lt("start_time", dayEnd),
      supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("client_memberships").select("*", { count: "exact", head: true }).eq("salon_id", salon.id).eq("status", "active"),
      supabase.from("stylist_availability")
        .select("stylist_id, start_time, end_time")
        .eq("salon_id", salon.id).eq("day_of_week", dayOfWeek),
      supabase.from("consultations")
        .select("id, created_at, status, face_shape, client_profile:profiles!consultations_client_id_profiles_fkey(full_name)")
        .eq("status", "submitted").order("created_at", { ascending: false }).limit(5),
    ]);

    const todayAppointments = (apptRes.data as any[]) || [];
    setTodayAppts(todayAppointments);
    setRecentConsults((consultListRes.data as any[]) || []);

    const rev = (revenueRes.data || []).reduce((s: number, a: any) => s + (a.services?.price || 0), 0);
    setMetrics({
      todayCount: todayAppointments.length,
      revenue: rev,
      pendingConsults: consultRes.count || 0,
      activeMembers: memberRes.count || 0,
    });

    const staffData = (staffRes.data || []) as any[];
    if (staffData.length > 0) {
      const stylistIds = [...new Set(staffData.map((s: any) => s.stylist_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", stylistIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setStaffOnDuty(staffData.map((s: any) => ({ ...s, profile: profileMap.get(s.stylist_id) || null })));
    }

    setLoading(false);
  };

  const [salonId, setSalonId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadAdmin();
  }, [user]);

  // Realtime subscriptions
  useEffect(() => {
    const channels = [
      supabase.channel("admin-appts-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadAdmin())
        .subscribe(),
      supabase.channel("admin-consults-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => loadAdmin())
        .subscribe(),
    ];
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [user]);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <MetricSkeleton key={i} />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-in stagger-1"><MetricCard icon={Calendar} label="Today's Appointments" value={metrics.todayCount} to="/dashboard/appointments" /></div>
        <div className="animate-in stagger-2"><MetricCard icon={DollarSign} label="Today's Revenue" value={`$${metrics.revenue}`} to="/dashboard/financials" /></div>
        <div className="animate-in stagger-3"><MetricCard icon={ClipboardList} label="Pending Consultations" value={metrics.pendingConsults} to="/dashboard/consultations" /></div>
        <div className="animate-in stagger-4"><MetricCard icon={Crown} label="Active Members" value={metrics.activeMembers} to="/dashboard/settings" /></div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card className="glass border-0 animate-in stagger-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Today's Schedule</CardTitle>
              <Link to="/dashboard/appointments" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No appointments today</p>
            ) : todayAppts.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors duration-150">
                <div className="text-center min-w-[3rem]">
                  <p className="text-xs font-semibold">{format(parseISO(appt.start_time), "h:mm")}</p>
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(appt.start_time), "a")}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{appt.client_profile?.full_name || "Client"}</p>
                  <p className="text-xs text-muted-foreground truncate">{appt.services?.name || "Service"} · {appt.stylist_profile?.full_name || "Stylist"}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${statusColor[appt.status] || ""}`}>{appt.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Who's Working Today */}
        <Card className="glass border-0 animate-in stagger-5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Who's Working Today</CardTitle>
              <Link to="/dashboard/staff" className="text-xs text-primary hover:underline">Manage staff →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {staffOnDuty.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No staff scheduled today</p>
            ) : staffOnDuty.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg glass-subtle">
                <div className="h-8 w-8 rounded-full bg-gradient-prism flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.profile?.full_name || "Stylist"}</p>
                  <p className="text-xs text-muted-foreground">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Consultations */}
        <Card className="glass border-0 animate-in stagger-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Recent Consultations</CardTitle>
              <Link to="/dashboard/consultations" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentConsults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending consultations</p>
            ) : recentConsults.map((c) => (
              <Link key={c.id} to={`/dashboard/consultations/${c.id}`}>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors duration-150">
                  <div className="ai-badge"><ClipboardList className="h-4 w-4 text-primary shrink-0" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.client_profile?.full_name || "Client"}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${statusColor[c.status] || ""}`}>{c.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass border-0 animate-in stagger-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/appointments"><Calendar className="h-4 w-4" /><span className="text-xs">Appointments</span></Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/staff"><Users className="h-4 w-4" /><span className="text-xs">Staff</span></Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/services"><Scissors className="h-4 w-4" /><span className="text-xs">Services</span></Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/salon"><Settings className="h-4 w-4" /><span className="text-xs">Salon Settings</span></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ===================== STYLIST DASHBOARD =====================
const StylistOverview = ({ user }: { user: any }) => {
  const [loading, setLoading] = useState(true);
  const [todayAppts, setTodayAppts] = useState<AppointmentRow[]>([]);
  const [upcomingAppts, setUpcomingAppts] = useState<AppointmentRow[]>([]);
  const [recentConsults, setRecentConsults] = useState<ConsultationRow[]>([]);
  const [metrics, setMetrics] = useState({ todayCount: 0, pendingConsults: 0, weekCount: 0, avgRating: 0, reviewCount: 0 });

  const loadStylist = async () => {
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();
    const weekEnd = endOfDay(addDays(now, 7)).toISOString();

    const [todayRes, weekRes, consultCountRes, upcomingRes, consultListRes, reviewsRes] = await Promise.all([
      supabase.from("appointments")
        .select("*, services:service_id(name, price), client_profile:profiles!appointments_client_id_profiles_fkey(full_name), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name)")
        .eq("stylist_id", user!.id).gte("start_time", dayStart).lt("start_time", dayEnd)
        .in("status", ["booked", "confirmed"]).order("start_time"),
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("stylist_id", user!.id).gte("start_time", dayStart).lt("start_time", weekEnd)
        .in("status", ["booked", "confirmed"]),
      supabase.from("consultations").select("*", { count: "exact", head: true }).eq("status", "submitted"),
      supabase.from("appointments")
        .select("*, services:service_id(name, price), client_profile:profiles!appointments_client_id_profiles_fkey(full_name), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name)")
        .eq("stylist_id", user!.id).gt("start_time", dayEnd)
        .in("status", ["booked", "confirmed"]).order("start_time").limit(5),
      supabase.from("consultations")
        .select("id, created_at, status, face_shape, client_profile:profiles!consultations_client_id_profiles_fkey(full_name)")
        .eq("status", "submitted").order("created_at", { ascending: false }).limit(3),
      supabase.from("reviews").select("rating").eq("stylist_id", user!.id),
    ]);

    setTodayAppts((todayRes.data as any[]) || []);
    setUpcomingAppts((upcomingRes.data as any[]) || []);
    setRecentConsults((consultListRes.data as any[]) || []);
    const reviews = (reviewsRes.data || []) as any[];
    const avgR = reviews.length > 0 ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;
    setMetrics({
      todayCount: (todayRes.data || []).length,
      pendingConsults: consultCountRes.count || 0,
      weekCount: weekRes.count || 0,
      avgRating: avgR,
      reviewCount: reviews.length,
    });
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadStylist();
  }, [user]);

  useEffect(() => {
    const channels = [
      supabase.channel("stylist-appts-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadStylist())
        .subscribe(),
      supabase.channel("stylist-consults-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => loadStylist())
        .subscribe(),
    ];
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [user]);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <MetricSkeleton key={i} />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Calendar} label="Today's Appointments" value={metrics.todayCount} to="/dashboard/schedule" />
        <MetricCard icon={ClipboardList} label="Pending Consultations" value={metrics.pendingConsults} to="/dashboard/consultations" />
        <MetricCard icon={Clock} label="This Week" value={metrics.weekCount} sub="appointments" to="/dashboard/schedule" />
        <MetricCard icon={Star} label="My Rating" value={metrics.avgRating > 0 ? `${metrics.avgRating} ★` : "—"} sub={metrics.reviewCount > 0 ? `${metrics.reviewCount} reviews` : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <Card className="glass border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No appointments today</p>
            ) : todayAppts.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors duration-150">
                <div className="text-center min-w-[3rem]">
                  <p className="text-xs font-semibold">{format(parseISO(appt.start_time), "h:mm")}</p>
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(appt.start_time), "a")}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{appt.client_profile?.full_name || "Client"}</p>
                  <p className="text-xs text-muted-foreground truncate">{appt.services?.name || "Service"}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${statusColor[appt.status] || ""}`}>{appt.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="glass border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No upcoming appointments</p>
            ) : upcomingAppts.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors duration-150">
                <div className="text-center min-w-[3rem]">
                  <p className="text-xs font-semibold">{format(parseISO(appt.start_time), "MMM d")}</p>
                  <p className="text-[10px] text-muted-foreground">{format(parseISO(appt.start_time), "h:mm a")}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{appt.client_profile?.full_name || "Client"}</p>
                  <p className="text-xs text-muted-foreground truncate">{appt.services?.name || "Service"}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${statusColor[appt.status] || ""}`}>{appt.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Consultations */}
        <Card className="glass border-0 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Pending Consultations</CardTitle>
              <Link to="/dashboard/consultations" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentConsults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending consultations</p>
            ) : recentConsults.map((c) => (
              <Link key={c.id} to={`/dashboard/consultations/${c.id}`}>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors duration-150">
                  <div className="ai-badge"><ClipboardList className="h-4 w-4 text-primary shrink-0" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.client_profile?.full_name || "Client"}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${statusColor[c.status] || ""}`}>{c.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ===================== CLIENT DASHBOARD =====================
const ClientOverview = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nextAppt, setNextAppt] = useState<AppointmentRow | null>(null);
  const [recentConsults, setRecentConsults] = useState<ConsultationRow[]>([]);
  const [metrics, setMetrics] = useState({ upcomingCount: 0, consultCount: 0, membershipTier: "", styleBoardCount: 0 });
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<{ totalPoints: number; recentEntries: any[]; pointValueCents: number; enabled: boolean }>({
    totalPoints: 0, recentEntries: [], pointValueCents: 1, enabled: false,
  });

  const loadClient = async () => {
    const now = new Date().toISOString();

    const [upcomingRes, nextRes, consultCountRes, consultListRes, memberRes, boardRes] = await Promise.all([
      supabase.from("appointments").select("*", { count: "exact", head: true })
        .eq("client_id", user!.id).gte("start_time", now).in("status", ["booked", "confirmed"]),
      supabase.from("appointments")
        .select("*, services:service_id(name, price), client_profile:profiles!appointments_client_id_profiles_fkey(full_name), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name)")
        .eq("client_id", user!.id).gte("start_time", now).in("status", ["booked", "confirmed"])
        .order("start_time").limit(1),
      supabase.from("consultations").select("*", { count: "exact", head: true }).eq("client_id", user!.id),
      supabase.from("consultations")
        .select("id, created_at, status, face_shape, client_profile:profiles!consultations_client_id_profiles_fkey(full_name)")
        .eq("client_id", user!.id).order("created_at", { ascending: false }).limit(3),
      supabase.from("client_memberships")
        .select("*, tier:tier_id(name)")
        .eq("client_id", user!.id).eq("status", "active").maybeSingle(),
      supabase.from("style_board_items").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
    ]);

    setNextAppt(((nextRes.data as any[]) || [])[0] || null);
    setRecentConsults((consultListRes.data as any[]) || []);
    setMetrics({
      upcomingCount: upcomingRes.count || 0,
      consultCount: consultCountRes.count || 0,
      membershipTier: (memberRes.data as any)?.tier?.name || "",
      styleBoardCount: boardRes.count || 0,
    });
    setLoading(false);

    // Fetch favorites
    const { data: favs } = await supabase
      .from("client_favorites")
      .select("id, salon_id, service_id, stylist_id")
      .eq("user_id", user!.id);
    if (favs && favs.length > 0) {
      const salonIds = [...new Set(favs.map((f: any) => f.salon_id))];
      const serviceIds = [...new Set(favs.map((f: any) => f.service_id))];
      const stylistIds = [...new Set(favs.map((f: any) => f.stylist_id))];
      const [sRes, svRes, pRes] = await Promise.all([
        supabase.from("salons").select("id, name").in("id", salonIds),
        supabase.from("services").select("id, name, price").in("id", serviceIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", stylistIds),
      ]);
      const sMap = new Map((sRes.data || []).map((s: any) => [s.id, s.name]));
      const svMap = new Map((svRes.data || []).map((s: any) => [s.id, s]));
      const pMap = new Map((pRes.data || []).map((p: any) => [p.user_id, p.full_name]));
      setFavorites(favs.map((f: any) => ({
        ...f,
        salon_name: sMap.get(f.salon_id) || "Salon",
        service_name: svMap.get(f.service_id)?.name || "Service",
        service_price: svMap.get(f.service_id)?.price,
        stylist_name: pMap.get(f.stylist_id) || "Stylist",
      })));
    }

    // Fetch loyalty points
    const { data: pointsData } = await supabase
      .from("loyalty_points")
      .select("points, reason, created_at, salon_id")
      .eq("client_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (pointsData && pointsData.length > 0) {
      const totalPts = pointsData.reduce((s: number, p: any) => s + p.points, 0);
      // Get full total (not just last 5)
      const { data: allPts } = await supabase.from("loyalty_points").select("points").eq("client_id", user!.id);
      const fullTotal = (allPts || []).reduce((s: number, p: any) => s + p.points, 0);
      // Get salon loyalty config for point value
      const salonId = pointsData[0]?.salon_id;
      let pvCents = 1;
      let enabled = false;
      if (salonId) {
        const { data: salonData } = await supabase.from("salons").select("loyalty_enabled, loyalty_point_value_cents").eq("id", salonId).maybeSingle();
        pvCents = (salonData as any)?.loyalty_point_value_cents ?? 1;
        enabled = (salonData as any)?.loyalty_enabled ?? false;
      }
      setLoyalty({ totalPoints: fullTotal, recentEntries: pointsData, pointValueCents: pvCents, enabled });
    }
  };

  useEffect(() => {
    if (!user) return;
    loadClient();
  }, [user]);

  useEffect(() => {
    const channels = [
      supabase.channel("client-appts-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => loadClient())
        .subscribe(),
      supabase.channel("client-consults-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, () => loadClient())
        .subscribe(),
    ];
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [user]);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <MetricSkeleton key={i} />)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <MetricCard icon={Calendar} label="Upcoming Appointments" value={metrics.upcomingCount} to="/dashboard/appointments" />
        <MetricCard icon={ClipboardList} label="Consultations" value={metrics.consultCount} to="/dashboard/style-board" />
        <MetricCard icon={Crown} label="Membership" value={metrics.membershipTier || "None"} sub={metrics.membershipTier ? "Active" : undefined} to="/dashboard/membership" />
      </div>

      {/* Favorite Services Quick Rebook */}
      {favorites.length > 0 && (
        <Card className="glass border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Heart className="h-4 w-4 fill-destructive text-destructive" /> Quick Rebook
              </CardTitle>
              <Link to="/dashboard/appointments" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {favorites.slice(0, 4).map((fav: any) => (
                <button
                  key={fav.id}
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("salon_id", fav.salon_id);
                    params.set("service_id", fav.service_id);
                    params.set("stylist_id", fav.stylist_id);
                    navigate(`/dashboard/book?${params.toString()}`);
                  }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors duration-150 text-left"
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-champagne flex items-center justify-center shrink-0">
                    <Scissors className="h-4 w-4 text-obsidian" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fav.service_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{fav.stylist_name} · {fav.salon_name}</p>
                  </div>
                  <RotateCcw className="h-4 w-4 text-primary shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loyalty Points Widget */}
      {loyalty.enabled && loyalty.totalPoints > 0 && (
        <Card className="glass border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" /> Loyalty Points
              </CardTitle>
              <Link to="/dashboard/loyalty" className="text-xs text-primary hover:underline">View history →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-3xl font-light tracking-tight">{loyalty.totalPoints.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground font-medium">points balance</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-xl font-medium text-primary">${((loyalty.totalPoints * loyalty.pointValueCents) / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground font-medium">redeemable value</p>
              </div>
            </div>
            {loyalty.recentEntries.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Activity</p>
                {loyalty.recentEntries.slice(0, 3).map((entry: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground truncate max-w-[200px]">{entry.reason}</span>
                    <Badge variant={entry.points >= 0 ? "secondary" : "outline"} className="text-xs shrink-0">
                      {entry.points >= 0 ? "+" : ""}{entry.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Next Appointment */}
        <Card className={`glass border-0 ${nextAppt ? "ring-1 ring-primary/20" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Next Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            {nextAppt ? (
              <div className="space-y-2">
                <p className="text-lg font-medium">{nextAppt.services?.name || "Service"}</p>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(nextAppt.start_time), "EEEE, MMMM d 'at' h:mm a")}
                </p>
                <p className="text-sm text-muted-foreground">with {nextAppt.stylist_profile?.full_name || "Stylist"}</p>
                <Badge variant="secondary" className={`mt-1 ${statusColor[nextAppt.status] || ""}`}>{nextAppt.status}</Badge>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">No upcoming appointments</p>
                <Button asChild size="sm" className="bg-gradient-prism text-white rounded-full"><Link to="/dashboard/book">Book Now</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Style Board */}
        <Card className="glass border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Style Board</CardTitle>
              <Link to="/dashboard/style-board" className="text-xs text-primary hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 py-2">
              <div className="h-10 w-10 rounded-lg bg-gradient-prism flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-medium">{metrics.styleBoardCount}</p>
                <p className="text-sm text-muted-foreground">saved styles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Consultations */}
        <Card className="glass border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Recent Consultations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentConsults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No consultations yet</p>
            ) : recentConsults.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg glass-subtle">
                <div className="ai-badge"><ClipboardList className="h-4 w-4 text-primary shrink-0" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.face_shape ? `Face shape: ${c.face_shape}` : "Consultation"}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, yyyy")}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${statusColor[c.status] || ""}`}>{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="glass border-0 animate-in stagger-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/consultation"><Sparkles className="h-4 w-4 text-primary" /><span className="text-xs">New Consultation</span></Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/book"><Calendar className="h-4 w-4" /><span className="text-xs">Book Appointment</span></Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/style-board"><BookOpen className="h-4 w-4" /><span className="text-xs">Style Board</span></Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-3 flex-col gap-1.5 border border-border/50 hover:bg-muted/60 transition-colors duration-150">
              <Link to="/dashboard/profile"><Settings className="h-4 w-4" /><span className="text-xs">Profile</span></Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ===================== MAIN COMPONENT =====================
const DashboardOverview = () => {
  const { user, role, loading } = useAuth(false);
  const navigate = useNavigate();
  const name = user?.user_metadata?.full_name || user?.email;

  // Redirect salon_admin to onboarding if not complete
  useEffect(() => {
    if (!user || loading || role !== "salon_admin") return;
    supabase.from("salons").select("onboarding_status").eq("owner_id", user.id).maybeSingle().then(({ data }) => {
      if (!data || (data.onboarding_status && data.onboarding_status !== "complete")) {
        navigate("/dashboard/onboarding", { replace: true });
      }
    });
  }, [user, role, loading, navigate]);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-40" />
      <div className="grid grid-cols-3 gap-4">{Array(3).fill(0).map((_, i) => <MetricSkeleton key={i} />)}</div>
    </div>
  );

  return (
    <div>
      <h1 className="text-3xl font-light tracking-tight mb-1">
        Welcome back, {name?.toString().split(" ")[0]}
      </h1>
      <p className="text-muted-foreground mb-6 capitalize font-normal">{role.replace("_", " ")} Dashboard</p>

      {role === "salon_admin" && <AdminOverview user={user} />}
      {role === "stylist" && <StylistOverview user={user} />}
      {role === "client" && <ClientOverview user={user} />}
    </div>
  );
};

export default DashboardOverview;
