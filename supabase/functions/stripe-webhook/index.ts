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

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log("Stripe event received:", event.type);

  try {
    switch (event.type) {
      // ── Checkout completed (booking deposit/full payment) ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const appointmentId = session.metadata?.appointment_id;

        if (appointmentId) {
          // Check if this is a post-service payment
          const isPostService = session.metadata?.type === "post_service_payment";

          if (isPostService) {
            // Mark as paid without changing appointment status
            const { error } = await supabaseAdmin
              .from("appointments")
              .update({ payment_status: "paid" })
              .eq("id", appointmentId);

            if (error) console.error("Failed to update payment status:", error);
            else console.log("Post-service payment completed:", appointmentId);
          } else {
            // Booking deposit/payment — confirm appointment
            const { error } = await supabaseAdmin
              .from("appointments")
              .update({ status: "confirmed" })
              .eq("id", appointmentId);

            if (error) console.error("Failed to confirm appointment:", error);
            else console.log("Appointment confirmed:", appointmentId);
          }
        }

        // Handle membership checkout
        const tierId = session.metadata?.tier_id;
        const clientId = session.metadata?.client_id;
        const salonId = session.metadata?.salon_id;

        if (tierId && clientId && salonId) {
          const now = new Date();
          const periodEnd = new Date(now);
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          const { error } = await supabaseAdmin
            .from("client_memberships")
            .upsert({
              client_id: clientId,
              salon_id: salonId,
              tier_id: tierId,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            }, { onConflict: "client_id,salon_id" });

          if (error) console.error("Failed to activate membership:", error);
          else console.log("Membership activated for client:", clientId);
        }
        break;
      }

      // ── Payment failed ──
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const appointmentId = paymentIntent.metadata?.appointment_id;

        if (appointmentId) {
          // Keep appointment as booked but log the failure
          console.error("Payment failed for appointment:", appointmentId,
            "Reason:", paymentIntent.last_payment_error?.message);
        }
        break;
      }

      // ── Subscription updated (membership changes) ──
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const clientId = subscription.metadata?.client_id;
        const salonId = subscription.metadata?.salon_id;

        if (clientId && salonId) {
          const status = subscription.status === "active" ? "active"
            : subscription.status === "past_due" ? "past_due"
            : subscription.status === "canceled" ? "cancelled"
            : subscription.status;

          const { error } = await supabaseAdmin
            .from("client_memberships")
            .update({
              status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("client_id", clientId)
            .eq("salon_id", salonId);

          if (error) console.error("Failed to update membership:", error);
          else console.log("Membership updated:", clientId, status);
        }
        break;
      }

      // ── Subscription deleted (membership cancelled) ──
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const clientId = subscription.metadata?.client_id;
        const salonId = subscription.metadata?.salon_id;

        if (clientId && salonId) {
          const { error } = await supabaseAdmin
            .from("client_memberships")
            .update({ status: "cancelled" })
            .eq("client_id", clientId)
            .eq("salon_id", salonId);

          if (error) console.error("Failed to cancel membership:", error);
          else console.log("Membership cancelled:", clientId);
        }
        break;
      }

      // ── Connect account updated ──
      case "account.updated": {
        const account = event.data.object as any;
        if (account.id && account.charges_enabled) {
          // Update salon with confirmed stripe_account_id
          const { error } = await supabaseAdmin
            .from("salons")
            .update({ stripe_account_id: account.id })
            .eq("stripe_account_id", account.id);
          if (!error) console.log("Connect account verified:", account.id);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
