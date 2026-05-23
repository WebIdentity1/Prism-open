import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Find appointments starting in ~24 hours (23-25 hour window to avoid duplicates with hourly cron)
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*, services:service_id(name), client_profile:profiles!appointments_client_id_profiles_fkey(full_name), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name), salons:salon_id(name, notification_preferences)")
      .in("status", ["booked", "confirmed"])
      .gte("start_time", from.toISOString())
      .lte("start_time", to.toISOString());

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    let skipped = 0;

    for (const appt of appointments || []) {
      const salon = appt.salons as any;
      const prefs = salon?.notification_preferences || {};

      if (prefs.appointment_reminder === false) {
        skipped++;
        continue;
      }

      // Get client email
      const { data: authUser } = await supabase.auth.admin.getUserById(appt.client_id);
      const clientEmail = authUser?.user?.email;
      if (!clientEmail) { skipped++; continue; }

      const clientName = (appt.client_profile as any)?.full_name || "there";
      const stylistName = (appt.stylist_profile as any)?.full_name || "your stylist";
      const serviceName = (appt.services as any)?.name || "your appointment";
      const salonName = salon?.name || "the salon";
      const startTime = new Date(appt.start_time);
      const formattedDate = startTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const formattedTime = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Appointments <onboarding@resend.dev>",
          to: [clientEmail],
          subject: `Reminder: ${serviceName} tomorrow at ${formattedTime}`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
              <h2 style="margin-bottom: 4px;">Appointment Reminder ⏰</h2>
              <p>Hi ${clientName},</p>
              <p>Just a reminder that you have an appointment tomorrow:</p>
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 16px 0;">
                <p style="margin: 4px 0;"><strong>Service:</strong> ${serviceName}</p>
                <p style="margin: 4px 0;"><strong>Stylist:</strong> ${stylistName}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 4px 0;"><strong>Time:</strong> ${formattedTime}</p>
                <p style="margin: 4px 0;"><strong>Salon:</strong> ${salonName}</p>
              </div>
              <p style="color: #666; font-size: 14px;">See you soon!</p>
            </div>
          `,
        }),
      });

      if (res.ok) { sent++; } else {
        const errData = await res.json();
        console.error(`Failed for ${appt.id}:`, errData);
      }
    }

    return new Response(JSON.stringify({ sent, skipped, total: (appointments || []).length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
