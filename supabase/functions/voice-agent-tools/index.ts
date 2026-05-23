import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-agent-secret",
};

// Tool implementations for ElevenLabs voice agent
// These mirror the ai-assistant tools but are accessed via webhook from ElevenLabs

// Normalize phone to E.164 format, assuming US (+1) if no country code
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (!phone.startsWith("+")) return `+${digits}`;
  return phone;
}

async function getServicesList(supabase: any, salonId: string): Promise<string> {
  const { data } = await supabase
    .from("services")
    .select("id, name, price, duration_minutes, category, member_price")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("category", { ascending: true });
  return JSON.stringify({ services: data || [] });
}

async function getStaffList(supabase: any, salonId: string): Promise<string> {
  const { data } = await supabase
    .from("stylist_profiles")
    .select("user_id, specialties, years_experience, bio, stylist_levels(name)")
    .eq("salon_id", salonId);

  const enriched = [];
  for (const sp of data || []) {
    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("user_id", sp.user_id).single();
    enriched.push({
      id: sp.user_id,
      name: profile?.full_name || "Unknown",
      level: sp.stylist_levels?.name || "N/A",
      specialties: sp.specialties || [],
      years_experience: sp.years_experience,
    });
  }
  return JSON.stringify({ staff: enriched });
}

async function getTodaysSchedule(supabase: any, salonId: string, stylistId?: string, date?: string): Promise<string> {
  const target = date ? new Date(date) : new Date();
  if (isNaN(target.getTime())) {
    return JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." });
  }
  const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).toISOString();
  const endOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1).toISOString();

  let query = supabase
    .from("appointments")
    .select("id, start_time, end_time, status, client_id, stylist_id, services(name, price)")
    .eq("salon_id", salonId)
    .gte("start_time", startOfDay)
    .lt("start_time", endOfDay)
    .order("start_time", { ascending: true });

  if (stylistId) query = query.eq("stylist_id", stylistId);
  const { data } = await query;

  const enriched = [];
  for (const appt of data || []) {
    const [{ data: cp }, { data: sp }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", appt.client_id).single(),
      supabase.from("profiles").select("full_name").eq("user_id", appt.stylist_id).single(),
    ]);
    enriched.push({
      id: appt.id,
      client: cp?.full_name || "Unknown",
      stylist: sp?.full_name || "Unknown",
      service: appt.services?.name || "N/A",
      start_time: appt.start_time,
      end_time: appt.end_time,
      status: appt.status,
    });
  }
  return JSON.stringify({ date: startOfDay.split("T")[0], schedule: enriched, total_appointments: enriched.length });
}

async function getUpcomingAppointments(supabase: any, salonId: string, limit: number): Promise<string> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, client_id, stylist_id, notes, services(name, price, duration_minutes)")
    .eq("salon_id", salonId)
    .gte("start_time", now)
    .in("status", ["booked", "confirmed"])
    .order("start_time", { ascending: true })
    .limit(limit);

  const enriched = [];
  for (const appt of data || []) {
    const [{ data: cp }, { data: sp }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", appt.client_id).single(),
      supabase.from("profiles").select("full_name").eq("user_id", appt.stylist_id).single(),
    ]);
    enriched.push({
      id: appt.id,
      client: cp?.full_name || "Unknown",
      stylist: sp?.full_name || "Unknown",
      service: appt.services?.name || "N/A",
      price: appt.services?.price || 0,
      start_time: appt.start_time,
      end_time: appt.end_time,
      status: appt.status,
    });
  }
  return JSON.stringify({ upcoming_appointments: enriched });
}

async function searchClients(supabase: any, salonId: string, nameQuery?: string): Promise<string> {
  const { data: appts } = await supabase
    .from("appointments")
    .select("client_id, start_time, status")
    .eq("salon_id", salonId)
    .order("start_time", { ascending: false });

  const clientMap: Record<string, { lastVisit: string; totalVisits: number }> = {};
  for (const a of appts || []) {
    if (!clientMap[a.client_id]) clientMap[a.client_id] = { lastVisit: a.start_time, totalVisits: 0 };
    if (a.status === "completed") clientMap[a.client_id].totalVisits++;
  }

  const clientIds = Object.keys(clientMap);
  if (clientIds.length === 0) return JSON.stringify({ clients: [], total: 0 });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone")
    .in("user_id", clientIds.slice(0, 100));

  let results = (profiles || []).map((p: any) => ({
    id: p.user_id,
    name: p.full_name || "Unknown",
    phone: p.phone,
    last_visit: clientMap[p.user_id]?.lastVisit,
    total_visits: clientMap[p.user_id]?.totalVisits || 0,
  }));

  if (nameQuery) {
    const q = nameQuery.toLowerCase();
    results = results.filter((c: any) => c.name.toLowerCase().includes(q));
  }
  return JSON.stringify({ clients: results.slice(0, 20), total: results.length });
}

