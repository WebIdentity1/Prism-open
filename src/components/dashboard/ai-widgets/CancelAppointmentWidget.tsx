import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Check } from "lucide-react";
import { format } from "date-fns";

interface CancelAppointmentWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

type Appointment = {
  id: string;
  start_time: string;
  client_name: string;
  stylist_name: string;
  service_name: string;
  status: string;
};

export function CancelAppointmentWidget({ salonId, context, onComplete }: CancelAppointmentWidgetProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from("appointments")
        .select("id, start_time, end_time, status, client_id, stylist_id, service_id, services(name)")
        .eq("salon_id", salonId)
        .in("status", ["booked", "confirmed"])
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(10);

      const { data } = await query;

      const enriched: Appointment[] = [];
      for (const appt of data || []) {
        const [{ data: cp }, { data: sp }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", appt.client_id).single(),
          supabase.from("profiles").select("full_name").eq("user_id", appt.stylist_id).single(),
        ]);

        const clientName = cp?.full_name || "Unknown";

        // Filter by client name if provided in context
        if (context.client_name && !clientName.toLowerCase().includes(context.client_name.toLowerCase())) {
          continue;
        }

        enriched.push({
          id: appt.id,
          start_time: appt.start_time,
          client_name: clientName,
          stylist_name: sp?.full_name || "Unknown",
          service_name: (appt.services as any)?.name || "N/A",
          status: appt.status,
        });
      }

      setAppointments(enriched);
      setLoading(false);
    };
    load();
  }, [salonId, context.client_name]);

  const handleCancel = async (appt: Appointment) => {
    setCancelling(appt.id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appt.id);

    setCancelling(null);
    if (error) {
      onComplete(`❌ Failed to cancel: ${error.message}`);
    } else {
      setCancelled((prev) => new Set(prev).add(appt.id));
      onComplete(`✅ Cancelled ${appt.client_name}'s ${appt.service_name} on ${format(new Date(appt.start_time), "EEE MMM d 'at' h:mm a")}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading appointments...
      </div>
    );
  }

  if (appointments.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No upcoming appointments found{context.client_name ? ` for "${context.client_name}"` : ""}.</p>;
  }

  return (
    <div className="space-y-2 pt-2 glass rounded-xl p-3">
      {appointments.map((appt) => (
        <div key={appt.id} className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/40 bg-background/50">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{appt.client_name}</p>
            <p className="text-xs text-muted-foreground">
              {appt.service_name} w/ {appt.stylist_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(appt.start_time), "EEE MMM d, h:mm a")}
            </p>
          </div>
          {cancelled.has(appt.id) ? (
            <span className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3 w-3" /> Done</span>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs shrink-0 rounded-full"
              disabled={cancelling === appt.id}
              onClick={() => handleCancel(appt)}
            >
              {cancelling === appt.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="h-3 w-3 mr-1" /> Cancel</>}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
