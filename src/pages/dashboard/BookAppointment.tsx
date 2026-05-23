import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Calendar as CalIcon, ChevronRight, ChevronLeft, Loader2, MapPin, Scissors, User, Clock, Star, Search, Phone, UserPlus, FileText, CheckCircle2, MessageSquare, Copy, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format, addMinutes, parseISO, isSameDay, setHours, setMinutes, isAfter, startOfDay } from "date-fns";
import { getAdjustedPrice, type SurgeRule, type OffpeakRule } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Step = "client" | "salon" | "service" | "stylist" | "datetime" | "forms" | "confirm";

interface Salon { id: string; name: string; city: string | null; address: string | null; }
interface Service { id: string; name: string; price: number; duration_minutes: number; category: string | null; }
interface Stylist { id: string; user_id: string; full_name: string | null; specialties: string[] | null; level_id: string | null; }
interface AvailSlot { day_of_week: number; start_time: string; end_time: string; }
interface LevelPrice { service_id: string; level_id: string; price: number; }
interface ClientOption { user_id: string; full_name: string | null; phone: string | null; }
interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "number" | "date" | "email" | "phone";
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}
interface BookingForm {
  id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  alreadyCompleted: boolean;
}

// Small component for stylist avg rating in booking
const StylistRating = ({ stylistId }: { stylistId: string }) => {
  const [avg, setAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    supabase.from("reviews").select("rating").eq("stylist_id", stylistId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const total = data.reduce((s: number, r: any) => s + r.rating, 0);
          setAvg(Math.round((total / data.length) * 10) / 10);
          setCount(data.length);
        }
      });
  }, [stylistId]);
  if (avg === null) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
      <span className="font-medium">{avg}</span>
      <span>({count})</span>
    </div>
  );
};

