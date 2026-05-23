import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Clock, Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { AppointmentPhotoUpload } from "@/components/dashboard/AppointmentPhotoUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO, startOfWeek, addDays, addWeeks, subWeeks, isWithinInterval, setHours, setMinutes, isSameDay } from "date-fns";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS_LIST = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const min = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${min}`;
});

const CALENDAR_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  client_id: string;
  salon_id: string;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
}

const statusColor: Record<string, string> = {
  booked: "bg-primary/20 border-primary text-primary",
  confirmed: "bg-accent/50 border-accent text-accent-foreground",
  completed: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400",
  cancelled: "bg-muted border-muted text-muted-foreground",
  no_show: "bg-destructive/10 border-destructive/30 text-destructive",
};

const Schedule = () => {
  const { user } = useAuth(false);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const fetchData = async () => {
    if (!user) return;
    const weekEnd = addDays(weekStart, 7);
    const [avail, appts] = await Promise.all([
      supabase.from("stylist_availability").select("*").eq("stylist_id", user.id).order("day_of_week"),
      supabase.from("appointments").select("id, start_time, end_time, status, notes, client_id, salon_id, services:service_id(name), profiles:profiles!appointments_client_id_profiles_fkey(full_name)")
        .eq("stylist_id", user.id)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .in("status", ["booked", "confirmed", "completed"])
        .order("start_time"),
    ]);
    setAvailability((avail.data as AvailabilitySlot[]) || []);
    setAppointments((appts.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, weekStart]);

  const addSlot = async (dayOfWeek: number) => {
    if (!user) return;
    const { error } = await supabase.from("stylist_availability").insert({
      stylist_id: user.id,
      day_of_week: dayOfWeek,
      start_time: newStart,
      end_time: newEnd,
    });
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      toast.success("Availability added");
      setAddingDay(null);
      fetchData();
    }
  };

  const removeSlot = async (id: string) => {
    await supabase.from("stylist_availability").delete().eq("id", id);
    toast.success("Slot removed");
    fetchData();
  };

  // Get appointments for a specific day and hour
  const getAppointmentsForSlot = (dayDate: Date, hour: number) => {
    return appointments.filter((appt) => {
      const start = parseISO(appt.start_time);
      const end = parseISO(appt.end_time);
      const slotStart = setMinutes(setHours(dayDate, hour), 0);
      const slotEnd = setMinutes(setHours(dayDate, hour + 1), 0);
      return start < slotEnd && end > slotStart && isSameDay(start, dayDate);
    });
  };

  // Check if a time slot falls within availability
  const isAvailableSlot = (dayOfWeek: number, hour: number) => {
    return availability.some((slot) => {
      const [sh] = slot.start_time.split(":").map(Number);
      const [eh] = slot.end_time.split(":").map(Number);
      return slot.day_of_week === dayOfWeek && hour >= sh && hour < eh;
    });
  };

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">My Schedule</h1>
      <p className="text-muted-foreground mb-6 font-normal">Set your weekly availability and view appointments</p>

      <Tabs defaultValue="calendar">
        <TabsList className="mb-4 glass-subtle rounded-full">
          <TabsTrigger value="calendar" className="rounded-full">Calendar View</TabsTrigger>
          <TabsTrigger value="availability" className="rounded-full">Availability</TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar">
          <Card className="glass rounded-xl border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Weekly Calendar
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[160px] text-center">
                    {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}>
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Header row */}
                <div className="grid grid-cols-8 border-b border-border">
                  <div className="p-2 text-xs text-muted-foreground" />
                  {weekDays.map((day, i) => (
                    <div key={i} className={`p-2 text-center border-l border-border ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}>
                      <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                      <p className={`text-sm font-medium ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>{format(day, "d")}</p>
                    </div>
                  ))}
                </div>
                {/* Time grid */}
                {CALENDAR_HOURS.map((hour) => (
                  <div key={hour} className="grid grid-cols-8 border-b border-border/50 min-h-[48px]">
                    <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 pt-1">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                    </div>
                    {weekDays.map((day, i) => {
                      const dayAppts = getAppointmentsForSlot(day, hour);
                      const available = isAvailableSlot(day.getDay(), hour);
                      return (
                        <div
                          key={i}
                          className={`border-l border-border/50 p-0.5 ${available ? "bg-primary/5" : ""} ${isSameDay(day, new Date()) ? "bg-primary/[0.02]" : ""} hover:bg-primary/[0.04] transition-colors`}
                        >
                          {dayAppts.map((appt) => {
                            const start = parseISO(appt.start_time);
                            // Only render at the start hour
                            if (start.getHours() !== hour) return null;
                            return (
                              <div
                                key={appt.id}
                                className={`rounded px-1.5 py-0.5 text-[10px] leading-tight border ${statusColor[appt.status] || "bg-muted border-border"}`}
                              >
                                <p className="font-medium truncate">{appt.profiles?.full_name || "Client"}</p>
                                <p className="truncate opacity-75">{appt.services?.name}</p>
                                {appt.status === "completed" && (
                                  <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                                    <AppointmentPhotoUpload
                                      appointmentId={appt.id}
                                      clientId={appt.client_id}
                                      stylistId={user!.id}
                                      salonId={appt.salon_id}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <Card className="glass rounded-xl border-0">
            <CardHeader>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Weekly Availability
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {DAYS.map((day, idx) => {
                const slots = availability.filter((s) => s.day_of_week === idx);
                return (
                  <div key={idx} className="border-b border-border pb-3 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{day}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setAddingDay(addingDay === idx ? null : idx); setNewStart("09:00"); setNewEnd("17:00"); }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {slots.length === 0 && <p className="text-xs text-muted-foreground">No availability set</p>}
                    {slots.map((slot) => (
                      <div key={slot.id} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSlot(slot.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {addingDay === idx && (
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={newStart} onValueChange={setNewStart}>
                          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{HOURS_LIST.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">to</span>
                        <Select value={newEnd} onValueChange={setNewEnd}>
                          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{HOURS_LIST.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" onClick={() => addSlot(idx)}>Save</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Schedule;
