import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const callerId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller is salon_admin
    const { data: roleData } = await adminClient.from("user_roles").select("role").eq("user_id", callerId).eq("role", "salon_admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only salon admins can invite stylists" }), { status: 403, headers: corsHeaders });
    }

    // Get caller's salon
    const { data: salon } = await adminClient.from("salons").select("id, name").eq("owner_id", callerId).maybeSingle();
    if (!salon) {
      return new Response(JSON.stringify({ error: "No salon found" }), { status: 400, headers: corsHeaders });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: corsHeaders });
    }

    // Check if user exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

    if (existingUser) {
      // User exists — add stylist role and profile
      const { data: existingRole } = await adminClient.from("user_roles").select("id").eq("user_id", existingUser.id).eq("role", "stylist").maybeSingle();
      if (!existingRole) {
        await adminClient.from("user_roles").insert({ user_id: existingUser.id, role: "stylist" });
      }

      const { data: existingProfile } = await adminClient.from("stylist_profiles").select("id").eq("user_id", existingUser.id).eq("salon_id", salon.id).maybeSingle();
      if (!existingProfile) {
        await adminClient.from("stylist_profiles").insert({ user_id: existingUser.id, salon_id: salon.id });
      }

      return new Response(JSON.stringify({ success: true, message: "Existing user added as stylist" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      // Generate invite link instead of using Supabase's generic email
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: { role: "stylist", salon_id: salon.id } },
      });

      if (linkError) {
        return new Response(JSON.stringify({ error: linkError.message }), { status: 400, headers: corsHeaders });
      }

      const confirmUrl = linkData?.properties?.action_link;
      if (!confirmUrl) {
        return new Response(JSON.stringify({ error: "Failed to generate invite link" }), { status: 500, headers: corsHeaders });
      }

      // Send branded email via Resend
      if (RESEND_API_KEY) {
        const salonName = salon.name || "Your salon";
        const html = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 24px; font-weight: 300; color: #7B61FF; margin: 0;">Prism</h1>
            </div>
            <h2 style="font-size: 20px; font-weight: 500; margin-bottom: 8px; color: #1a1a1a;">You're invited to join ${salonName}</h2>
            <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
              ${salonName} uses <strong>Prism</strong> to manage appointments, clients, and more.
              You've been invited to join as a stylist.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${confirmUrl}" style="display: inline-block; background: #7B61FF; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 999px; font-size: 16px; font-weight: 500;">
                Accept Invitation
              </a>
            </div>
            <p style="color: #999; font-size: 13px; line-height: 1.5; margin-top: 32px;">
              Once you accept, you'll be able to set up your profile, view your schedule, and manage appointments at ${salonName}.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
            <p style="color: #bbb; font-size: 11px; text-align: center;">Sent via Prism &mdash; Salon management, elevated.</p>
          </div>
        `;

        const fromAddress = Deno.env.get("EMAIL_FROM") || "Prism <onboarding@resend.dev>";
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: fromAddress,
            to: [email],
            subject: `You're invited to join ${salonName} on Prism`,
            html,
          }),
        });

        const resendData = await resendRes.json();
        if (!resendRes.ok) {
          console.error("Resend error:", resendData);
          return new Response(JSON.stringify({ error: "Failed to send invitation email", details: resendData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ success: true, message: "Invitation email sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        // Fallback: use Supabase's built-in invite if Resend not configured
        const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { role: "stylist", salon_id: salon.id },
        });
        if (inviteError) {
          return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: corsHeaders });
        }
        return new Response(JSON.stringify({ success: true, message: "Invitation email sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