async function createAppointment(supabase: any, salonId: string, args: any): Promise<string> {
  let durationMinutes = 60;
  if (args.service_id) {
    const { data: svc } = await supabase.from("services").select("duration_minutes").eq("id", args.service_id).single();
    if (svc?.duration_minutes) durationMinutes = svc.duration_minutes;
  }
  const startTime = new Date(args.start_time);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  // Check for conflicting appointments
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("stylist_id", args.stylist_id)
    .in("status", ["booked", "confirmed"])
    .lt("start_time", endTime.toISOString())
    .gt("end_time", args.start_time)
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return JSON.stringify({ error: "Time slot conflicts with an existing appointment for this stylist." });
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: salonId,
      client_id: args.client_id,
      stylist_id: args.stylist_id,
      service_id: args.service_id || null,
      start_time: args.start_time,
      end_time: endTime.toISOString(),
      notes: args.notes || "Booked via phone call",
      status: "booked",
      payment_status: "pending",
    })
    .select("id, start_time, end_time, status")
    .single();

  if (error) return JSON.stringify({ error: error.message });

  const [{ data: cp }, { data: sp }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", args.client_id).single(),
    supabase.from("profiles").select("full_name").eq("user_id", args.stylist_id).single(),
  ]);

  return JSON.stringify({
    success: true,
    appointment_id: data.id,
    client: cp?.full_name || args.client_id,
    stylist: sp?.full_name || args.stylist_id,
    start_time: data.start_time,
    end_time: data.end_time,
    status: data.status,
    message: `Appointment booked for ${cp?.full_name || "client"} with ${sp?.full_name || "stylist"}.`,
  });
}

async function cancelAppointment(supabase: any, appointmentId: string): Promise<string> {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .select("id, start_time, status")
    .single();
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, appointment: data, message: "Appointment has been cancelled." });
}

async function lookupCaller(supabase: any, salonId: string, phoneNumber: string): Promise<string> {
  // Normalize phone number — strip non-digits, try with/without country code
  const digits = phoneNumber.replace(/\D/g, "");
  const variants = [phoneNumber, digits];
  if (digits.length === 11 && digits.startsWith("1")) variants.push(digits.slice(1));
  if (digits.length === 10) variants.push("1" + digits, "+1" + digits);
  variants.push("+" + digits);

  // Search profiles for matching phone
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone");

  const match = (profiles || []).find((p: any) => {
    if (!p.phone) return false;
    const pDigits = p.phone.replace(/\D/g, "");
    return variants.includes(p.phone) || variants.includes(pDigits) || digits === pDigits;
  });

  if (!match) {
    return JSON.stringify({ found: false, message: "No existing client found with this phone number." });
  }

  // Check if this client has visited this salon
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, start_time, status, services(name)")
    .eq("salon_id", salonId)
    .eq("client_id", match.user_id)
    .order("start_time", { ascending: false })
    .limit(5);

  const completed = (appts || []).filter((a: any) => a.status === "completed");

  return JSON.stringify({
    found: true,
    client_id: match.user_id,
    full_name: match.full_name,
    phone: match.phone,
    total_visits: completed.length,
    last_visit: completed[0]?.start_time || null,
    recent_services: completed.slice(0, 3).map((a: any) => a.services?.name).filter(Boolean),
  });
}

async function createClientProfile(supabase: any, args: { full_name: string; phone: string }): Promise<string> {
  // Normalize phone — assume US if no country code
  const phone = normalizePhone(args.phone);

  // Check if phone already exists (try normalized and raw)
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .or(`phone.eq.${phone},phone.eq.${args.phone}`)
    .maybeSingle();

  if (existing) {
    return JSON.stringify({
      success: true,
      client_id: existing.user_id,
      full_name: existing.full_name,
      message: "Client already exists with this phone number.",
      already_existed: true,
    });
  }

  // Create a new auth user (phone-based) via admin API
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    phone,
    user_metadata: { full_name: args.full_name },
    phone_confirm: true,
  });

  if (authError) {
    return JSON.stringify({ error: `Failed to create client: ${authError.message}` });
  }

  // Profile should be auto-created by DB trigger, but update with name
  if (newUser?.user) {
    await supabase
      .from("profiles")
      .update({ full_name: args.full_name, phone })
      .eq("user_id", newUser.user.id);
  }

  return JSON.stringify({
    success: true,
    client_id: newUser?.user?.id,
    full_name: args.full_name,
    phone,
    message: `New client profile created for ${args.full_name}.`,
    already_existed: false,
  });
}

// ── Main server ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate via shared secret
    const secret = req.headers.get("x-voice-agent-secret");
    const expectedSecret = Deno.env.get("VOICE_AGENT_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { tool_name, salon_id, parameters: nestedParams, ...rest } = body;

    // ElevenLabs may pass parameters nested under "parameters" or as top-level body fields
    const parameters = (typeof nestedParams === "object" && nestedParams !== null && nestedParams !== "{{parameters}}")
      ? nestedParams
      : rest;

    if (!tool_name || !salon_id) {
      return new Response(
        JSON.stringify({ error: "Missing tool_name or salon_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Voice agent tool call: ${tool_name} for salon ${salon_id}`, JSON.stringify(parameters));

    let result: string;

    switch (tool_name) {
      case "get_services_list":
        result = await getServicesList(supabase, salon_id);
        break;

      case "get_staff_list":
        result = await getStaffList(supabase, salon_id);
        break;

      case "get_todays_schedule":
        result = await getTodaysSchedule(supabase, salon_id, parameters?.stylist_id, parameters?.date);
        break;

      case "get_upcoming_appointments":
        result = await getUpcomingAppointments(supabase, salon_id, parameters?.limit || 10);
        break;

      case "search_clients":
        result = await searchClients(supabase, salon_id, parameters?.name_query);
        break;

      case "create_appointment":
        result = await createAppointment(supabase, salon_id, parameters);
        break;

      case "cancel_appointment":
        result = await cancelAppointment(supabase, parameters?.appointment_id);
        break;

      case "lookup_caller":
        result = await lookupCaller(supabase, salon_id, parameters?.phone_number);
        break;

      case "create_client_profile":
        result = await createClientProfile(supabase, {
          full_name: parameters?.full_name,
          phone: parameters?.phone,
        });
        break;

      default:
        result = JSON.stringify({ error: `Unknown tool: ${tool_name}` });
    }

    return new Response(result, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Voice agent tools error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
