import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Calendar as CalIcon, Loader2, X, RotateCcw, StickyNote, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO, isAfter, subHours } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  salon_id: string;
  service_id: string | null;
  stylist_id: string;
  services: { name: string; price: number } | null;
  profiles: { full_name: string } | null;
  salons: { name: string; cancellation_window_hours: number | null } | null;
}

interface Favorite {
  id: string;
  salon_id: string;
  service_id: string;
  stylist_id: string;
  salon_name?: string;
  service_name?: string;
  stylist_name?: string;
  service_price?: number;
}

import { appointmentStatusColor as statusColor } from "@/lib/status-colors";

const Appointments = () => {
  const { user } = useAuth(false);
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesDialog, setNotesDialog] = useState<Appointment | null>(null);
  const [reviewDialog, setReviewDialog] = useState<Appointment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewedApptIds, setReviewedApptIds] = useState<Set<string>>(new Set());
  const [reviewsByAppt, setReviewsByAppt] = useState<Map<string, number>>(new Map());
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(new Set());

  const favKey = (salonId: string, serviceId: string, stylistId: string) =>
    `${salonId}|${serviceId}|${stylistId}`;

  const fetchAppointments = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("appointments")
      .select("*, services:service_id(name, price), profiles:profiles!appointments_stylist_id_profiles_fkey(full_name), salons:salon_id(name, cancellation_window_hours)")
      .eq("client_id", user.id)
      .order("start_time", { ascending: false })
      .limit(50);
    setAppointments((data as any[]) || []);
    setLoading(false);
  };

  const fetchReviews = async () => {
    if (!user) return;
    const { data } = await supabase.from("reviews").select("appointment_id, rating").eq("client_id", user.id);
    const ids = new Set((data || []).map((r: any) => r.appointment_id));
    const map = new Map((data || []).map((r: any) => [r.appointment_id, r.rating]));
    setReviewedApptIds(ids);
    setReviewsByAppt(map);
  };

  const fetchFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("client_favorites")
      .select("id, salon_id, service_id, stylist_id")
      .eq("user_id", user.id);

    const favs = (data || []) as any[];
    if (favs.length === 0) {
      setFavorites([]);
      setFavoriteKeys(new Set());
      return;
    }

    // Enrich with names
    const salonIds = [...new Set(favs.map(f => f.salon_id))];
    const serviceIds = [...new Set(favs.map(f => f.service_id))];
    const stylistIds = [...new Set(favs.map(f => f.stylist_id))];

    const [salonsRes, servicesRes, profilesRes] = await Promise.all([
      supabase.from("salons").select("id, name").in("id", salonIds),
      supabase.from("services").select("id, name, price").in("id", serviceIds),
      supabase.from("profiles").select("user_id, full_name").in("user_id", stylistIds),
    ]);

    const salonMap = new Map((salonsRes.data || []).map((s: any) => [s.id, s.name]));
    const serviceMap = new Map((servicesRes.data || []).map((s: any) => [s.id, { name: s.name, price: s.price }]));
    const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));

    const enriched: Favorite[] = favs.map(f => ({
      ...f,
      salon_name: salonMap.get(f.salon_id) || "Salon",
      service_name: serviceMap.get(f.service_id)?.name || "Service",
      service_price: serviceMap.get(f.service_id)?.price,
      stylist_name: profileMap.get(f.stylist_id) || "Stylist",
    }));

    setFavorites(enriched);
    setFavoriteKeys(new Set(favs.map((f: any) => favKey(f.salon_id, f.service_id, f.stylist_id))));
  };

  useEffect(() => { fetchAppointments(); fetchReviews(); fetchFavorites(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-appointments")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `client_id=eq.${user.id}` }, () => fetchAppointments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCancel = async (appt: Appointment) => {
    const windowHours = appt.salons?.cancellation_window_hours || 24;
    const cutoff = subHours(parseISO(appt.start_time), windowHours);
    if (isAfter(new Date(), cutoff)) {
      toast.error("Cannot cancel", { description: `Cancellation must be at least ${windowHours} hours before your appointment.` });
      return;
    }
    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      supabase.functions.invoke("send-appointment-email", {
        body: { appointment_id: appt.id, type: "booking_cancelled" },
      }).catch(console.error);
      toast.success("Appointment cancelled");
      fetchAppointments();
    }
  };

  const handleReviewSubmit = async () => {
    if (!user || !reviewDialog) return;
    setReviewSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      client_id: user.id,
      stylist_id: reviewDialog.stylist_id,
      salon_id: reviewDialog.salon_id,
      appointment_id: reviewDialog.id,
      rating: reviewRating,
      comment: reviewComment || null,
    });
    setReviewSubmitting(false);
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      toast.success("Review submitted!", { description: "Thank you for your feedback." });
      setReviewDialog(null);
      setReviewRating(5);
      setReviewComment("");
      fetchReviews();
    }
  };

  const handleRebook = (salonId: string, serviceId: string | null, stylistId: string) => {
    const params = new URLSearchParams();
    params.set("salon_id", salonId);
    if (serviceId) params.set("service_id", serviceId);
    params.set("stylist_id", stylistId);
    navigate(`/dashboard/book?${params.toString()}`);
  };

  const toggleFavorite = async (appt: Appointment) => {
    if (!user || !appt.service_id) return;
    const key = favKey(appt.salon_id, appt.service_id, appt.stylist_id);
    if (favoriteKeys.has(key)) {
      // Remove favorite
      await supabase
        .from("client_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("salon_id", appt.salon_id)
        .eq("service_id", appt.service_id)
        .eq("stylist_id", appt.stylist_id);
      toast.success("Removed from favorites");
    } else {
      // Add favorite
      await supabase.from("client_favorites").insert({
        user_id: user.id,
        salon_id: appt.salon_id,
        service_id: appt.service_id,
        stylist_id: appt.stylist_id,
      });
      toast.success("Added to favorites!", { description: "Quick rebook anytime from your favorites." });
    }
    fetchFavorites();
  };

  const removeFavorite = async (fav: Favorite) => {
    if (!user) return;
    await supabase.from("client_favorites").delete().eq("id", fav.id);
    toast.success("Removed from favorites");
    fetchFavorites();
  };

  const now = new Date();
  const upcoming = appointments.filter((a) => isAfter(parseISO(a.start_time), now) && a.status !== "cancelled");
  const past = appointments.filter((a) => !isAfter(parseISO(a.start_time), now) || a.status === "cancelled");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const renderList = (list: Appointment[], isPast: boolean) =>
    list.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <CalIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No appointments</p>
      </div>
    ) : (
      <div className="space-y-3">
        {list.map((appt) => {
          const isFaved = appt.service_id ? favoriteKeys.has(favKey(appt.salon_id, appt.service_id, appt.stylist_id)) : false;
          return (
            <div key={appt.id} className="glass rounded-xl border-0 flex items-center gap-4 p-4 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{appt.services?.name || "Service"}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(appt.start_time), "MMM d, yyyy 'at' h:mm a")} · {appt.profiles?.full_name || "Stylist"} · {appt.salons?.name || "Salon"}
                </p>
                {appt.services?.price && <p className="text-xs font-medium mt-0.5">${appt.services.price}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className={statusColor[appt.status] || ""}>{appt.status}</Badge>
                {isPast && appt.status === "completed" && appt.notes && (
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setNotesDialog(appt)} title="View stylist notes">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
                {isPast && appt.status === "completed" && !reviewedApptIds.has(appt.id) && (
                  <Button variant="outline" size="sm" className="shrink-0 text-xs rounded-full" onClick={() => { setReviewDialog(appt); setReviewRating(5); setReviewComment(""); }}>
                    <Star className="h-3 w-3 mr-1" /> Review
                  </Button>
                )}
                {isPast && appt.status === "completed" && reviewedApptIds.has(appt.id) && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                    <Star className="h-3 w-3 fill-primary text-primary" /> {reviewsByAppt.get(appt.id)}
                  </Badge>
                )}
                {/* Favorite toggle */}
                {appt.service_id && (appt.status === "completed" || appt.status === "confirmed" || appt.status === "booked") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => toggleFavorite(appt)}
                    title={isFaved ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart className={`h-4 w-4 transition-colors ${isFaved ? "fill-destructive text-destructive" : "text-muted-foreground hover:text-destructive"}`} />
                  </Button>
                )}
                {isPast && (appt.status === "completed" || appt.status === "cancelled") && (
                  <Button variant="outline" size="sm" className="shrink-0 text-xs rounded-full" onClick={() => handleRebook(appt.salon_id, appt.service_id, appt.stylist_id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Rebook
                  </Button>
                )}
                {!isPast && (appt.status === "booked" || appt.status === "confirmed") && (
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => handleCancel(appt)}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">Appointments</h1>
      <p className="text-muted-foreground mb-6 font-normal">Your upcoming and past bookings</p>

      {/* Favorites Quick Rebook */}
      {favorites.length > 0 && (
        <Card className="glass rounded-xl border-0 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 fill-destructive text-destructive" /> Favorite Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favorites.map((fav) => (
                <div key={fav.id} className="flex items-center gap-3 p-3 rounded-lg glass-subtle hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fav.service_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {fav.stylist_name} · {fav.salon_name}
                    </p>
                    {fav.service_price && (
                      <p className="text-xs font-medium text-primary mt-0.5">${fav.service_price}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="text-xs rounded-full bg-gradient-prism text-white"
                      onClick={() => handleRebook(fav.salon_id, fav.service_id, fav.stylist_id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Rebook
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFavorite(fav)}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">{renderList(upcoming, false)}</TabsContent>
        <TabsContent value="past" className="mt-4">{renderList(past, true)}</TabsContent>
      </Tabs>

      {/* Stylist Notes Dialog */}
      <Dialog open={!!notesDialog} onOpenChange={() => setNotesDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stylist Notes</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">
              {notesDialog?.services?.name} — {notesDialog?.start_time ? format(parseISO(notesDialog.start_time), "MMM d, yyyy") : ""}
            </p>
            <p>{notesDialog?.notes}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reviewDialog?.services?.name} with {reviewDialog?.profiles?.full_name || "Stylist"}
            </p>
            <div>
              <p className="text-sm font-medium mb-2">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} onClick={() => setReviewRating(i)} className="focus:outline-none">
                    <Star className={`h-7 w-7 transition-colors ${i <= reviewRating ? "fill-primary text-primary" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Comment (optional)</p>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="How was your experience?"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
              <Button onClick={handleReviewSubmit} disabled={reviewSubmitting}>
                {reviewSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Appointments;
