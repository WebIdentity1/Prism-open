import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeIcal(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcalDate(date: string): string {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up stylist by feed token
    const { data: stylist, error: stylistErr } = await supabase
      .from("stylist_profiles")
      .select("user_id")
      .eq("calendar_feed_token", token)
      .single();

    if (stylistErr || !stylist) {
      return new Response("Invalid token", { status: 404, headers: corsHeaders });
    }

    // Get stylist name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", stylist.user_id)
      .single();

    const stylistName = profile?.full_name || "Stylist";

    // Fetch appointments (next 90 days + last 30 days)
    const now = new Date();
    const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, status, notes, client_id, service_id")
      .eq("stylist_id", stylist.user_id)
      .in("status", ["booked", "confirmed", "completed"])
      .gte("start_time", past)
      .lte("start_time", future)
      .order("start_time", { ascending: true });

    // Get client names and service names
    const clientIds = [...new Set((appointments || []).map((a) => a.client_id))];
    const serviceIds = [...new Set((appointments || []).filter((a) => a.service_id).map((a) => a.service_id!))];

    const { data: clients } = clientIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds)
      : { data: [] };

    const { data: services } = serviceIds.length
      ? await supabase.from("services").select("id, name").in("id", serviceIds)
      : { data: [] };

    const clientMap = new Map((clients || []).map((c) => [c.user_id, c.full_name]));
    const serviceMap = new Map((services || []).map((s) => [s.id, s.name]));

    // Build iCal
    const events = (appointments || []).map((appt) => {
      const clientName = clientMap.get(appt.client_id) || "Client";
      const serviceName = appt.service_id ? serviceMap.get(appt.service_id) : null;
      const summary = serviceName ? `${serviceName} — ${clientName}` : `Appointment — ${clientName}`;
      const description = [
        `Client: ${clientName}`,
        serviceName ? `Service: ${serviceName}` : null,
        `Status: ${appt.status}`,
        appt.notes ? `Notes: ${appt.notes}` : null,
      ].filter(Boolean).join("\\n");

      return [
        "BEGIN:VEVENT",
        `UID:${appt.id}@prism`,
        `DTSTART:${formatIcalDate(appt.start_time)}`,
        `DTEND:${formatIcalDate(appt.end_time)}`,
        `SUMMARY:${escapeIcal(summary)}`,
        `DESCRIPTION:${escapeIcal(description)}`,
        `STATUS:${appt.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Prism//Calendar//EN",
      `X-WR-CALNAME:Prism — ${escapeIcal(stylistName)}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-TIMEZONE:UTC",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ical, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="prism-calendar.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Calendar feed error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
