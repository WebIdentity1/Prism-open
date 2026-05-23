import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, differenceInMinutes, parseISO, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { CalendarIcon, Loader2, TrendingUp, DollarSign, Clock, Scissors, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

interface SlidingTier { min: number; max: number | null; rate: number }

interface CompSettings {
  commission_type: string;
  commission_rate: number;
  sliding_scale_tiers: SlidingTier[];
  product_commission_rate: number;
  hourly_rate: number;
  enable_greater_of: boolean;
}

interface ApptDetail {
  id: string;
  start_time: string;
  end_time: string;
  service_name: string;
  service_price: number;
  duration_minutes: number;
}

function calcSlidingRate(revenue: number, tiers: SlidingTier[]): { rate: number; commission: number } {
  if (tiers.length === 0) return { rate: 0, commission: 0 };
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let applicableTier = sorted[0];
  for (const t of sorted) {
    if (revenue >= t.min) applicableTier = t;
  }
  return { rate: applicableTier.rate, commission: revenue * (applicableTier.rate / 100) };
}

const Earnings = () => {
  const { user, role } = useAuth(false);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [comp, setComp] = useState<CompSettings | null>(null);
  const [appts, setAppts] = useState<ApptDetail[]>([]);
  const [salonName, setSalonName] = useState("");

  const fetchEarnings = async () => {
    if (!user) return;
    setLoading(true);

    // Get stylist profile with compensation settings
    const { data: stylistProfile } = await supabase
      .from("stylist_profiles")
      .select("commission_type, commission_rate, sliding_scale_tiers, product_commission_rate, hourly_rate, enable_greater_of, salon_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!stylistProfile) { setLoading(false); return; }

    const compData: CompSettings = {
      commission_type: (stylistProfile as any).commission_type || "flat",
      commission_rate: Number(stylistProfile.commission_rate ?? 50),
      sliding_scale_tiers: Array.isArray((stylistProfile as any).sliding_scale_tiers) ? (stylistProfile as any).sliding_scale_tiers : [],
      product_commission_rate: Number((stylistProfile as any).product_commission_rate ?? 0),
      hourly_rate: Number((stylistProfile as any).hourly_rate ?? 0),
      enable_greater_of: (stylistProfile as any).enable_greater_of ?? false,
    };
    setComp(compData);

    if (stylistProfile.salon_id) {
      const { data: salon } = await supabase.from("salons").select("name").eq("id", stylistProfile.salon_id).maybeSingle();
      setSalonName(salon?.name || "");
    }

    // Fetch completed appointments
    const { data: apptData } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, service_id, services:service_id(name, price, duration_minutes)")
      .eq("stylist_id", user.id)
      .eq("status", "completed")
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString())
      .order("start_time");

    setAppts(
      (apptData || []).map((a: any) => ({
        id: a.id,
        start_time: a.start_time,
        end_time: a.end_time,
        service_name: a.services?.name || "Service",
        service_price: Number(a.services?.price || 0),
        duration_minutes: a.end_time && a.start_time
          ? differenceInMinutes(new Date(a.end_time), new Date(a.start_time))
          : (a.services?.duration_minutes || 60),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchEarnings(); }, [user, from, to]);

  const earnings = useMemo(() => {
    if (!comp) return null;

    const totalServiceRevenue = appts.reduce((s, a) => s + a.service_price, 0);
    const totalMinutes = appts.reduce((s, a) => s + a.duration_minutes, 0);
    const totalHours = totalMinutes / 60;

    let serviceCommission: number;
    let effectiveRate: number;
    if (comp.commission_type === "sliding_scale") {
      const result = calcSlidingRate(totalServiceRevenue, comp.sliding_scale_tiers);
      serviceCommission = result.commission;
      effectiveRate = result.rate;
    } else {
      effectiveRate = comp.commission_rate;
      serviceCommission = totalServiceRevenue * (comp.commission_rate / 100);
    }

    const productCommission = 0; // placeholder
    const hourlyPay = comp.hourly_rate * totalHours;
    const totalCommission = serviceCommission + productCommission;

    let totalCompensation: number;
    let method: string;
    if (comp.enable_greater_of && comp.hourly_rate > 0) {
      if (hourlyPay > totalCommission) {
        totalCompensation = hourlyPay;
        method = "Hourly (greater-of)";
      } else {
        totalCompensation = totalCommission;
        method = "Commission (greater-of)";
      }
    } else if (comp.hourly_rate > 0 && comp.commission_rate === 0 && comp.commission_type === "flat") {
      totalCompensation = hourlyPay;
      method = "Hourly";
    } else {
      totalCompensation = totalCommission;
      method = comp.commission_type === "sliding_scale" ? "Sliding scale" : "Flat commission";
    }

    return {
      totalServiceRevenue,
      totalHours,
      totalMinutes,
      serviceCommission,
      productCommission,
      hourlyPay,
      totalCompensation,
      effectiveRate,
      method,
      appointmentCount: appts.length,
      avgPerAppt: appts.length > 0 ? totalCompensation / appts.length : 0,
      avgPerHour: totalHours > 0 ? totalCompensation / totalHours : 0,
    };
  }, [comp, appts]);

  // Weekly breakdown for chart
  const weeklyData = useMemo(() => {
    if (!comp || appts.length === 0) return [];
    const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
    return weeks.map(weekStart => {
      const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekAppts = appts.filter(a => {
        const d = parseISO(a.start_time);
        return isWithinInterval(d, { start: weekStart, end: wEnd });
      });
      const revenue = weekAppts.reduce((s, a) => s + a.service_price, 0);
      const minutes = weekAppts.reduce((s, a) => s + a.duration_minutes, 0);
      const hours = minutes / 60;
      let commission: number;
      if (comp.commission_type === "sliding_scale") {
        commission = calcSlidingRate(revenue, comp.sliding_scale_tiers).commission;
      } else {
        commission = revenue * (comp.commission_rate / 100);
      }
      const hourlyPay = comp.hourly_rate * hours;
      return {
        week: format(weekStart, "MMM d"),
        revenue,
        commission,
        hourly: hourlyPay,
        appts: weekAppts.length,
      };
    });
  }, [comp, appts, from, to]);

  const fmt = (n: number) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const exportCSV = () => {
    if (!earnings) return;
    const header = "Date,Service,Price,Duration (min)";
    const lines = appts.map(a =>
      `"${format(parseISO(a.start_time), "yyyy-MM-dd")}","${a.service_name}",${a.service_price.toFixed(2)},${a.duration_minutes}`
    );
    const summary = [
      "",
      `Total Revenue,${earnings.totalServiceRevenue.toFixed(2)}`,
      `Total Hours,${earnings.totalHours.toFixed(1)}`,
      `Service Commission,${earnings.serviceCommission.toFixed(2)}`,
      `Hourly Pay,${earnings.hourlyPay.toFixed(2)}`,
      `Total Earnings,${earnings.totalCompensation.toFixed(2)}`,
      `Method,${earnings.method}`,
    ];
    const blob = new Blob([header + "\n" + lines.join("\n") + "\n" + summary.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earnings-${format(from, "yyyy-MM-dd")}-to-${format(to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!comp) return <p className="text-center text-muted-foreground py-16">No stylist profile found.</p>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight mb-1">My Earnings</h1>
          <p className="text-muted-foreground">{salonName ? `${salonName} · ` : ""}Your compensation breakdown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker date={from} onSelect={setFrom} />
          <span className="text-muted-foreground">–</span>
          <DatePicker date={to} onSelect={setTo} />
          <Button variant="outline" size="sm" className="rounded-full" onClick={exportCSV} disabled={!earnings || appts.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {earnings && (
        <>
          {/* Top-level earnings cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="glass-elevated rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <CardHeader className="pb-2 p-6">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Earnings</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-3xl font-light text-champagne">{fmt(earnings.totalCompensation)}</p>
                <Badge className="badge-champagne mt-1 text-[10px]">{earnings.method}</Badge>
              </CardContent>
            </Card>
            <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <CardHeader className="pb-2 p-6">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Appointments</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-2xl font-light">{earnings.appointmentCount}</p>
                <p className="text-xs text-muted-foreground mt-1">{fmt(earnings.avgPerAppt)} avg / appt</p>
              </CardContent>
            </Card>
            <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <CardHeader className="pb-2 p-6">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hours Worked</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-2xl font-light">{earnings.totalHours.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground mt-1">{fmt(earnings.avgPerHour)} / hr effective</p>
              </CardContent>
            </Card>
            <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <CardHeader className="pb-2 p-6">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Service Revenue</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <p className="text-2xl font-light">{fmt(earnings.totalServiceRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{earnings.effectiveRate}% effective rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Compensation breakdown */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="text-base font-medium">Compensation Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <BreakdownRow
                  label="Service Commission"
                  sublabel={comp.commission_type === "sliding_scale" ? `Sliding scale · ${earnings.effectiveRate}% tier` : `Flat ${comp.commission_rate}%`}
                  amount={earnings.serviceCommission}
                  total={earnings.totalCompensation}
                  icon={<Scissors className="h-4 w-4" />}
                />
                {comp.product_commission_rate > 0 && (
                  <BreakdownRow
                    label="Product Commission"
                    sublabel={`${comp.product_commission_rate}% of product sales`}
                    amount={earnings.productCommission}
                    total={earnings.totalCompensation}
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                )}
                {comp.hourly_rate > 0 && (
                  <BreakdownRow
                    label="Hourly Pay"
                    sublabel={`$${comp.hourly_rate}/hr × ${earnings.totalHours.toFixed(1)}h`}
                    amount={earnings.hourlyPay}
                    total={earnings.totalCompensation}
                    icon={<Clock className="h-4 w-4" />}
                  />
                )}
                {comp.enable_greater_of && comp.hourly_rate > 0 && (
                  <>
                    <Separator />
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium mb-1">Greater-of Calculation</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={earnings.hourlyPay > earnings.serviceCommission ? "font-semibold text-primary" : "text-muted-foreground"}>
                          Hourly: {fmt(earnings.hourlyPay)}
                        </span>
                        <span className="text-muted-foreground">vs</span>
                        <span className={earnings.serviceCommission >= earnings.hourlyPay ? "font-semibold text-primary" : "text-muted-foreground"}>
                          Commission: {fmt(earnings.serviceCommission)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        You're being paid the <strong>{earnings.hourlyPay > earnings.serviceCommission ? "hourly" : "commission"}</strong> amount ({fmt(earnings.totalCompensation)})
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Sliding scale tiers visualization */}
            {comp.commission_type === "sliding_scale" && comp.sliding_scale_tiers.length > 0 && (
              <Card className="glass rounded-xl border-0">
                <CardHeader className="p-6">
                  <CardTitle className="text-base font-medium">Your Commission Tiers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {comp.sliding_scale_tiers
                    .sort((a, b) => a.min - b.min)
                    .map((tier, i) => {
                      const isActive = earnings.totalServiceRevenue >= tier.min &&
                        (tier.max === null || earnings.totalServiceRevenue < tier.max);
                      return (
                        <div key={i} className={cn("p-3 rounded-lg border transition-colors", isActive ? "border-primary bg-primary/5" : "border-border")}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {fmt(tier.min)} – {tier.max != null ? fmt(tier.max) : "∞"}
                            </span>
                            <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                              {tier.rate}%{isActive ? " · Active" : ""}
                            </Badge>
                          </div>
                          {isActive && tier.max != null && (
                            <Progress
                              value={Math.min(100, ((earnings.totalServiceRevenue - tier.min) / (tier.max - tier.min)) * 100)}
                              className="h-1.5 mt-2"
                            />
                          )}
                        </div>
                      );
                    })}
                  <p className="text-xs text-muted-foreground">
                    Current revenue: <strong>{fmt(earnings.totalServiceRevenue)}</strong>
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Weekly chart */}
            {comp.commission_type !== "sliding_scale" && weeklyData.length > 0 && (
              <Card className="glass rounded-xl border-0">
                <CardHeader className="p-6">
                  <CardTitle className="text-base font-medium">Weekly Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                      <RechartsTooltip formatter={(v: number) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="commission" name="Commission" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      {comp.hourly_rate > 0 && (
                        <Bar dataKey="hourly" name="Hourly" fill="hsl(var(--accent-foreground))" radius={[3, 3, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Weekly chart for sliding scale (separate row) */}
          {comp.commission_type === "sliding_scale" && weeklyData.length > 0 && (
            <Card className="glass rounded-xl border-0 mb-6">
              <CardHeader className="p-6">
                <CardTitle className="text-base font-medium">Weekly Earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="commission" name="Commission" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    {comp.hourly_rate > 0 && (
                      <Bar dataKey="hourly" name="Hourly" fill="hsl(var(--accent-foreground))" radius={[3, 3, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Appointment detail table */}
          {appts.length > 0 && (
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="text-base font-medium">Appointment Details</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appts.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{format(parseISO(a.start_time), "MMM d, h:mm a")}</TableCell>
                        <TableCell className="text-sm">{a.service_name}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(a.service_price)}</TableCell>
                        <TableCell className="text-right text-sm">{a.duration_minutes}m</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

function BreakdownRow({ label, sublabel, amount, total, icon }: {
  label: string; sublabel: string; amount: number; total: number; icon: React.ReactNode;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const fmt = (n: number) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
          </div>
        </div>
        <p className="text-sm font-semibold">{fmt(amount)}</p>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function DatePicker({ date, onSelect }: { date: Date; onSelect: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal min-w-[140px]")}>
          <CalendarIcon className="h-4 w-4 mr-2 opacity-50" />
          {format(date, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && onSelect(d)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

export default Earnings;
