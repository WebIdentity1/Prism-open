import { Fragment, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign, CalendarCheck, TrendingUp, Loader2, Users, Download,
  Star, Clock, UserCheck, UserPlus, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area,
  CartesianGrid, ResponsiveContainer
} from "recharts";
import {
  startOfDay, startOfWeek, startOfMonth, startOfYear, format, parseISO,
  subMonths, subDays, isWithinInterval, getDay, getHours, eachMonthOfInterval,
  startOfQuarter
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent-foreground))",
  "hsl(var(--muted-foreground))", "hsl(var(--destructive))", "hsl(var(--ring))"
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 8; // 8am to 7pm
  return h <= 12 ? `${h}am` : `${h - 12}pm`;
});

type DatePreset = "7d" | "30d" | "90d" | "ytd" | "12m" | "custom";

const Financials = () => {
  const { user } = useAuth(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());

  // Apply preset
  useEffect(() => {
    const now = new Date();
    switch (preset) {
      case "7d": setDateFrom(subDays(now, 7)); setDateTo(now); break;
      case "30d": setDateFrom(subDays(now, 30)); setDateTo(now); break;
      case "90d": setDateFrom(subDays(now, 90)); setDateTo(now); break;
      case "ytd": setDateFrom(startOfYear(now)); setDateTo(now); break;
      case "12m": setDateFrom(subMonths(now, 12)); setDateTo(now); break;
    }
  }, [preset]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).single();
      if (!salon) { setLoading(false); return; }

      const [{ data: appts }, { data: revs }, { data: profs }] = await Promise.all([
        supabase.from("appointments").select("*, services:service_id(name, price)").eq("salon_id", salon.id).order("start_time", { ascending: false }),
        supabase.from("reviews").select("*").eq("salon_id", salon.id),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      setAppointments(appts || []);
      setReviews(revs || []);
      setProfiles(profs || []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Filtered appointments
  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const d = parseISO(a.start_time);
      return isWithinInterval(d, { start: startOfDay(dateFrom), end: dateTo });
    });
  }, [appointments, dateFrom, dateTo]);

  const completedFiltered = useMemo(() => filtered.filter((a) => a.status === "completed"), [filtered]);

  // === METRIC CARDS ===
  const totalRevenue = useMemo(() => completedFiltered.reduce((s: number, a: any) => s + (a.services?.price || 0), 0), [completedFiltered]);
  const totalAppointments = filtered.length;
  const uniqueClients = useMemo(() => new Set(filtered.map((a) => a.client_id)).size, [filtered]);
  const avgTicket = uniqueClients > 0 ? totalRevenue / uniqueClients : 0;

  // === REVENUE TREND (12 months) ===
  const revenueTrend = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(new Date(), 11), end: new Date() });
    return months.map((m) => {
      const mStart = startOfMonth(m);
      const mEnd = startOfMonth(subMonths(m, -1));
      const rev = appointments
        .filter((a) => a.status === "completed" && parseISO(a.start_time) >= mStart && parseISO(a.start_time) < mEnd)
        .reduce((s: number, a: any) => s + (a.services?.price || 0), 0);
      return { month: format(m, "MMM yy"), revenue: rev };
    });
  }, [appointments]);

  // === CLIENT RETENTION ===
  const clientMetrics = useMemo(() => {
    const clientFirstAppt: Record<string, Date> = {};
    const clientApptCount: Record<string, number> = {};
    appointments.forEach((a) => {
      const d = parseISO(a.start_time);
      if (!clientFirstAppt[a.client_id] || d < clientFirstAppt[a.client_id]) {
        clientFirstAppt[a.client_id] = d;
      }
      clientApptCount[a.client_id] = (clientApptCount[a.client_id] || 0) + 1;
    });

    const now = new Date();
    const thisMonth = startOfMonth(now);
    const lastMonth = startOfMonth(subMonths(now, 1));

    const newThisMonth = Object.values(clientFirstAppt).filter((d) => d >= thisMonth).length;
    const newLastMonth = Object.values(clientFirstAppt).filter((d) => d >= lastMonth && d < thisMonth).length;
    const totalClients = Object.keys(clientApptCount).length;
    const returningClients = Object.values(clientApptCount).filter((c) => c >= 2).length;
    const retentionRate = totalClients > 0 ? (returningClients / totalClients) * 100 : 0;

    return { newThisMonth, newLastMonth, retentionRate, totalClients, returningClients };
  }, [appointments]);

  // === TIME SLOTS HEATMAP ===
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0));
    filtered.forEach((a) => {
      const d = parseISO(a.start_time);
      const day = getDay(d);
      const hour = getHours(d) - 8; // offset to 8am
      if (hour >= 0 && hour < 12) grid[day][hour]++;
    });
    const max = Math.max(1, ...grid.flat());
    return { grid, max };
  }, [filtered]);

  // === STYLIST PERFORMANCE ===
  const stylistPerf = useMemo(() => {
    const map: Record<string, { revenue: number; count: number; ratings: number[]; name: string }> = {};
    filtered.forEach((a) => {
      if (!map[a.stylist_id]) {
        const prof = profiles.find((p) => p.user_id === a.stylist_id);
        map[a.stylist_id] = { revenue: 0, count: 0, ratings: [], name: prof?.full_name || "Unknown" };
      }
      map[a.stylist_id].count++;
      if (a.status === "completed") map[a.stylist_id].revenue += a.services?.price || 0;
    });
    reviews.forEach((r) => {
      if (map[r.stylist_id]) map[r.stylist_id].ratings.push(r.rating);
    });
    return Object.entries(map)
      .map(([id, d]) => ({
        id, ...d,
        avgRating: d.ratings.length > 0 ? d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length : null,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, reviews, profiles]);

  // === STATUS BREAKDOWN ===
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // === TOP SERVICES ===
  const topServices = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((a) => {
      const name = a.services?.name || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  // === CSV EXPORT ===
  const exportCSV = () => {
    const headers = ["Date", "Client ID", "Stylist ID", "Service", "Price", "Status"];
    const rows = filtered.map((a) => [
      format(parseISO(a.start_time), "yyyy-MM-dd HH:mm"),
      a.client_id, a.stylist_id,
      a.services?.name || "", a.services?.price || 0, a.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-${format(dateFrom, "yyyyMMdd")}-${format(dateTo, "yyyyMMdd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(var(--primary))" },
    count: { label: "Bookings", color: "hsl(var(--primary))" },
    value: { label: "Count", color: "hsl(var(--primary))" },
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? "+100%" : "—";
    const pct = ((curr - prev) / prev) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground text-sm">Revenue, clients, and performance insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as DatePreset)}>
            <SelectTrigger className="w-[140px] h-9 text-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="ytd">Year to date</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          {preset === "custom" && (
            <div className="flex gap-1 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-9">
                    {format(dateFrom, "MMM d")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-9">
                    {format(dateTo, "MMM d")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Revenue", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, sub: `${completedFiltered.length} completed` },
          { label: "Appointments", value: totalAppointments.toString(), icon: CalendarCheck, sub: `${statusData.find(s => s.name === "cancelled")?.value || 0} cancelled` },
          { label: "Unique Clients", value: uniqueClients.toString(), icon: Users, sub: `$${avgTicket.toFixed(0)} avg spend` },
          { label: "Retention Rate", value: `${clientMetrics.retentionRate.toFixed(0)}%`, icon: UserCheck, sub: `${clientMetrics.returningClients} returning` },
        ].map((card) => (
          <Card key={card.label} className="glass border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <p className="text-2xl font-light">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client Growth */}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <Card className="glass border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
            <CardTitle className="text-xs font-medium text-muted-foreground">New Clients This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <p className="text-2xl font-light">{clientMetrics.newThisMonth}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pctChange(clientMetrics.newThisMonth, clientMetrics.newLastMonth)} vs last month ({clientMetrics.newLastMonth})
            </p>
          </CardContent>
        </Card>
        <Card className="glass border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Client Base</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <p className="text-2xl font-light">{clientMetrics.totalClients}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {clientMetrics.returningClients} returning · {clientMetrics.totalClients - clientMetrics.returningClients} one-time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card className="glass border-0 mb-8">
        <CardHeader className="p-6">
          <CardTitle className="text-sm font-medium">Revenue Trend (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[280px]">
            <AreaChart data={revenueTrend} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Detailed Breakdowns — tabbed for progressive disclosure */}
      <Tabs defaultValue="time-slots" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="time-slots">Time Slots</TabsTrigger>
          <TabsTrigger value="status">By Status</TabsTrigger>
          <TabsTrigger value="services">Top Services</TabsTrigger>
          <TabsTrigger value="stylists">Stylist Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="time-slots">
          <Card className="glass border-0">
            <CardHeader className="p-6">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" /> Popular Time Slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[400px]">
                  <div className="grid grid-cols-[48px_repeat(12,1fr)] gap-1 text-[10px]">
                    <div />
                    {HOUR_LABELS.map((h) => (
                      <div key={h} className="text-center text-muted-foreground font-medium">{h}</div>
                    ))}
                    {DAY_LABELS.map((day, di) => (
                      <Fragment key={day}>
                        <div className="flex items-center text-muted-foreground font-medium">{day}</div>
                        {heatmapData.grid[di].map((val, hi) => {
                          const intensity = val / heatmapData.max;
                          return (
                            <div
                              key={`${di}-${hi}`}
                              className="aspect-square rounded-sm flex items-center justify-center text-[9px] font-medium transition-colors"
                              style={{
                                backgroundColor: val === 0
                                  ? "hsl(var(--muted))"
                                  : `hsl(var(--primary) / ${0.15 + intensity * 0.85})`,
                                color: intensity > 0.5 ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
                              }}
                              title={`${day} ${HOUR_LABELS[hi]}: ${val} appointments`}
                            >
                              {val > 0 ? val : ""}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          {statusData.length > 0 ? (
            <Card className="glass border-0">
              <CardHeader className="p-6">
                <CardTitle className="text-sm font-medium">Appointments by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No status data for this period</p>
          )}
        </TabsContent>

        <TabsContent value="services">
          {topServices.length > 0 ? (
            <Card className="glass border-0">
              <CardHeader className="p-6">
                <CardTitle className="text-sm font-medium">Top Services</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <BarChart data={topServices} layout="vertical" margin={{ left: 80, right: 16, top: 8, bottom: 8 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No service data for this period</p>
          )}
        </TabsContent>

        <TabsContent value="stylists">
          <Card className="glass border-0">
            <CardHeader className="p-6">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Stylist Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stylistPerf.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No stylist data for this period</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Stylist</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                      <TableHead className="text-xs text-right">Appts</TableHead>
                      <TableHead className="text-xs text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stylistPerf.slice(0, 8).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-right">${s.revenue.toFixed(0)}</TableCell>
                        <TableCell className="text-sm text-right">{s.count}</TableCell>
                        <TableCell className="text-right">
                          {s.avgRating ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Star className="h-3 w-3 fill-current" />{s.avgRating.toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {appointments.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No appointment data yet. Analytics will appear here once appointments are booked.</p>
        </div>
      )}
    </div>
  );
};

export default Financials;
