import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  format, parseISO, startOfDay, addDays, subDays, isToday, differenceInMinutes,
} from "date-fns";

// --- Constants ---

const CALENDAR_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am – 8pm
const HOUR_HEIGHT = 64; // px per hour row
const FIRST_HOUR = 7;

const statusColor: Record<string, string> = {
  booked: "bg-primary/20 border-primary text-primary",
  confirmed: "bg-accent/50 border-accent text-accent-foreground",
  completed:
    "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400",
  cancelled: "bg-muted border-muted text-muted-foreground",
  no_show: "bg-destructive/10 border-destructive/30 text-destructive",
};

// --- Interfaces ---

interface CalendarStylist {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface CalendarAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  client_id: string;
  stylist_id: string;
  salon_id: string;
  services: { name: string; price: number } | null;
  client_profile: { full_name: string } | null;
}

// --- Helpers ---

function getBlockStyle(appt: CalendarAppointment): React.CSSProperties {
  const start = parseISO(appt.start_time);
  const end = parseISO(appt.end_time);
  const startHour = start.getHours();
  const startMin = start.getMinutes();
  const durationMin = differenceInMinutes(end, start);

  const top =
    (startHour - FIRST_HOUR) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 20);

  return { position: "absolute", top: `${top}px`, height: `${height}px`, left: "4px", right: "4px" };
}

// --- Component ---

const StaffCalendar = () => {
  const { user } = useAuth(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [salonId, setSalonId] = useState<string | null>(null);
  const [stylists, setStylists] = useState<CalendarStylist[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Tick state for live current-time line
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isToday(selectedDate)) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // --- Data fetching ---

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Get admin's salon
    const { data: salon } = await supabase
      .from("salons")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!salon) {
      setSalonId(null);
      setLoading(false);
      return;
    }
    setSalonId(salon.id);

    // 2. Fetch stylists + appointments in parallel
    const dayStart = startOfDay(selectedDate);
    const dayEnd = startOfDay(addDays(selectedDate, 1));

    const [stylistRes, apptRes] = await Promise.all([
      supabase.from("stylist_profiles").select("user_id").eq("salon_id", salon.id),
      supabase
        .from("appointments")
        .select(
          "id, start_time, end_time, status, notes, client_id, stylist_id, salon_id, " +
            "services:service_id(name, price), " +
            "client_profile:profiles!appointments_client_id_profiles_fkey(full_name)"
        )
        .eq("salon_id", salon.id)
        .gte("start_time", dayStart.toISOString())
        .lt("start_time", dayEnd.toISOString())
        .in("status", ["booked", "confirmed", "completed"])
        .order("start_time"),
    ]);

    // 3. Resolve stylist names/avatars from profiles table
    const stylistData = stylistRes.data || [];
    if (stylistData.length > 0) {
      const userIds = stylistData.map((s) => s.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profilesData || []).map((p) => [p.user_id, p])
      );
      setStylists(
        stylistData.map((s) => ({
          user_id: s.user_id,
          full_name: profileMap.get(s.user_id)?.full_name || "Unknown",
          avatar_url: profileMap.get(s.user_id)?.avatar_url || null,
        }))
      );
    } else {
      setStylists([]);
    }

    setAppointments((apptRes.data as CalendarAppointment[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, selectedDate]);

  // Real-time subscription
  useEffect(() => {
    if (!salonId) return;
    const channel = supabase
      .channel("staff-calendar-appts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [salonId, selectedDate]);

  // --- Computed ---

  const appointmentsByStylist = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const stylist of stylists) {
      map.set(stylist.user_id, []);
    }
    for (const appt of appointments) {
      const list = map.get(appt.stylist_id);
      if (list) list.push(appt);
    }
    return map;
  }, [stylists, appointments]);

  const currentTimeOffset = useMemo(() => {
    if (!isToday(selectedDate)) return null;
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours < FIRST_HOUR || hours > 20) return null;
    return (hours - FIRST_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, /* tick triggers recalc */]);

  // --- Navigation ---

  const goToPrevDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!salonId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Set up your salon first to view the staff calendar.</p>
      </div>
    );
  }

  if (stylists.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No staff members added yet. Add stylists in Staff Management to see their calendar.</p>
      </div>
    );
  }

  const totalGridHeight = CALENDAR_HOURS.length * HOUR_HEIGHT;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-light tracking-tight mb-1"

          >
            Staff Calendar
          </h1>
          <p className="text-muted-foreground font-normal">View all staff appointments at a glance</p>
        </div>
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {format(selectedDate, "EEEE, MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <Card className="glass rounded-xl border-0">
        <CardContent className="p-0 overflow-x-auto">
          <div style={{ minWidth: `${80 + stylists.length * 200}px` }}>
            {/* Stylist header row */}
            <div className="flex border-b border-border sticky top-0 glass-subtle z-10">
              {/* Time column header */}
              <div className="w-20 shrink-0 p-3 text-xs text-muted-foreground font-medium">
                Time
              </div>
              {/* Stylist columns */}
              {stylists.map((stylist) => (
                <div
                  key={stylist.user_id}
                  className="flex-1 min-w-[180px] p-3 border-l border-border flex items-center gap-2"
                >
                  <Avatar className="h-8 w-8">
                    {stylist.avatar_url && (
                      <AvatarImage src={stylist.avatar_url} alt={stylist.full_name} />
                    )}
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {stylist.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{stylist.full_name}</span>
                </div>
              ))}
            </div>

            {/* Time grid body */}
            <div className="relative flex" style={{ height: `${totalGridHeight}px` }}>
              {/* Time labels column */}
              <div className="w-20 shrink-0">
                {CALENDAR_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/50 text-right pr-3 pt-1"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  >
                    <span className="text-[11px] text-muted-foreground">
                      {hour > 12
                        ? `${hour - 12} PM`
                        : hour === 12
                          ? "12 PM"
                          : `${hour} AM`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stylist columns with appointment blocks */}
              {stylists.map((stylist) => {
                const stylistAppts = appointmentsByStylist.get(stylist.user_id) || [];
                return (
                  <div
                    key={stylist.user_id}
                    className="flex-1 min-w-[180px] border-l border-border relative"
                  >
                    {/* Hour row backgrounds */}
                    {CALENDAR_HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="border-b border-border/50"
                        style={{ height: `${HOUR_HEIGHT}px` }}
                      />
                    ))}

                    {/* Absolutely positioned appointment blocks */}
                    {stylistAppts.map((appt) => (
                      <div
                        key={appt.id}
                        style={getBlockStyle(appt)}
                        className={cn(
                          "rounded-md border px-2 py-1 overflow-hidden z-[1]",
                          "transition-shadow hover:shadow-md hover:z-10",
                          statusColor[appt.status] || "bg-muted border-border"
                        )}
                      >
                        <p className="text-[11px] leading-tight font-semibold truncate">
                          {format(parseISO(appt.start_time), "h:mm")} –{" "}
                          {format(parseISO(appt.end_time), "h:mm")}
                        </p>
                        <p className="text-[11px] leading-tight font-medium truncate">
                          {appt.client_profile?.full_name || "Client"}
                        </p>
                        <p className="text-[10px] leading-tight truncate opacity-75">
                          {appt.services?.name || "Service"}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Current time indicator */}
              {currentTimeOffset !== null && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${currentTimeOffset}px` }}
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                    <div className="flex-1 h-[2px] bg-destructive" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffCalendar;
