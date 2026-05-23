import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { salon_id, type, rows } = await req.json();
    if (!salon_id || !type || !rows?.length) throw new Error("Missing salon_id, type, or rows");

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify salon ownership
    const { data: salon } = await supabaseAdmin.from("salons").select("id, owner_id").eq("id", salon_id).single();
    if (!salon || salon.owner_id !== user.id) throw new Error("Not authorized");

    // Create import job
    const { data: job } = await supabaseAdmin.from("import_jobs").insert({
      salon_id,
      type,
      status: "processing",
      total_rows: rows.length,
    }).select().single();

    let processed = 0;
    const errors: any[] = [];

    if (type === "clients") {
      // For each client row, invite them via auth (invite by email)
      for (const row of rows) {
        const email = (row.email || row.Email || "").trim();
        const name = (row.name || row.Name || row.full_name || "").trim();
        const phone = (row.phone || row.Phone || "").trim();
        if (!email) { errors.push({ row, error: "Missing email" }); continue; }

        try {
          // Create user via admin invite
          const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: name, role: "client" },
          });
          if (inviteErr) {
            // User may already exist — try to just create/update profile
            if (inviteErr.message?.includes("already been registered")) {
              // Look up existing user
              const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
              const existing = users?.find((u: any) => u.email === email);
              if (existing) {
                // Ensure profile exists
                await supabaseAdmin.from("profiles").upsert({
                  user_id: existing.id,
                  full_name: name || existing.user_metadata?.full_name,
                  phone: phone || null,
                }, { onConflict: "user_id" });
                processed++;
                continue;
              }
            }
            errors.push({ email, error: inviteErr.message });
            continue;
          }

          // Update profile with phone if provided
          if (invited?.user && phone) {
            await supabaseAdmin.from("profiles").update({ phone }).eq("user_id", invited.user.id);
          }
          processed++;
        } catch (err) {
          errors.push({ email, error: err.message });
        }
      }
    } else if (type === "services") {
      const toInsert = rows.map((r: any) => ({
        salon_id,
        name: (r.name || r.Name || "").trim(),
        price: parseFloat(r.price || r.Price || "0"),
        duration_minutes: parseInt(r.duration || r.Duration || r.duration_minutes || "60"),
        category: (r.category || r.Category || "").trim() || null,
      })).filter((s: any) => s.name);

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabaseAdmin.from("services").insert(toInsert);
        if (insertErr) { errors.push({ error: insertErr.message }); }
        else { processed = toInsert.length; }
      }
    }

    // Update job
    await supabaseAdmin.from("import_jobs").update({
      status: errors.length > 0 ? (processed > 0 ? "complete" : "failed") : "complete",
      processed_rows: processed,
      errors: errors.length > 0 ? errors : [],
    }).eq("id", job!.id);

    return new Response(JSON.stringify({ processed, errors: errors.length, job_id: job!.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
