import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Check, Loader2 } from "lucide-react";
import { format, startOfDay, addDays } from "date-fns";

interface BlockTimeWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = (i % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

export function BlockTimeWidget({ salonId, context, onComplete }: BlockTimeWidgetProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    context.date_hint ? new Date(context.date_hint) : addDays(new Date(), 1)
  );
  const [startTime, setStartTime] = useState(context.start_time || "");
  const [endTime, setEndTime] = useState(context.end_time || "");
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const handleBlock = async () => {
    if (!selectedDate || !startTime || !endTime) return;
    setBlocking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { onComplete("❌ Not authenticated"); setBlocking(false); return; }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(eh, em, 0, 0);

    // Use context.stylist_id if provided (for admin blocking another stylist's time), else current user
    const stylistId = context.stylist_id || user.id;

    // Create a "blocked" appointment with the stylist as both client and stylist
    const { error } = await supabase.from("appointments").insert({
      client_id: stylistId,
      stylist_id: stylistId,
      salon_id: salonId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "booked",
      notes: "⛔ Blocked time",
    });

    setBlocking(false);
    if (error) {
      onComplete(`❌ Failed to block time: ${error.message}`);
    } else {
      setBlocked(true);
      onComplete(`✅ Time blocked on ${format(selectedDate, "EEE MMM d")} from ${startTime} to ${endTime}`);
    }
  };

  if (blocked) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-green-600">
        <Check className="h-4 w-4" /> Time blocked!
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 glass rounded-xl p-3">
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

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Start" /></SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="End" /></SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.filter((t) => t > startTime).map((t) => (
                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleBlock}
        disabled={!selectedDate || !startTime || !endTime || blocking}
        className="w-full h-8 text-xs"
        size="sm"
      >
        {blocking ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Blocking...</> : "Block Time Off"}
      </Button>
    </div>
  );
}
