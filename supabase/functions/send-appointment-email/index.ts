import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  appointment_id: string;
  type: "booking_confirmed" | "booking_cancelled";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { appointment_id, type } = (await req.json()) as EmailPayload;

    // Fetch appointment with related data
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("*, services:service_id(name, price, duration_minutes), client_profile:profiles!appointments_client_id_profiles_fkey(full_name, user_id), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name), salons:salon_id(name, email, notification_preferences)")
      .eq("id", appointment_id)
      .single();

    if (apptErr || !appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const salon = appt.salons as any;
    const prefs = salon?.notification_preferences || {};

    // Check salon notification preferences
    if (type === "booking_confirmed" && prefs.booking_confirmed === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "Notification disabled by salon" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (type === "booking_cancelled" && prefs.booking_cancelled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "Notification disabled by salon" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get client email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(appt.client_id);
    const clientEmail = authUser?.user?.email;
    if (!clientEmail) {
      return new Response(JSON.stringify({ error: "Client email not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clientName = (appt.client_profile as any)?.full_name || "Client";
    const stylistName = (appt.stylist_profile as any)?.full_name || "Your stylist";
    const serviceName = (appt.services as any)?.name || "Service";
    const servicePrice = (appt.services as any)?.price;
    const salonName = salon?.name || "the salon";
    const startTime = new Date(appt.start_time);
    const formattedDate = startTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const formattedTime = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    let subject: string;
    let html: string;

    if (type === "booking_confirmed") {
      subject = `Appointment Confirmed — ${salonName}`;
      html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-bottom: 4px;">Your appointment is confirmed! ✅</h2>
          <p style="color: #666;">Hi ${clientName},</p>
          <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Service:</strong> ${serviceName}${servicePrice ? ` — $${servicePrice}` : ""}</p>
            <p style="margin: 4px 0;"><strong>Stylist:</strong> ${stylistName}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${formattedTime}</p>
            <p style="margin: 4px 0;"><strong>Salon:</strong> ${salonName}</p>
          </div>
          <p style="color: #666; font-size: 14px;">We look forward to seeing you!</p>
        </div>
      `;
    } else {
      subject = `Appointment Cancelled — ${salonName}`;
      html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="margin-bottom: 4px;">Appointment Cancelled</h2>
          <p style="color: #666;">Hi ${clientName},</p>
          <p>Your appointment for <strong>${serviceName}</strong> with <strong>${stylistName}</strong> on <strong>${formattedDate}</strong> at <strong>${formattedTime}</strong> has been cancelled.</p>
          <p style="color: #666; font-size: 14px;">If you'd like to rebook, visit your dashboard anytime.</p>
        </div>
      `;
    }

    // Send via Resend
    const fromAddress = Deno.env.get("EMAIL_FROM") || "Prism <onboarding@resend.dev>";
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: fromAddress,
        to: [clientEmail],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      const resendStatus = resendRes.status === 403 || resendRes.status === 401 ? 502 : 500;
      return new Response(JSON.stringify({ error: "Failed to send email", details: resendData }), { status: resendStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
