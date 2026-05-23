import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import {
  buildDemoSeedingDisabledResponse,
  isDemoSeedingEnabled,
} from "../_shared/demo-seeding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMO_USERS = [
  { email: "demo-client@prism.app", password: "demo1234", role: "client", fullName: "Demo Client" },
  { email: "demo-stylist@prism.app", password: "demo1234", role: "stylist", fullName: "Demo Stylist" },
  { email: "demo-admin@prism.app", password: "demo1234", role: "salon_admin", fullName: "Demo Salon Owner" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!isDemoSeedingEnabled(Deno.env)) {
    return buildDemoSeedingDisabledResponse(corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: { email: string; status: string }[] = [];

    for (const user of DEMO_USERS) {
      // Check if user already exists by trying to sign in
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === user.email);

      if (existing) {
        results.push({ email: user.email, status: "already exists" });
        continue;
      }

      // Create user with auto-confirm
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName, role: user.role },
      });

      if (error) {
        results.push({ email: user.email, status: `error: ${error.message}` });
      } else {
        results.push({ email: user.email, status: "created" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-demo-users error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
