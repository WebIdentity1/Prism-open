import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user) throw new Error("Not authenticated");

    const { appointment_id } = await req.json();
    if (!appointment_id) throw new Error("appointment_id is required");

    // Fetch appointment with related data
    const { data: appt, error: apptError } = await supabaseAdmin
      .from("appointments")
      .select("id, client_id, stylist_id, salon_id, service_id, status, payment_status, start_time")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appt) throw new Error("Appointment not found");
    if (appt.status !== "completed") throw new Error("Appointment must be completed to send payment link");
    if (appt.payment_status === "paid") throw new Error("Appointment already paid");

    // Verify caller is salon admin or stylist
    const { data: salon } = await supabaseAdmin
      .from("salons")
      .select("id, name, owner_id, stripe_account_id")
      .eq("id", appt.salon_id)
      .single();

    if (!salon) throw new Error("Salon not found");

    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["salon_admin", "stylist"]);

    if (roleError) throw roleError;

    const isSalonAdmin = (roleRows || []).some(({ role }) => role === "salon_admin");
    const isStylist = (roleRows || []).some(({ role }) => role === "stylist");
    if (!isSalonAdmin && !isStylist) throw new Error("Not authorized");

    let authorized = false;
    if (isSalonAdmin && salon.owner_id === user.id) {
      authorized = true;
    }

    if (!authorized && isStylist) {
      const { data: stylistProfile, error: stylistError } = await supabaseAdmin
        .from("stylist_profiles")
        .select("salon_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (stylistError) throw stylistError;
      authorized = stylistProfile?.salon_id === appt.salon_id;
    }

    if (!authorized) throw new Error("Not authorized");

    // Get service price
    let amount = 0;
    let serviceName = "Service";
    if (appt.service_id) {
      const { data: svc } = await supabaseAdmin
        .from("services")
        .select("name, price")
        .eq("id", appt.service_id)
        .single();
      if (svc) {
        amount = Math.round(svc.price * 100); // cents
        serviceName = svc.name;
      }
    }

    if (amount <= 0) throw new Error("No price found for this service");

    // Get client email and phone
    const { data: clientProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", appt.client_id)
      .single();

    // Get client email from auth
    const { data: clientAuth } = await supabaseAdmin.auth.admin.getUserById(appt.client_id);
    const clientEmail = clientAuth?.user?.email;
    if (!clientEmail) throw new Error("Client email not found");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: clientEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: clientEmail,
        name: clientProfile?.full_name || undefined,
        metadata: { supabase_user_id: appt.client_id },
      });
      customerId = customer.id;
    }

    // Build checkout session params
    const origin = Deno.env.get("PUBLIC_SITE_URL") || req.headers.get("origin") || "http://localhost:8080";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${serviceName} at ${salon.name}` },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          appointment_id: appt.id,
          salon_id: appt.salon_id,
          type: "post_service_payment",
        },
      },
      success_url: `${origin}/dashboard/appointments?payment=success`,
      cancel_url: `${origin}/dashboard/appointments?payment=cancelled`,
      metadata: {
        appointment_id: appt.id,
        salon_id: appt.salon_id,
        type: "post_service_payment",
      },
    };

    // Add transfer to salon's Connect account if available
    if (salon.stripe_account_id) {
      sessionParams.payment_intent_data.transfer_data = {
        destination: salon.stripe_account_id,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Update appointment payment_status to link_sent
    await supabaseAdmin
      .from("appointments")
      .update({ payment_status: "link_sent" })
      .eq("id", appointment_id);

    // Try to send SMS if Twilio is configured and client has a phone
    let smsSent = false;
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
    const clientPhone = clientProfile?.phone;

    if (twilioSid && twilioAuth && twilioPhone && clientPhone) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const smsBody = `Hi ${clientProfile?.full_name || "there"}! Here's your payment link for ${serviceName} at ${salon.name}: ${session.url}`;

        const smsRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: clientPhone,
            From: twilioPhone,
            Body: smsBody,
          }),
        });

        if (smsRes.ok) {
          smsSent = true;
          console.log("Payment link SMS sent to", clientPhone);
        } else {
          console.error("SMS send failed:", await smsRes.text());
        }
      } catch (smsErr) {
        console.error("SMS error:", smsErr);
      }
    }

    return new Response(JSON.stringify({
      url: session.url,
      sms_sent: smsSent,
      client_phone: clientPhone ? `***${clientPhone.slice(-4)}` : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Send payment link error:", error);
    const message = error.message || "Unknown error";
    let status = 500;
    if (message.includes("STRIPE_SECRET_KEY")) status = 501;
    else if (message.includes("Invalid API Key")) status = 502;
    else if (message.includes("Not authenticated") || message.includes("Not authorized")) status = 401;
    else if (message.includes("required")) status = 400;
    else if (message.includes("not found")) status = 404;
    else if (message.includes("must be completed") || message.includes("already paid")) status = 409;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
