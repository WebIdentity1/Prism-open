import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.user.id;
    const { conversationId, body, channel, recipientIds, subject, type } = await req.json();

    // If creating a new conversation
    let finalConversationId = conversationId;
    if (!conversationId && recipientIds?.length > 0) {
      // Create conversation
      const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({
          created_by: userId,
          type: type || "direct",
          subject: subject || null,
        })
        .select()
        .single();

      if (convError) throw convError;
      finalConversationId = conv.id;

      // Add participants (sender + recipients)
      const participants = [userId, ...recipientIds].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
      }));

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;
    }

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: finalConversationId,
        sender_id: userId,
        body,
        delivery_channel: channel || "platform",
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Update conversation updated_at
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", finalConversationId);

    // Handle external delivery
    if (channel === "email" || channel === "sms") {
      // Get recipient info
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", finalConversationId)
        .neq("user_id", userId);

      const recipientUserIds = participants?.map((p) => p.user_id) || [];

      // Get profiles for contact info
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", recipientUserIds);

      // Get emails from auth (via admin client)
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      if (channel === "email") {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) {
          console.warn("RESEND_API_KEY not configured, skipping email delivery");
        } else {
          const resend = new Resend(resendKey);
          const fromAddress = Deno.env.get("EMAIL_FROM") || "Prism <onboarding@resend.dev>";

          for (const recipientId of recipientUserIds) {
            const { data: userData } = await adminClient.auth.admin.getUserById(recipientId);
            const email = userData?.user?.email;
            const profile = profiles?.find((p) => p.user_id === recipientId);

            if (email) {
              await resend.emails.send({
                from: fromAddress,
                to: email,
                subject: subject || "New message from Prism",
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">New Message</h2>
                    <p style="color: #666; font-size: 16px;">${body}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="color: #999; font-size: 12px;">
                      Log in to Prism to reply.
                    </p>
                  </div>
                `,
              });
            }
          }
        }
      }

      if (channel === "sms") {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioSid || !twilioToken || !twilioPhone) {
          console.warn("Twilio credentials not configured, skipping SMS delivery");
        } else {
          for (const recipientId of recipientUserIds) {
            const profile = profiles?.find((p) => p.user_id === recipientId);
            const phone = profile?.phone;

            if (phone) {
              const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
              const auth = btoa(`${twilioSid}:${twilioToken}`);

              await fetch(twilioUrl, {
                method: "POST",
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  From: twilioPhone,
                  To: phone,
                  Body: body.substring(0, 160), // SMS char limit
                }),
              });
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message, conversationId: finalConversationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