const BookAppointment = () => {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isStaff = role === "salon_admin" || role === "stylist";
  const [step, setStep] = useState<Step>("salon");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const [salons, setSalons] = useState<Salon[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [availability, setAvailability] = useState<AvailSlot[]>([]);
  const [existingAppts, setExistingAppts] = useState<{ start_time: string; end_time: string }[]>([]);
  const [levelPrices, setLevelPrices] = useState<LevelPrice[]>([]);

  // Staff booking: client selection
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStylist, setSelectedStylist] = useState<Stylist | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");

  // Booking forms
  const [requireBookingForms, setRequireBookingForms] = useState(false);
  const [bookingForms, setBookingForms] = useState<BookingForm[]>([]);
  const [formResponses, setFormResponses] = useState<Record<string, Record<string, any>>>({});
  const [formsCompleted, setFormsCompleted] = useState<Set<string>>(new Set());

  // SMS onboarding link — staff must attest the client has given consent
  // (in person, by phone, or previously via the public check-in form) before
  // any SMS goes out. This is the salon's record for Twilio TFV / TCPA.
  const [sendOnboardingSms, setSendOnboardingSms] = useState(false);
  const [smsConsentAttested, setSmsConsentAttested] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);

  // Loyalty / point redemption
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [pointValueCents, setPointValueCents] = useState(1);
  const [clientPoints, setClientPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Dynamically compute steps
  const hasFormStep = requireBookingForms && bookingForms.some(f => !f.alreadyCompleted);
  const BASE_CLIENT_STEPS: Step[] = ["salon", "service", "stylist", "datetime"];
  const BASE_STAFF_STEPS: Step[] = ["client", "salon", "service", "stylist", "datetime"];
  const STEPS: Step[] = [
    ...(isStaff ? BASE_STAFF_STEPS : BASE_CLIENT_STEPS),
    ...(hasFormStep ? ["forms" as Step] : []),
    "confirm",
  ];

  // When role resolves to staff, ensure we start at the client selection step
  useEffect(() => {
    if (isStaff && !selectedClient) {
      setStep("client");
    }
  }, [isStaff]);

  // The user ID to book for — either the selected client or the logged-in user
  const bookingClientId = isStaff && selectedClient ? selectedClient.user_id : user?.id;

  const salonParam = searchParams.get("salon") || searchParams.get("salon_id");
  const consultationParam = searchParams.get("consultation");

  // Fetch clients for staff booking
  useEffect(() => {
    if (!isStaff || !user) return;
    // For salon admins, get salon then clients; for stylists, get salon from stylist profile
    const fetchClients = async () => {
      let salonId: string | null = null;
      if (role === "salon_admin") {
        const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).maybeSingle();
        salonId = salon?.id || null;
      } else {
        const { data: sp } = await supabase.from("stylist_profiles").select("salon_id").eq("user_id", user.id).maybeSingle();
        salonId = sp?.salon_id || null;
      }
      if (!salonId) return;
      // Get client IDs from appointments at this salon
      const { data: appts } = await supabase.from("appointments").select("client_id").eq("salon_id", salonId);
      const uniqueClientIds = [...new Set((appts || []).map(a => a.client_id))];
      if (uniqueClientIds.length === 0) {
        // Also get all client-role users as fallback
        const { data: allProfiles } = await supabase.from("profiles").select("user_id, full_name, phone");
        setClients((allProfiles || []).map(p => ({ user_id: p.user_id, full_name: p.full_name, phone: p.phone })));
        return;
      }
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", uniqueClientIds);
      // Also fetch all profiles so we can book for anyone
      const { data: allProfiles } = await supabase.from("profiles").select("user_id, full_name, phone");
      const clientSet = new Set(uniqueClientIds);
      const sorted = (allProfiles || [])
        .map(p => ({ user_id: p.user_id, full_name: p.full_name, phone: p.phone }))
        .sort((a, b) => {
          const aKnown = clientSet.has(a.user_id) ? 0 : 1;
          const bKnown = clientSet.has(b.user_id) ? 0 : 1;
          return aKnown - bKnown;
        });
      setClients(sorted);
    };
    fetchClients();
  }, [isStaff, user, role]);

  // Fetch salons on mount — admins only see their own salon
  useEffect(() => {
    const query = role === "salon_admin" && user
      ? supabase.from("salons").select("id, name, city, address").eq("owner_id", user.id)
      : supabase.from("salons").select("id, name, city, address");
    query.then(({ data }) => {
      setSalons(data || []);
      // Auto-select from query params
      const targetSalonId = salonParam;
      if (targetSalonId && data) {
        const match = data.find((s: Salon) => s.id === targetSalonId);
        if (match) {
          setSelectedSalon(match);
          // Only skip to service step for clients — staff still need the client step first
          if (!isStaff) {
            setStep("service");
          }
        }
      }
      // For staff, auto-select their salon
      if (isStaff && !salonParam && data && data.length > 0) {
        if (data.length === 1) {
          setSelectedSalon(data[0]);
        }
      }
    });
  }, []);

  // Fetch services when salon selected
  useEffect(() => {
    if (!selectedSalon) return;
    setLoading(true);
    supabase.from("services").select("*").eq("salon_id", selectedSalon.id).eq("is_active", true)
      .then(({ data }) => {
        setServices(data || []);
        const rebookServiceId = searchParams.get("service_id");
        if (rebookServiceId && data) {
          const match = data.find((s: Service) => s.id === rebookServiceId);
          if (match) setSelectedService(match);
        }
        setLoading(false);
      });
  }, [selectedSalon]);

  // Fetch stylists and level prices when salon selected
  useEffect(() => {
    if (!selectedSalon) return;
    setLoading(true);
    Promise.all([
      supabase.from("stylist_profiles").select("id, user_id, specialties, level_id")
        .eq("salon_id", selectedSalon.id),
      supabase.from("service_level_prices").select("service_id, level_id, price"),
    ]).then(async ([stylistRes, pricesRes]) => {
      const stylistData = stylistRes.data || [];
      let profileMap = new Map<string, string>();
      if (stylistData.length > 0) {
        const userIds = stylistData.map((s: any) => s.user_id);
        const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p.full_name]));
      }
      const mapped = stylistData.map((s: any) => ({
        id: s.id, user_id: s.user_id,
        full_name: profileMap.get(s.user_id) || "Stylist",
        specialties: s.specialties,
        level_id: s.level_id,
      }));
      setStylists(mapped);
      setLevelPrices((pricesRes.data as LevelPrice[]) || []);
      const rebookStylistId = searchParams.get("stylist_id");
      if (rebookStylistId && mapped.length) {
        const match = mapped.find((s: Stylist) => s.user_id === rebookStylistId);
        if (match) setSelectedStylist(match);
      }
      setLoading(false);
    });
  }, [selectedSalon]);

  // Fetch availability & existing appointments when stylist selected
  useEffect(() => {
    if (!selectedStylist) return;
    setLoading(true);
    Promise.all([
      supabase.from("stylist_availability").select("day_of_week, start_time, end_time").eq("stylist_id", selectedStylist.user_id),
      supabase.from("appointments").select("start_time, end_time")
        .eq("stylist_id", selectedStylist.user_id)
        .in("status", ["booked", "confirmed"])
        .gte("start_time", new Date().toISOString()),
    ]).then(([avail, appts]) => {
      setAvailability((avail.data as AvailSlot[]) || []);
      setExistingAppts(appts.data || []);
      setLoading(false);
    });
  }, [selectedStylist]);

  const stepIndex = STEPS.indexOf(step);

  const goNext = () => { if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]); };
  const goBack = () => { if (stepIndex > 0) setStep(STEPS[stepIndex - 1]); };

  // Compute available time slots for selected date
  const getTimeSlots = (): string[] => {
    if (!selectedDate || !selectedService) return [];
    const dow = selectedDate.getDay();
    const daySlots = availability.filter((a) => a.day_of_week === dow);
    const slots: string[] = [];
    const duration = selectedService.duration_minutes;

    for (const ds of daySlots) {
      const [sh, sm] = ds.start_time.split(":").map(Number);
      const [eh, em] = ds.end_time.split(":").map(Number);
      let current = setMinutes(setHours(selectedDate, sh), sm);
      const end = setMinutes(setHours(selectedDate, eh), em);

      while (isAfter(end, addMinutes(current, duration)) || end.getTime() === addMinutes(current, duration).getTime()) {
        const slotStart = current;
        const slotEnd = addMinutes(current, duration);
        // Check no overlap with existing appointments
        const conflict = existingAppts.some((a) => {
          const as = parseISO(a.start_time);
          const ae = parseISO(a.end_time);
          return slotStart < ae && slotEnd > as;
        });
        if (!conflict && isAfter(slotStart, new Date())) {
          slots.push(format(slotStart, "HH:mm"));
        }
        current = addMinutes(current, 30);
      }
    }
    return slots;
  };

  // Determine which dates have availability
  const isDateAvailable = (date: Date) => {
    if (date < startOfDay(new Date())) return false;
    const dow = date.getDay();
    return availability.some((a) => a.day_of_week === dow);
  };

  const [depositPercentage, setDepositPercentage] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<"none" | "deposit" | "full">("none");

  // Dynamic pricing state
  const [surgeEnabled, setSurgeEnabled] = useState(false);
  const [surgeRules, setSurgeRules] = useState<SurgeRule[]>([]);
  const [offpeakEnabled, setOffpeakEnabled] = useState(false);
  const [offpeakRules, setOffpeakRules] = useState<OffpeakRule[]>([]);

  // Fetch payment settings, booking forms, pricing rules, and loyalty config when salon selected
  useEffect(() => {
    if (!selectedSalon) return;
    supabase.from("salons").select("deposit_percentage, payment_collection_mode, require_booking_forms, surge_pricing_enabled, surge_pricing_rules, offpeak_discounts_enabled, offpeak_discount_rules, loyalty_enabled, loyalty_point_value_cents").eq("id", selectedSalon.id).single()
      .then(({ data }) => {
        setDepositPercentage(data?.deposit_percentage ?? null);
        setPaymentMode(((data as any)?.payment_collection_mode as any) || "none");
        setRequireBookingForms((data as any)?.require_booking_forms ?? false);
        setSurgeEnabled((data as any)?.surge_pricing_enabled ?? false);
        setSurgeRules(Array.isArray((data as any)?.surge_pricing_rules) ? (data as any).surge_pricing_rules : []);
        setOffpeakEnabled((data as any)?.offpeak_discounts_enabled ?? false);
        setOffpeakRules(Array.isArray((data as any)?.offpeak_discount_rules) ? (data as any).offpeak_discount_rules : []);
        setLoyaltyEnabled((data as any)?.loyalty_enabled ?? false);
        setPointValueCents((data as any)?.loyalty_point_value_cents ?? 1);
      });
  }, [selectedSalon]);

  // Fetch client's loyalty point balance
  useEffect(() => {
    if (!selectedSalon || !bookingClientId || !loyaltyEnabled) {
      setClientPoints(0);
      setRedeemPoints(false);
      setPointsToRedeem(0);
      return;
    }
    supabase.from("loyalty_points").select("points").eq("client_id", bookingClientId).eq("salon_id", selectedSalon.id)
      .then(({ data }) => {
        const total = (data || []).reduce((s: number, r: any) => s + r.points, 0);
        setClientPoints(total);
      });
  }, [selectedSalon, bookingClientId, loyaltyEnabled]);

  // Fetch forms linked to the selected service
  useEffect(() => {
    if (!selectedService || !requireBookingForms || !selectedSalon) {
      setBookingForms([]);
      return;
    }
    const fetchForms = async () => {
      // Get form IDs linked to this service
      const { data: links } = await supabase
        .from("service_forms")
        .select("form_id")
        .eq("service_id", selectedService.id);
      if (!links || links.length === 0) { setBookingForms([]); return; }

      const formIds = links.map(l => l.form_id);
      const { data: formsData } = await supabase
        .from("forms")
        .select("id, title, description, fields")
        .in("id", formIds)
        .eq("is_active", true);
      if (!formsData || formsData.length === 0) { setBookingForms([]); return; }

      // Check which forms the client already completed
      const clientId = bookingClientId;
      let completedFormIds = new Set<string>();
      if (clientId) {
        const { data: subs } = await supabase
          .from("form_submissions")
          .select("form_id")
          .eq("client_id", clientId)
          .in("form_id", formIds);
        completedFormIds = new Set((subs || []).map(s => s.form_id));
      }

      setBookingForms(formsData.map((f: any) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        fields: f.fields as unknown as FormField[],
        alreadyCompleted: completedFormIds.has(f.id),
      })));
      setFormResponses({});
      setFormsCompleted(new Set());
    };
    fetchForms();
  }, [selectedService, requireBookingForms, selectedSalon, bookingClientId]);

  const handleConfirm = async () => {
    if (!user || !bookingClientId || !selectedSalon || !selectedService || !selectedStylist || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    const [h, m] = selectedTime.split(":").map(Number);
    const startTime = setMinutes(setHours(selectedDate, h), m);
    const endTime = addMinutes(startTime, selectedService.duration_minutes);

    const basePrice = getEffectivePrice(selectedService);
    const priceAdj = getAdjustedPrice(basePrice, surgeEnabled, surgeRules, offpeakEnabled, offpeakRules, selectedDate, selectedTime);
    const effectivePrice = priceAdj.finalPrice;

    // Apply loyalty point redemption
    const redeemDiscount = redeemPoints ? (pointsToRedeem * pointValueCents) / 100 : 0;
    const priceAfterRedeem = Math.max(0, effectivePrice - redeemDiscount);

    // Determine charge amount based on payment mode
    let chargeAmountCents = 0;
    let productName = "";
    let savePaymentMethod = false;

    if (paymentMode === "deposit" && depositPercentage && depositPercentage > 0) {
      chargeAmountCents = Math.round(priceAfterRedeem * depositPercentage / 100 * 100);
      productName = `Deposit: ${selectedService.name} with ${selectedStylist.full_name}`;
    } else if (paymentMode === "full") {
      chargeAmountCents = Math.round(priceAfterRedeem * 100);
      productName = `${selectedService.name} with ${selectedStylist.full_name}`;
      savePaymentMethod = true;
    }

    // If payment required and not staff booking, create appointment first then redirect to Stripe checkout
    if (chargeAmountCents > 0 && !isStaff) {
      // Create appointment with "booked" status before payment
      const { data: preBooked, error: preErr } = await supabase.from("appointments").insert({
        client_id: bookingClientId,
        stylist_id: selectedStylist.user_id,
        salon_id: selectedSalon.id,
        service_id: selectedService.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "booked",
        notes: bookingNotes || null,
        ...(consultationParam ? { consultation_id: consultationParam } : {}),
      }).select("id").single();

      if (preErr || !preBooked) {
        setSubmitting(false);
        toast.error("Booking failed", { description: preErr?.message || "Could not create appointment" });
        return;
      }

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "payment",
          save_payment_method: savePaymentMethod,
          line_items: [{
            price_data: {
              currency: "usd",
              product_data: { name: productName },
              unit_amount: chargeAmountCents,
            },
            quantity: 1,
          }],
          success_url: `${window.location.origin}/dashboard/appointments?deposit_paid=true&appointment_id=${preBooked.id}`,
          cancel_url: `${window.location.origin}/dashboard/book?salon_id=${selectedSalon.id}`,
          metadata: { type: paymentMode, salon_id: selectedSalon.id, service_id: selectedService.id, appointment_id: preBooked.id },
        },
      });
      setSubmitting(false);
      if (checkoutError) {
        toast.error("Payment error", { description: checkoutError.message });
        return;
      }
      if (checkoutData?.url) {
        window.open(checkoutData.url, "_blank");
        return;
      }
    }

    // No payment — book directly
    await bookAppointment(startTime, endTime);
  };

  const bookAppointment = async (startTime: Date, endTime: Date) => {
    if (!user || !bookingClientId || !selectedSalon || !selectedService || !selectedStylist) return;
    const { data: inserted, error } = await supabase.from("appointments").insert({
      client_id: bookingClientId,
      stylist_id: selectedStylist.user_id,
      salon_id: selectedSalon.id,
      service_id: selectedService.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: isStaff ? "confirmed" : "booked",
      notes: bookingNotes || null,
    }).select("id").single();
    setSubmitting(false);
    if (error) {
      toast.error("Booking failed", { description: error.message });
    } else {
      // Submit form responses
      const pendingForms = bookingForms.filter(f => !f.alreadyCompleted && formsCompleted.has(f.id));
      for (const form of pendingForms) {
        await supabase.from("form_submissions").insert({
          form_id: form.id,
          salon_id: selectedSalon.id,
          client_id: bookingClientId,
          appointment_id: inserted.id,
          responses: formResponses[form.id] || {},
        });
      }
      supabase.functions.invoke("send-appointment-email", {
        body: { appointment_id: inserted.id, type: "booking_confirmed" },
      }).catch(console.error);

      // Deduct redeemed loyalty points
      if (redeemPoints && pointsToRedeem > 0 && selectedSalon) {
        await supabase.from("loyalty_points").insert({
          client_id: bookingClientId,
          salon_id: selectedSalon.id,
          appointment_id: inserted.id,
          points: -pointsToRedeem,
          reason: `Redeemed ${pointsToRedeem} pts (-$${((pointsToRedeem * pointValueCents) / 100).toFixed(2)})`,
        });
      }

      // Send onboarding SMS if toggled on (staff booking).
      // Gated on smsConsentAttested — no SMS goes out without recorded consent.
      let showFallbackUrl = false;
      if (isStaff && sendOnboardingSms && smsConsentAttested && selectedClient?.phone) {
        try {
          const { data: smsResult } = await supabase.functions.invoke("send-client-onboarding-sms", {
            body: {
              appointment_id: inserted.id,
              phone: selectedClient.phone,
              site_url: window.location.origin,
            },
          });
          if (smsResult?.success) {
            toast.success("Onboarding link sent via SMS!", { description: `Sent to ${selectedClient.phone}` });
          } else if (smsResult?.fallback && smsResult?.onboarding_url) {
            setOnboardingUrl(smsResult.onboarding_url);
            showFallbackUrl = true;
            toast.success("SMS not available", { description: "Copy the onboarding link to share manually" });
          }
        } catch (e) {
          console.error("SMS send error:", e);
        }
      }

      toast.success("Appointment booked!", { description: `${format(startTime, "MMM d 'at' h:mm a")} with ${selectedStylist.full_name}` });
      if (!showFallbackUrl) {
        navigate("/dashboard/appointments");
      }
      if (consultationParam) {
        supabase.from("appointments").update({ consultation_id: consultationParam }).eq("id", inserted.id).then(() => {});
      }
    }
  };

  // Handle deposit return from Stripe — confirm the pre-created appointment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("deposit_paid") === "true") {
      const appointmentId = params.get("appointment_id");
      if (!appointmentId || !user) return;

      const confirmAppointment = async () => {
        // Update appointment status to confirmed (fallback — webhook may have already done this)
        const { error } = await supabase
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", appointmentId)
          .eq("client_id", user.id);

        if (!error) {
          supabase.functions.invoke("send-appointment-email", {
            body: { appointment_id: appointmentId, type: "booking_confirmed" },
          }).catch(console.error);
          toast.success("Deposit paid & appointment confirmed!");
        }
        navigate("/dashboard/appointments", { replace: true });
      };
      confirmAppointment();
    }
  }, [user]);

  // Get effective price for a service based on selected stylist's level
  const getEffectivePrice = (svc: Service): number => {
    if (selectedStylist?.level_id) {
      const lp = levelPrices.find(p => p.service_id === svc.id && p.level_id === selectedStylist.level_id);
      if (lp) return lp.price;
    }
    return svc.price;
  };

  const timeSlots = step === "datetime" ? getTimeSlots() : [];

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return !q || (c.full_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  // Wait for auth role to resolve so we show the correct flow
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">
        {isStaff ? "Book for Client" : "Book Appointment"}
      </h1>
      <p className="text-muted-foreground mb-6 font-normal">
        {isStaff ? "Book an appointment on behalf of a client (e.g. phone booking)" : "Schedule your next salon visit"}
      </p>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= stepIndex ? "bg-gradient-prism" : "bg-muted"
          )} />
        ))}
      </div>

      {/* Step: Client (staff only) */}
      {step === "client" && isStaff && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" /> Select Client
            </h2>
            <Button variant="outline" size="sm" onClick={() => setShowNewClient(!showNewClient)}>
              <UserPlus className="h-4 w-4 mr-1" /> {showNewClient ? "Search Existing" : "New Walk-in"}
            </Button>
          </div>

          {showNewClient ? (
            <Card className="glass rounded-xl border-0">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Create New Client (Walk-in)</p>
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Jane Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="jane@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="(555) 123-4567" />
                </div>
                <Button
                  className="w-full"
                  disabled={creatingClient || !newClientName.trim() || !newClientEmail.trim()}
                  onClick={async () => {
                    setCreatingClient(true);
                    // Create user via edge function
                    const { data, error } = await supabase.functions.invoke("invite-stylist", {
                      body: {
                        email: newClientEmail.trim(),
                        full_name: newClientName.trim(),
                        role: "client",
                        // Using invite-stylist as a general invite function
                      },
                    });
                    if (error || data?.error) {
                      // If user already exists, try to find them
                      const { data: existing } = await supabase
                        .from("profiles")
                        .select("user_id, full_name, phone")
                        .ilike("full_name", `%${newClientName.trim()}%`)
                        .limit(1)
                        .maybeSingle();
                      if (existing) {
                        setSelectedClient({ user_id: existing.user_id, full_name: existing.full_name, phone: existing.phone });
                        setShowNewClient(false);
                        setCreatingClient(false);
                        return;
                      }
                      toast.error("Error", { description: "Could not create client. They may need to sign up first." });
                      setCreatingClient(false);
                      return;
                    }
                    // Look up the newly created profile
                    setTimeout(async () => {
                      const { data: profile } = await supabase
                        .from("profiles")
                        .select("user_id, full_name, phone")
                        .ilike("full_name", `%${newClientName.trim()}%`)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                      if (profile) {
                        setSelectedClient({ user_id: profile.user_id, full_name: profile.full_name, phone: profile.phone });
                        setClients(prev => [{ user_id: profile.user_id, full_name: profile.full_name, phone: profile.phone }, ...prev]);
                      }
                      setShowNewClient(false);
                      setCreatingClient(false);
                    }, 1500);
                  }}
                >
                  {creatingClient ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Create & Select
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No clients found</p>
                ) : filteredClients.slice(0, 50).map((client) => (
                  <Card
                    key={client.user_id}
                    className={cn("cursor-pointer transition-all hover:border-primary", selectedClient?.user_id === client.user_id && "border-primary ring-1 ring-primary")}
                    onClick={() => setSelectedClient(client)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{client.full_name || "Unnamed"}</p>
                        {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={goNext} disabled={!selectedClient}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Salon */}
      {step === "salon" && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Select a Salon</h2>
          {salons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No salons available yet</p>
          ) : salons.map((salon) => (
            <Card
              key={salon.id}
              className={cn("cursor-pointer transition-all hover:border-primary", selectedSalon?.id === salon.id && "border-primary ring-1 ring-primary")}
              onClick={() => { setSelectedSalon(salon); setSelectedService(null); setSelectedStylist(null); setSelectedDate(undefined); setSelectedTime(null); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-medium">{salon.name}</p>
                  {salon.city && <p className="text-xs text-muted-foreground">{salon.address}, {salon.city}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end pt-4">
            <Button onClick={goNext} disabled={!selectedSalon}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Service */}
      {step === "service" && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Choose a Service</h2>
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : services.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No services available at this salon</p>
          ) : services.map((svc) => (
            <Card
              key={svc.id}
              className={cn("cursor-pointer transition-all hover:border-primary", selectedService?.id === svc.id && "border-primary ring-1 ring-primary")}
              onClick={() => { setSelectedService(svc); setSelectedDate(undefined); setSelectedTime(null); }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Scissors className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">{svc.duration_minutes} min{svc.category ? ` · ${svc.category}` : ""}</p>
                  </div>
                </div>
                <span className="font-semibold text-sm">
                  ${getEffectivePrice(svc)}
                  {selectedStylist?.level_id && getEffectivePrice(svc) !== svc.price && (
                    <span className="text-xs text-muted-foreground line-through ml-1">${svc.price}</span>
                  )}
                </span>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={goNext} disabled={!selectedService}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Stylist */}
      {step === "stylist" && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Pick a Stylist</h2>
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : stylists.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No stylists at this salon yet</p>
          ) : stylists.map((st) => (
            <Card
              key={st.id}
              className={cn("cursor-pointer transition-all hover:border-primary", selectedStylist?.id === st.id && "border-primary ring-1 ring-primary")}
              onClick={() => { setSelectedStylist(st); setSelectedDate(undefined); setSelectedTime(null); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{st.full_name}</p>
                  {st.specialties && st.specialties.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {st.specialties.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                    </div>
                  )}
                </div>
                <StylistRating stylistId={st.user_id} />
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={goNext} disabled={!selectedStylist}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Date & Time */}
      {step === "datetime" && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Pick Date & Time</h2>
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardContent className="p-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedTime(null); }}
                    disabled={(date) => !isDateAvailable(date)}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </CardContent>
              </Card>
              <div>
                {selectedDate ? (
                  <>
                    <p className="text-sm font-medium mb-3">{format(selectedDate, "EEEE, MMMM d")}</p>
                    {timeSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No available slots for this date</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {timeSlots.map((t) => (
                          <Button
                            key={t}
                            variant={selectedTime === t ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTime(t)}
                            className="text-xs"
                          >
                            {t}
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a date to see available times</p>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button onClick={goNext} disabled={!selectedDate || !selectedTime}>Continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {/* Step: Forms */}
      {step === "forms" && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Required Forms
          </h2>
          <p className="text-sm text-muted-foreground">
            Please complete the following forms before confirming your booking.
          </p>
          {bookingForms.filter(f => !f.alreadyCompleted).map((form) => {
            const isCompleted = formsCompleted.has(form.id);
            const responses = formResponses[form.id] || {};
            return (
              <Card key={form.id} className={cn(isCompleted && "border-primary/50 bg-primary/5")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{form.title}</CardTitle>
                    {isCompleted && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                  {form.description && <CardDescription>{form.description}</CardDescription>}
                </CardHeader>
                {!isCompleted && (
                  <CardContent className="space-y-4">
                    {form.fields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label>
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {(field.type === "text" || field.type === "email" || field.type === "phone" || field.type === "number") && (
                          <Input
                            type={field.type === "phone" ? "tel" : field.type}
                            value={responses[field.id] || ""}
                            onChange={(e) => setFormResponses(prev => ({
                              ...prev,
                              [form.id]: { ...prev[form.id], [field.id]: e.target.value }
                            }))}
                            placeholder={field.placeholder}
                          />
                        )}
                        {field.type === "date" && (
                          <Input
                            type="date"
                            value={responses[field.id] || ""}
                            onChange={(e) => setFormResponses(prev => ({
                              ...prev,
                              [form.id]: { ...prev[form.id], [field.id]: e.target.value }
                            }))}
                          />
                        )}
                        {field.type === "textarea" && (
                          <Textarea
                            value={responses[field.id] || ""}
                            onChange={(e) => setFormResponses(prev => ({
                              ...prev,
                              [form.id]: { ...prev[form.id], [field.id]: e.target.value }
                            }))}
                            placeholder={field.placeholder}
                            rows={3}
                          />
                        )}
                        {field.type === "select" && (
                          <Select
                            value={responses[field.id] || ""}
                            onValueChange={(v) => setFormResponses(prev => ({
                              ...prev,
                              [form.id]: { ...prev[form.id], [field.id]: v }
                            }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                            <SelectContent>
                              {(field.options || []).map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {field.type === "radio" && (
                          <RadioGroup
                            value={responses[field.id] || ""}
                            onValueChange={(v) => setFormResponses(prev => ({
                              ...prev,
                              [form.id]: { ...prev[form.id], [field.id]: v }
                            }))}
                          >
                            {(field.options || []).map(opt => (
                              <div key={opt} className="flex items-center gap-2">
                                <RadioGroupItem value={opt} id={`${form.id}-${field.id}-${opt}`} />
                                <Label htmlFor={`${form.id}-${field.id}-${opt}`} className="font-normal">{opt}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}
                        {field.type === "checkbox" && (
                          <div className="space-y-2">
                            {(field.options || []).map(opt => (
                              <div key={opt} className="flex items-center gap-2">
                                <Checkbox
                                  checked={((responses[field.id] as string[]) || []).includes(opt)}
                                  onCheckedChange={(checked) => {
                                    const current = (responses[field.id] as string[]) || [];
                                    setFormResponses(prev => ({
                                      ...prev,
                                      [form.id]: {
                                        ...prev[form.id],
                                        [field.id]: checked ? [...current, opt] : current.filter((v: string) => v !== opt),
                                      }
                                    }));
                                  }}
                                  id={`${form.id}-${field.id}-${opt}`}
                                />
                                <Label htmlFor={`${form.id}-${field.id}-${opt}`} className="font-normal">{opt}</Label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        // Validate required fields
                        for (const field of form.fields) {
                          if (field.required) {
                            const val = responses[field.id];
                            if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === "string" && !val.trim())) {
                              toast.error(`"${field.label}" is required`);
                              return;
                            }
                          }
                        }
                        setFormsCompleted(prev => new Set([...prev, form.id]));
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Complete
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
          {bookingForms.filter(f => f.alreadyCompleted).length > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {bookingForms.filter(f => f.alreadyCompleted).length} form(s) already completed previously — skipped
            </div>
          )}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
            <Button
              onClick={goNext}
              disabled={bookingForms.filter(f => !f.alreadyCompleted).some(f => !formsCompleted.has(f.id))}
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && selectedSalon && selectedService && selectedStylist && selectedDate && selectedTime && (() => {
        const basePrice = getEffectivePrice(selectedService);
        const priceAdj = getAdjustedPrice(basePrice, surgeEnabled, surgeRules, offpeakEnabled, offpeakRules, selectedDate, selectedTime);
        const effectivePrice = priceAdj.finalPrice;

        // Loyalty redemption discount
        const maxRedeemValue = (clientPoints * pointValueCents) / 100; // dollars
        const maxRedeemablePoints = Math.min(clientPoints, Math.floor(effectivePrice * 100 / pointValueCents));
        const redeemDiscount = redeemPoints ? (pointsToRedeem * pointValueCents) / 100 : 0;
        const priceAfterRedeem = Math.max(0, effectivePrice - redeemDiscount);

        const depositAmt = paymentMode === "deposit" && depositPercentage && depositPercentage > 0
          ? (priceAfterRedeem * depositPercentage / 100) : 0;
        const fullAmt = paymentMode === "full" ? priceAfterRedeem : 0;
        const chargeAmt = depositAmt || fullAmt;
        return (
          <div className="space-y-4">
            <h2 className="text-lg font-medium">Confirm Booking</h2>
            <Card className="glass-elevated rounded-xl border-0">
              <CardContent className="p-6 space-y-3">
                {isStaff && selectedClient && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" /> <span className="font-medium">Client: {selectedClient.full_name || "Unnamed"}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" /> <span className="font-medium">{selectedSalon.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Scissors className="h-4 w-4 text-primary" />
                  <span>{selectedService.name} — ${effectivePrice.toFixed(2)}</span>
                  {priceAdj.label && (
                    <Badge variant={priceAdj.type === "surge" ? "destructive" : "secondary"} className="text-[10px]">
                      {priceAdj.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-primary" /> <span>{selectedStylist.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalIcon className="h-4 w-4 text-primary" />
                  <span>{format(selectedDate, "EEEE, MMMM d")} at {selectedTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{selectedService.duration_minutes} minutes</span>
                </div>
                {paymentMode === "deposit" && depositAmt > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium text-primary">
                      Deposit required: ${depositAmt.toFixed(2)} ({depositPercentage}%)
                    </p>
                    <p className="text-xs text-muted-foreground">You'll be redirected to secure payment</p>
                  </div>
                )}
                {paymentMode === "full" && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm font-medium text-primary">
                      Full payment: ${priceAfterRedeem.toFixed(2)}
                      {redeemDiscount > 0 && <span className="text-xs text-muted-foreground ml-1">(was ${effectivePrice.toFixed(2)})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Your card will be saved for future in-salon visits</p>
                  </div>
                )}
                {paymentMode === "none" && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">No payment required at booking</p>
                  </div>
                )}
               </CardContent>
            </Card>

            {/* Loyalty Point Redemption */}
            {loyaltyEnabled && clientPoints > 0 && !isStaff && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Redeem loyalty points</p>
                        <p className="text-xs text-muted-foreground">
                          You have <span className="font-semibold text-foreground">{clientPoints}</span> points
                          (worth up to ${maxRedeemValue.toFixed(2)})
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={redeemPoints}
                      onCheckedChange={(checked) => {
                        setRedeemPoints(checked);
                        if (checked) setPointsToRedeem(maxRedeemablePoints);
                        else setPointsToRedeem(0);
                      }}
                    />
                  </div>
                  {redeemPoints && (
                    <div className="space-y-2 ml-7">
                      <Label className="text-xs">Points to redeem (max {maxRedeemablePoints})</Label>
                      <Input
                        type="number"
                        min={0}
                        max={maxRedeemablePoints}
                        value={pointsToRedeem}
                        onChange={(e) => setPointsToRedeem(Math.min(maxRedeemablePoints, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="max-w-[160px]"
                      />
                      <p className="text-xs text-primary font-medium">
                        −${redeemDiscount.toFixed(2)} discount applied
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">Notes / Special Requests (optional)</p>
              <Textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="e.g. Wants balayage highlights, bring reference photos, allergic to certain products..."
                rows={3}
              />
            </div>
            {/* SMS onboarding toggle for staff — requires consent attestation */}
            {isStaff && selectedClient?.phone && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Send check-in link via SMS</p>
                        <p className="text-xs text-muted-foreground">Client can complete profile, add card & accept policies</p>
                      </div>
                    </div>
                    <Switch
                      checked={sendOnboardingSms}
                      onCheckedChange={(v) => {
                        setSendOnboardingSms(v);
                        if (!v) setSmsConsentAttested(false);
                      }}
                    />
                  </div>
                  {sendOnboardingSms && (
                    <>
                      <div className="flex items-start gap-2 rounded-md border border-border/60 bg-background/60 p-3">
                        <Checkbox
                          id="staff-sms-attest"
                          checked={smsConsentAttested}
                          onCheckedChange={(c) => setSmsConsentAttested(!!c)}
                          className="mt-0.5"
                        />
                        <Label htmlFor="staff-sms-attest" className="text-xs leading-relaxed font-normal text-muted-foreground">
                          I confirm <span className="text-foreground font-medium">{selectedClient.full_name || "this client"}</span>{" "}
                          has given consent to receive transactional SMS messages from this salon at{" "}
                          <span className="text-foreground font-medium">{selectedClient.phone}</span>{" "}
                          (in person, by phone, or via the public check-in form). I understand that
                          STOP unsubscribes the client and HELP returns help text.
                        </Label>
                      </div>
                      {smsConsentAttested ? (
                        <p className="text-xs text-muted-foreground ml-7">
                          Link will be sent to {selectedClient.phone}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 ml-7">
                          SMS will not be sent until you confirm consent above.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Show onboarding URL fallback if SMS failed */}
            {onboardingUrl && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Share this link with the client:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={onboardingUrl} readOnly className="text-xs" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(onboardingUrl);
                        toast.success("Link copied!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/dashboard/appointments")}>
                    Done — Go to Appointments
                  </Button>
                </CardContent>
              </Card>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={handleConfirm} disabled={submitting} className="bg-gradient-champagne text-obsidian rounded-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {chargeAmt > 0 ? (paymentMode === "deposit" ? "Pay Deposit & Book" : "Pay & Book") : "Confirm Booking"}
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default BookAppointment;
