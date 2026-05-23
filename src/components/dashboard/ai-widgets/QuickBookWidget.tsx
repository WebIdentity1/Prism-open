import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Check, Loader2 } from "lucide-react";
import { format, addMinutes, parseISO, startOfDay, addDays } from "date-fns";

interface QuickBookWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

type Client = { user_id: string; full_name: string };
type Service = { id: string; name: string; price: number; duration_minutes: number };
type Stylist = { user_id: string; full_name: string };

export function QuickBookWidget({ salonId, context, onComplete }: QuickBookWidgetProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [clientSearch, setClientSearch] = useState(context.client_name || "");
  const [selectedClient, setSelectedClient] = useState<string>(context.client_id || "");
  const [selectedService, setSelectedService] = useState("");
  const [selectedStylist, setSelectedStylist] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    if (!context.date_hint) return addDays(new Date(), 1);
    try {
      const parsed = parseISO(context.date_hint);
      return isNaN(parsed.getTime()) ? addDays(new Date(), 1) : parsed;
    } catch {
      return addDays(new Date(), 1);
    }
  });
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  // Load data
  useEffect(() => {
    const load = async () => {
      const [{ data: svcData }, { data: spData }] = await Promise.all([
        supabase.from("services").select("id, name, price, duration_minutes").eq("salon_id", salonId).eq("is_active", true),
        supabase.from("stylist_profiles").select("user_id").eq("salon_id", salonId),
      ]);
      setServices(svcData || []);

      if (spData) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", spData.map((s) => s.user_id));
        setStylists((profiles || []).filter((p) => p.full_name) as Stylist[]);
      }

      // Auto-select service if hint provided
      if (context.service_hint && svcData) {
        const hint = context.service_hint.toLowerCase();
        const match = svcData.find((s: any) => s.name.toLowerCase().includes(hint));
        if (match) setSelectedService(match.id);
      }
    };
    load();
  }, [salonId, context.service_hint]);

  // Search clients (salon-scoped: only clients who have appointments at this salon)
  useEffect(() => {
    if (clientSearch.length < 2) { setClients([]); return; }
    const timer = setTimeout(async () => {
      // Get distinct client IDs from this salon's appointments
      const { data: appts } = await supabase
        .from("appointments")
        .select("client_id")
        .eq("salon_id", salonId);
      const clientIds = [...new Set((appts || []).map((a) => a.client_id))];
      if (clientIds.length === 0) { setClients([]); return; }

      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${clientSearch}%`)
        .in("user_id", clientIds)
        .limit(5);
      setClients((data || []).filter((p) => p.full_name) as Client[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, salonId]);

  // Generate time slots when date + stylist + service selected
  useEffect(() => {
    if (!selectedDate || !selectedStylist || !selectedService) { setAvailableSlots([]); return; }
    const svc = services.find((s) => s.id === selectedService);
    if (!svc) return;

    const generateSlots = async () => {
      const dayStart = startOfDay(selectedDate);
      const dayOfWeek = selectedDate.getDay();

      const { data: avail } = await supabase
        .from("stylist_availability")
        .select("start_time, end_time")
        .eq("stylist_id", selectedStylist)
        .eq("day_of_week", dayOfWeek);

      if (!avail || avail.length === 0) { setAvailableSlots([]); return; }

      const { data: existingAppts } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("stylist_id", selectedStylist)
        .gte("start_time", dayStart.toISOString())
        .lt("start_time", addDays(dayStart, 1).toISOString())
        .in("status", ["booked", "confirmed"]);

      const slots: string[] = [];
      for (const block of avail) {
        const [startH, startM] = block.start_time.split(":").map(Number);
        const [endH, endM] = block.end_time.split(":").map(Number);
        const blockStart = new Date(dayStart);
        blockStart.setHours(startH, startM, 0);
        const blockEnd = new Date(dayStart);
        blockEnd.setHours(endH, endM, 0);

        let cursor = new Date(blockStart);
        while (addMinutes(cursor, svc.duration_minutes) <= blockEnd) {
          const slotEnd = addMinutes(cursor, svc.duration_minutes);
          const conflict = (existingAppts || []).some((a: any) => {
            const aStart = new Date(a.start_time);
            const aEnd = new Date(a.end_time);
            return cursor < aEnd && slotEnd > aStart;
          });
          if (!conflict) {
            slots.push(format(cursor, "HH:mm"));
          }
          cursor = addMinutes(cursor, 30);
        }
      }
      setAvailableSlots(slots);
    };
    generateSlots();
  }, [selectedDate, selectedStylist, selectedService, services]);

  const handleBook = async () => {
    if (!selectedClient || !selectedService || !selectedStylist || !selectedDate || !selectedTime) return;
    setBooking(true);

    const svc = services.find((s) => s.id === selectedService);
    const [h, m] = selectedTime.split(":").map(Number);
    const startTime = new Date(selectedDate);
    startTime.setHours(h, m, 0, 0);
    const endTime = addMinutes(startTime, svc?.duration_minutes || 60);

    const { error } = await supabase.from("appointments").insert({
      client_id: selectedClient,
      stylist_id: selectedStylist,
      salon_id: salonId,
      service_id: selectedService,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "booked",
      payment_status: "pending",
    });

    setBooking(false);
    if (error) {
      onComplete(`❌ Booking failed: ${error.message}`);
    } else {
      setBooked(true);
      const clientName = clients.find((c) => c.user_id === selectedClient)?.full_name || "Client";
      const stylistName = stylists.find((s) => s.user_id === selectedStylist)?.full_name || "Stylist";
      onComplete(`✅ **Booked!** ${clientName} — ${svc?.name} with ${stylistName}, ${format(startTime, "EEEE MMM d 'at' h:mm a")}`);
    }
  };

  if (booked) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-green-600">
        <Check className="h-4 w-4" /> Appointment booked!
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 glass rounded-xl p-3">
      {/* Client search */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Client</label>
        {selectedClient ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">{clients.find((c) => c.user_id === selectedClient)?.full_name || clientSearch}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSelectedClient(""); setClientSearch(""); }}>
              Change
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Search client name..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="h-8 text-xs"
            />
            {clients.length > 0 && !selectedClient && (
              <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md">
                {clients.map((c) => (
                  <button
                    key={c.user_id}
                    onClick={() => { setSelectedClient(c.user_id); setClientSearch(c.full_name); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {c.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Service */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Service</label>
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select service" /></SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name} — ${s.price} ({s.duration_minutes}min)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stylist */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Stylist</label>
        <Select value={selectedStylist} onValueChange={setSelectedStylist}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select stylist" /></SelectTrigger>
          <SelectContent>
            {stylists.map((s) => (
              <SelectItem key={s.user_id} value={s.user_id} className="text-xs">{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full h-8 text-xs justify-start font-normal">
              <CalendarIcon className="mr-2 h-3 w-3" />
              {selectedDate ? format(selectedDate, "EEE, MMM d") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} disabled={(d) => d < startOfDay(new Date())} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Time slots */}
      {availableSlots.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Time</label>
          <div className="grid grid-cols-4 gap-1">
            {availableSlots.slice(0, 12).map((slot) => (
              <Button
                key={slot}
                variant={selectedTime === slot ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-1"
                onClick={() => setSelectedTime(slot)}
              >
                {slot}
              </Button>
            ))}
          </div>
          {availableSlots.length > 12 && (
            <p className="text-xs text-muted-foreground">+{availableSlots.length - 12} more slots</p>
          )}
        </div>
      )}

      {selectedStylist && selectedService && selectedDate && availableSlots.length === 0 && (
        <p className="text-xs text-muted-foreground">No available slots for this date/stylist combination.</p>
      )}

      {/* Confirm */}
      <Button
        onClick={handleBook}
        disabled={!selectedClient || !selectedService || !selectedStylist || !selectedDate || !selectedTime || booking}
        className="w-full h-8 text-xs bg-gradient-champagne rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"
        size="sm"
      >
        {booking ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Booking...</> : "Confirm Booking"}
      </Button>
    </div>
  );
}
