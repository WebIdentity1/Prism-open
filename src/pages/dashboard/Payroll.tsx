import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, differenceInMinutes } from "date-fns";
import { CalendarIcon, Download, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SlidingTier { min: number; max: number | null; rate: number }

interface StylistComp {
  user_id: string;
  commission_type: string;
  commission_rate: number;
  sliding_scale_tiers: SlidingTier[];
  product_commission_rate: number;
  hourly_rate: number;
  enable_greater_of: boolean;
}

interface PayrollRow {
  stylistId: string;
  name: string;
  completedCount: number;
  totalServiceRevenue: number;
  hoursWorked: number;
  serviceCommission: number;
  productCommission: number;
  hourlyPay: number;
  totalCompensation: number;
  netToSalon: number;
  method: string; // description of calc used
  commissionType: string;
  enableGreaterOf: boolean;
}

function calcSlidingCommission(revenue: number, tiers: SlidingTier[]): number {
  if (tiers.length === 0) return 0;
  // Find the applicable tier based on total revenue
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  let applicableTier = sorted[0];
  for (const t of sorted) {
    if (revenue >= t.min) applicableTier = t;
  }
  return revenue * (applicableTier.rate / 100);
}

const Payroll = () => {
  const { user } = useAuth(false);
  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState<any>(null);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));

  const fetchPayroll = async () => {
    if (!user) return;
    setLoading(true);

    const { data: salonData } = await supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle();
    setSalon(salonData);
    if (!salonData) { setLoading(false); return; }

    // Fetch completed appointments in range
    const { data: appts } = await supabase
      .from("appointments")
      .select("stylist_id, service_id, start_time, end_time, status")
      .eq("salon_id", salonData.id)
      .eq("status", "completed")
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString());

    // Fetch services for pricing
    const { data: services } = await supabase.from("services").select("id, price, duration_minutes").eq("salon_id", salonData.id);
    const serviceMap = new Map((services || []).map(s => [s.id, { price: Number(s.price), duration: s.duration_minutes }]));

    // Fetch stylist compensation data
    const { data: stylists } = await supabase
      .from("stylist_profiles")
      .select("user_id, commission_rate, commission_type, sliding_scale_tiers, product_commission_rate, hourly_rate, enable_greater_of")
      .eq("salon_id", salonData.id);

    const stylistIds = (stylists || []).map(s => s.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", stylistIds.length ? stylistIds : ["__none__"]);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name || "Unknown"]));

    const compMap = new Map<string, StylistComp>(
      (stylists || []).map((s: any) => [s.user_id, {
        user_id: s.user_id,
        commission_type: s.commission_type || "flat",
        commission_rate: Number(s.commission_rate ?? salonData.default_commission_rate ?? 50),
        sliding_scale_tiers: Array.isArray(s.sliding_scale_tiers) ? s.sliding_scale_tiers : [],
        product_commission_rate: Number(s.product_commission_rate ?? 0),
        hourly_rate: Number(s.hourly_rate ?? 0),
        enable_greater_of: s.enable_greater_of ?? false,
      }])
    );

    // Aggregate per stylist
    const agg = new Map<string, { count: number; revenue: number; minutes: number }>();
    for (const a of (appts || [])) {
      const prev = agg.get(a.stylist_id) || { count: 0, revenue: 0, minutes: 0 };
      prev.count += 1;
      const svc = serviceMap.get(a.service_id!);
      prev.revenue += svc?.price || 0;
      if (a.start_time && a.end_time) {
        prev.minutes += differenceInMinutes(new Date(a.end_time), new Date(a.start_time));
      } else if (svc) {
        prev.minutes += svc.duration;
      }
      agg.set(a.stylist_id, prev);
    }

    const payrollRows: PayrollRow[] = stylistIds.map(sid => {
      const stats = agg.get(sid) || { count: 0, revenue: 0, minutes: 0 };
      const comp = compMap.get(sid)!;
      const hoursWorked = stats.minutes / 60;

      // Service commission
      let serviceCommission: number;
      if (comp.commission_type === "sliding_scale") {
        serviceCommission = calcSlidingCommission(stats.revenue, comp.sliding_scale_tiers);
      } else {
        serviceCommission = stats.revenue * (comp.commission_rate / 100);
      }

      // Product commission (placeholder — no product sales table yet)
      const productCommission = 0;

      const hourlyPay = comp.hourly_rate * hoursWorked;
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
        method = "Hourly only";
      } else {
        totalCompensation = totalCommission + (comp.enable_greater_of ? 0 : 0);
        method = comp.commission_type === "sliding_scale" ? "Sliding scale" : "Flat commission";
      }

      return {
        stylistId: sid,
        name: profileMap.get(sid) || "Unknown",
        completedCount: stats.count,
        totalServiceRevenue: stats.revenue,
        hoursWorked,
        serviceCommission,
        productCommission,
        hourlyPay,
        totalCompensation,
        netToSalon: stats.revenue - totalCompensation,
        method,
        commissionType: comp.commission_type,
        enableGreaterOf: comp.enable_greater_of,
      };
    });

    setRows(payrollRows.sort((a, b) => b.totalServiceRevenue - a.totalServiceRevenue));
    setLoading(false);
  };

  useEffect(() => { fetchPayroll(); }, [user, from, to]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.totalServiceRevenue,
      compensation: acc.compensation + r.totalCompensation,
      net: acc.net + r.netToSalon,
      appts: acc.appts + r.completedCount,
      hours: acc.hours + r.hoursWorked,
    }),
    { revenue: 0, compensation: 0, net: 0, appts: 0, hours: 0 }
  ), [rows]);

  const exportCSV = () => {
    const header = "Stylist,Appts,Hours,Service Revenue,Service Commission,Product Commission,Hourly Pay,Total Compensation,Method,Net to Salon";
    const lines = rows.map(r =>
      `"${r.name}",${r.completedCount},${r.hoursWorked.toFixed(1)},${r.totalServiceRevenue.toFixed(2)},${r.serviceCommission.toFixed(2)},${r.productCommission.toFixed(2)},${r.hourlyPay.toFixed(2)},${r.totalCompensation.toFixed(2)},"${r.method}",${r.netToSalon.toFixed(2)}`
    );
    lines.push(`"TOTAL",${totals.appts},${totals.hours.toFixed(1)},${totals.revenue.toFixed(2)},,,,${totals.compensation.toFixed(2)},,${totals.net.toFixed(2)}`);
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${format(from, "yyyy-MM-dd")}-to-${format(to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight mb-1">Payroll</h1>
          <p className="text-muted-foreground">Run payroll reports for your team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePicker date={from} onSelect={setFrom} />
          <span className="text-muted-foreground">–</span>
          <DatePicker date={to} onSelect={setTo} />
          <Button variant="outline" size="sm" className="rounded-full" onClick={exportCSV} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !salon ? (
        <p className="text-center text-muted-foreground py-16">Set up your salon first to run payroll.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <SummaryCard title="Completed Appts" value={totals.appts.toString()} />
            <SummaryCard title="Total Revenue" value={fmt(totals.revenue)} />
            <SummaryCard title="Total Compensation" value={fmt(totals.compensation)} />
            <SummaryCard title="Net to Salon" value={fmt(totals.net)} />
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No completed appointments in this period.</p>
            </div>
          ) : (
            <Card className="glass rounded-xl border-0">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stylist</TableHead>
                      <TableHead className="text-right">Appts</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Svc Comm.</TableHead>
                      <TableHead className="text-right">Hourly Pay</TableHead>
                      <TableHead className="text-right">Total Comp.</TableHead>
                      <TableHead className="text-center">Method</TableHead>
                      <TableHead className="text-right">Net to Salon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.stylistId}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.completedCount}</TableCell>
                        <TableCell className="text-right">{r.hoursWorked.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{fmt(r.totalServiceRevenue)}</TableCell>
                        <TableCell className="text-right">{fmt(r.serviceCommission)}</TableCell>
                        <TableCell className="text-right">{fmt(r.hourlyPay)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(r.totalCompensation)}</TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-[10px]">{r.method}</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {r.enableGreaterOf
                                ? `Greater-of: Hourly ${fmt(r.hourlyPay)} vs Commission ${fmt(r.serviceCommission)}`
                                : r.method}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right">{fmt(r.netToSalon)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold">{totals.appts}</TableCell>
                      <TableCell className="text-right font-semibold">{totals.hours.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(totals.revenue)}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-semibold">{fmt(totals.compensation)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-semibold">{fmt(totals.net)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
      <CardHeader className="pb-2 p-6">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <p className="text-2xl font-light">{value}</p>
      </CardContent>
    </Card>
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

export default Payroll;
