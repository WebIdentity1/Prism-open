import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Loader2, CheckCircle, XCircle, AlertTriangle, Send, Copy, CreditCard, MoreHorizontal, CircleCheck, Ban, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, parseISO, isAfter, isToday, startOfDay, endOfDay } from "date-fns";
import { AppointmentPhotoUpload } from "@/components/dashboard/AppointmentPhotoUpload";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
interface SalonAppt {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  notes: string | null;
  client_id: string;
  stylist_id: string;
  salon_id: string;
  services: { name: string; price: number } | null;
  client_profile: { full_name: string } | null;
  stylist_profile: { full_name: string } | null;
}

import { appointmentStatusColor as statusColor } from "@/lib/status-colors";

const paymentStatusColor: Record<string, string> = {
  pending: "bg-orange-100 text-orange-700",
  link_sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  "n/a": "",
};

const SalonAppointments = () => {
  const { user } = useAuth(false);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<SalonAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingLink, setSendingLink] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!user) return;
    const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).maybeSingle();
    if (!salon) { setLoading(false); return; }
    setSalonId(salon.id);

    const { data } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, status, payment_status, notes, client_id, stylist_id, salon_id, services:service_id(name, price), client_profile:profiles!appointments_client_id_profiles_fkey(full_name), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name)")
      .eq("salon_id", salon.id)
      .order("start_time", { ascending: false })
      .limit(200);
    setAppointments((data as any[]) || []);
    setLoading(false);
  };

  const sendPaymentLink = async (appointmentId: string) => {
    setSendingLink(appointmentId);
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-link", {
        body: { appointment_id: appointmentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.sms_sent) {
        toast.success(`Payment link sent via SMS to ${data.client_phone}`);
      } else {
        // Copy link to clipboard as fallback
        if (data?.url) {
          await navigator.clipboard.writeText(data.url);
          toast.success("Payment link copied to clipboard (no phone on file)");
        }
      }
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to send payment link");
    } finally {
      setSendingLink(null);
    }
  };

  const copyPaymentLink = async (appointmentId: string) => {
    setSendingLink(appointmentId);
    try {
      const { data, error } = await supabase.functions.invoke("send-payment-link", {
        body: { appointment_id: appointmentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success("Payment link copied to clipboard");
      }
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate payment link");
    } finally {
      setSendingLink(null);
    }
  };

  useEffect(() => { fetchAll(); }, [user]);

  useEffect(() => {
    if (!salonId) return;
    const channel = supabase
      .channel("salon-appts")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `salon_id=eq.${salonId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [salonId]);

  const updateStatus = async (id: string, status: "booked" | "confirmed" | "completed" | "cancelled" | "no_show") => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error("Failed to update status");
    else {
      if (status === "cancelled") {
        supabase.functions.invoke("send-appointment-email", {
          body: { appointment_id: id, type: "booking_cancelled" },
        }).catch(console.error);
      }
      toast.success(`Appointment marked as ${status}`);
      fetchAll();
    }
  };

  const now = new Date();
  const todayAppts = appointments.filter((a) => isToday(parseISO(a.start_time)) && a.status !== "cancelled");
  const upcoming = appointments.filter((a) => isAfter(parseISO(a.start_time), endOfDay(now)) && a.status !== "cancelled");
  const past = appointments.filter((a) => !isAfter(parseISO(a.start_time), startOfDay(now)) || a.status === "cancelled");

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!salonId) return <div className="text-center py-16 text-muted-foreground"><p>Set up your salon first to view appointments.</p></div>;

  const renderRow = (appt: SalonAppt) => (
    <div key={appt.id} className="glass rounded-xl border-0 flex items-center gap-4 p-4 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{appt.client_profile?.full_name || "Unknown Client"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          with {appt.stylist_profile?.full_name || "Unknown"} · {format(parseISO(appt.start_time), "MMM d, yyyy 'at' h:mm a")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {appt.services?.name || "Service"}{appt.services?.price != null ? ` · $${appt.services.price}` : ""}
        </p>
      </div>
      <Badge variant="secondary" className={statusColor[appt.status] || ""}>{appt.status}</Badge>
      {appt.status === "completed" && appt.payment_status && appt.payment_status !== "n/a" && (
        <Badge variant="outline" className={paymentStatusColor[appt.payment_status] || ""}>
          <CreditCard className="h-3 w-3 mr-1" />
          {appt.payment_status === "paid" ? "Paid" : appt.payment_status === "link_sent" ? "Link Sent" : "Unpaid"}
        </Badge>
      )}
      {appt.status === "completed" && (
        <AppointmentPhotoUpload
          appointmentId={appt.id}
          clientId={appt.client_id}
          stylistId={appt.stylist_id}
          salonId={appt.salon_id}
        />
      )}
      {/* Payment link buttons for completed + unpaid */}
      {appt.status === "completed" && appt.payment_status !== "paid" && (
        <TooltipProvider>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => sendPaymentLink(appt.id)}
                  disabled={sendingLink === appt.id}
                >
                  <Send className="h-4 w-4 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send payment link via SMS (supports Apple Pay)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyPaymentLink(appt.id)}
                  disabled={sendingLink === appt.id}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy payment link</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      )}
      {/* Primary action: the most likely next step for this status */}
      {appt.status === "booked" && (
        <Button variant="outline" size="sm" onClick={() => updateStatus(appt.id, "confirmed")} className="gap-1.5">
          <CircleCheck className="h-3.5 w-3.5" /> Confirm
        </Button>
      )}
      {appt.status === "confirmed" && (
        <Button variant="outline" size="sm" onClick={() => updateStatus(appt.id, "completed")} className="gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" /> Complete
        </Button>
      )}
      {/* Secondary actions in dropdown -- with confirmation for destructive ones */}
      {(appt.status === "booked" || appt.status === "confirmed") && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {appt.status === "booked" && (
              <DropdownMenuItem onClick={() => updateStatus(appt.id, "completed")}>
                <CheckCircle className="h-4 w-4 mr-2" /> Mark Complete
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-amber-600">
                  <UserX className="h-4 w-4 mr-2" /> No Show
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark as no show?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark {appt.client_profile?.full_name || "the client"}'s appointment as a no-show. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateStatus(appt.id, "no_show")} className="bg-amber-600 hover:bg-amber-700">
                    Mark No Show
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                  <Ban className="h-4 w-4 mr-2" /> Cancel Appointment
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {appt.client_profile?.full_name || "The client"} will be notified by email that their {appt.services?.name || "appointment"} has been cancelled.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                  <AlertDialogAction onClick={() => updateStatus(appt.id, "cancelled")} className="bg-destructive hover:bg-destructive/90">
                    Cancel Appointment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const renderList = (list: SalonAppt[]) =>
    list.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No appointments</p>
      </div>
    ) : (
      <div className="space-y-3">{list.map(renderRow)}</div>
    );

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">Salon Appointments</h1>
      <p className="text-muted-foreground mb-6 font-normal">Manage all bookings at your salon</p>

      <Tabs defaultValue="today">
        <TabsList className="glass-subtle rounded-full">
          <TabsTrigger value="today" className="rounded-full">Today ({todayAppts.length})</TabsTrigger>
          <TabsTrigger value="upcoming" className="rounded-full">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past" className="rounded-full">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">{renderList(todayAppts)}</TabsContent>
        <TabsContent value="upcoming" className="mt-4">{renderList(upcoming)}</TabsContent>
        <TabsContent value="past" className="mt-4">{renderList(past)}</TabsContent>
      </Tabs>
    </div>
  );
};

export default SalonAppointments;
