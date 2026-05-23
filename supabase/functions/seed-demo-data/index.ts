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
  { email: "demo-client@prism.app", password: "demo1234", role: "client", fullName: "Maya Johnson" },
  { email: "demo-stylist@prism.app", password: "demo1234", role: "stylist", fullName: "Alex Rivera" },
  { email: "demo-admin@prism.app", password: "demo1234", role: "salon_admin", fullName: "Jordan Chen" },
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

    const log: string[] = [];

    // ── 1. Ensure demo users exist ──
    const userIds: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users?.find((x) => x.email === u.email);
      if (existing) {
        userIds[u.role] = existing.id;
        log.push(`${u.role} user exists (${u.email})`);
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName, role: u.role },
        });
        if (error) throw new Error(`Failed to create ${u.role}: ${error.message}`);
        userIds[u.role] = data.user.id;
        log.push(`Created ${u.role} user (${u.email})`);
      }
    }

    const clientId = userIds["client"];
    const stylistId = userIds["stylist"];
    const adminId = userIds["salon_admin"];

    // ── 1b. Profiles ──
    const profilesDef = [
      { user_id: clientId, full_name: "Maya Johnson", phone: "(310) 555-0101" },
      { user_id: stylistId, full_name: "Alex Rivera", phone: "(310) 555-0102" },
      { user_id: adminId, full_name: "Jordan Chen", phone: "(310) 555-0103" },
    ];
    for (const p of profilesDef) {
      const { data: existing } = await admin.from("profiles").select("id").eq("user_id", p.user_id).maybeSingle();
      if (!existing) {
        await admin.from("profiles").insert(p);
        log.push(`Created profile for ${p.full_name}`);
      } else {
        await admin.from("profiles").update({ full_name: p.full_name, phone: p.phone }).eq("user_id", p.user_id);
        log.push(`Updated profile for ${p.full_name}`);
      }
    }

    // ── 1c. User roles ──
    const rolesDef: { user_id: string; role: string }[] = [
      { user_id: clientId, role: "client" },
      { user_id: stylistId, role: "stylist" },
      { user_id: adminId, role: "salon_admin" },
    ];
    for (const r of rolesDef) {
      const { data: existing } = await admin.from("user_roles").select("id").eq("user_id", r.user_id).eq("role", r.role).maybeSingle();
      if (!existing) {
        await admin.from("user_roles").insert(r);
        log.push(`Created role ${r.role}`);
      }
    }

    // ── 1d. Client profile ──
    const { data: existingClientProfile } = await admin.from("client_profiles").select("id").eq("user_id", clientId).maybeSingle();
    if (!existingClientProfile) {
      await admin.from("client_profiles").insert({
        user_id: clientId,
        hair_type: "2B - Wavy",
        hair_length: "Medium",
        hair_texture: "Medium density, slight frizz",
        product_preferences: ["Sulfate-free shampoo", "Leave-in conditioner", "Heat protectant"],
        allergies: ["PPD (hair dye)"],
      });
      log.push("Created client profile");
    } else {
      log.push("Client profile exists");
    }

    // ── 2. Salon ──
    const { data: existingSalons } = await admin.from("salons").select("id").eq("owner_id", adminId).limit(1);
    let salonId: string;
    if (existingSalons && existingSalons.length > 0) {
      salonId = existingSalons[0].id;
      log.push("Salon already exists");
    } else {
      const { data: salon, error } = await admin.from("salons").insert({
        owner_id: adminId,
        name: "Prism Studio",
        description: "A modern, AI-powered salon experience. Walk in confident, walk out radiant.",
        address: "742 Evergreen Terrace",
        city: "Los Angeles",
        state: "CA",
        zip: "90210",
        phone: "(310) 555-0199",
        email: "hello@prismstudio.com",
        website: "https://prismstudio.com",
        hours: {
          mon: { open: "09:00", close: "18:00" },
          tue: { open: "09:00", close: "18:00" },
          wed: { open: "09:00", close: "18:00" },
          thu: { open: "09:00", close: "20:00" },
          fri: { open: "09:00", close: "20:00" },
          sat: { open: "10:00", close: "16:00" },
          sun: null,
        },
      }).select("id").single();
      if (error) throw new Error(`Salon insert: ${error.message}`);
      salonId = salon.id;
      log.push("Created salon");
    }

    // ── 3. Services ──
    const servicesDef = [
      { name: "Precision Haircut", description: "Customized cut with consultation", category: "Cuts", duration_minutes: 45, price: 65, member_price: 55 },
      { name: "Full Color", description: "Single-process all-over color", category: "Color", duration_minutes: 90, price: 120, member_price: 100 },
      { name: "Balayage", description: "Hand-painted highlights for a natural sun-kissed look", category: "Color", duration_minutes: 150, price: 250, member_price: 220 },
      { name: "Blowout & Style", description: "Wash, blow-dry and style", category: "Styling", duration_minutes: 45, price: 55, member_price: 45 },
      { name: "Deep Conditioning Treatment", description: "Intensive moisture therapy for damaged hair", category: "Treatments", duration_minutes: 30, price: 40, member_price: 35 },
    ];

    const { data: existingServices } = await admin.from("services").select("id, name").eq("salon_id", salonId);
    const existingNames = new Set((existingServices || []).map((s) => s.name));
    const newServices = servicesDef.filter((s) => !existingNames.has(s.name));
    let serviceIds: string[] = (existingServices || []).map((s) => s.id);

    if (newServices.length > 0) {
      const { data: inserted, error } = await admin.from("services").insert(
        newServices.map((s) => ({ ...s, salon_id: salonId }))
      ).select("id");
      if (error) throw new Error(`Services insert: ${error.message}`);
      serviceIds = [...serviceIds, ...(inserted || []).map((s) => s.id)];
      log.push(`Created ${newServices.length} services`);
    } else {
      log.push("Services already exist");
    }

    // ── 4. Stylist profile ──
    const { data: existingStylist } = await admin.from("stylist_profiles").select("id").eq("user_id", stylistId).limit(1);
    if (!existingStylist || existingStylist.length === 0) {
      const { error } = await admin.from("stylist_profiles").insert({
        user_id: stylistId,
        salon_id: salonId,
        bio: "10+ years specializing in precision cuts and balayage. Passionate about helping clients discover their signature look.",
        specialties: ["Balayage", "Precision Cuts", "Curly Hair", "Color Correction"],
        years_experience: 12,
        commission_rate: 55,
      });
      if (error) throw new Error(`Stylist profile: ${error.message}`);
      log.push("Created stylist profile");
    } else {
      log.push("Stylist profile exists");
    }

    // ── 5. Stylist availability (Mon-Sat) ──
    const { data: existingAvail } = await admin.from("stylist_availability").select("id").eq("stylist_id", stylistId).limit(1);
    if (!existingAvail || existingAvail.length === 0) {
      const avail = [];
      for (let day = 1; day <= 5; day++) {
        avail.push({ stylist_id: stylistId, salon_id: salonId, day_of_week: day, start_time: "09:00", end_time: "17:00" });
      }
      avail.push({ stylist_id: stylistId, salon_id: salonId, day_of_week: 6, start_time: "10:00", end_time: "15:00" });
      const { error } = await admin.from("stylist_availability").insert(avail);
      if (error) throw new Error(`Availability: ${error.message}`);
      log.push("Created stylist availability");
    } else {
      log.push("Stylist availability exists");
    }

    // ── 6. Style gallery ──
    const galleryDef = [
      { name: "Classic Bob", image_url: "/styles/classic-bob.png", category: "Bobs", gender: "female", hair_length: "short", compatible_face_shapes: ["oval", "heart", "diamond"], compatible_hair_types: ["straight", "wavy"], tags: ["classic", "sleek", "professional"], description: "A timeless chin-length bob that works for almost every face shape." },
      { name: "Textured Crop", image_url: "/styles/textured-crop.png", category: "Short", gender: "male", hair_length: "short", compatible_face_shapes: ["oval", "square", "diamond"], compatible_hair_types: ["straight", "wavy", "curly"], tags: ["textured", "modern", "low-maintenance"], description: "A modern textured crop with natural movement and easy styling." },
      { name: "Beach Waves", image_url: "/styles/beach-waves.png", category: "Waves", gender: "female", hair_length: "long", compatible_face_shapes: ["oval", "square", "oblong", "heart"], compatible_hair_types: ["wavy", "curly"], tags: ["effortless", "beachy", "romantic"], description: "Loose, tousled waves that evoke a carefree coastal vibe." },
      { name: "Modern Pompadour", image_url: "/styles/modern-pompadour.png", category: "Classic", gender: "male", hair_length: "medium", compatible_face_shapes: ["oval", "round", "square"], compatible_hair_types: ["straight", "wavy"], tags: ["bold", "retro", "statement"], description: "A contemporary take on the classic pompadour with added volume and texture." },
      { name: "Curtain Bangs", image_url: "/styles/curtain-bangs-female.png", category: "Bangs", gender: "female", hair_length: "medium", compatible_face_shapes: ["oval", "round", "heart", "oblong"], compatible_hair_types: ["straight", "wavy"], tags: ["face-framing", "soft", "versatile"], description: "Soft face-framing bangs that part in the middle for a flattering, retro-modern look." },
      { name: "Wolf Cut", image_url: "/styles/wolf-cut.png", category: "Layered", gender: "female", hair_length: "medium", compatible_face_shapes: ["oval", "square", "diamond", "heart"], compatible_hair_types: ["straight", "wavy", "curly"], tags: ["edgy", "layered", "trendy"], description: "A shaggy, heavily layered cut combining elements of a mullet and a shag." },
      { name: "Butterfly Cut", image_url: "/styles/butterfly-cut.png", category: "Layered", gender: "female", hair_length: "long", compatible_face_shapes: ["oval", "round", "oblong"], compatible_hair_types: ["straight", "wavy", "curly"], tags: ["voluminous", "layered", "flowing"], description: "Dramatic face-framing layers that create a butterfly-wing silhouette." },
      { name: "Taper Fade", image_url: "/styles/taper-fade.png", category: "Fades", gender: "male", hair_length: "short", compatible_face_shapes: ["oval", "round", "square", "diamond"], compatible_hair_types: ["straight", "wavy", "curly", "coily"], tags: ["clean", "versatile", "sharp"], description: "A graduated fade from longer on top to skin-tight at the sides." },
    ];

    const { data: existingGallery } = await admin.from("style_gallery").select("id, name").limit(50);
    const existingGalleryNames = new Set((existingGallery || []).map((g) => g.name));
    const newGallery = galleryDef.filter((g) => !existingGalleryNames.has(g.name));
    let galleryIds: string[] = (existingGallery || []).map((g) => g.id);

    if (newGallery.length > 0) {
      const { data: inserted, error } = await admin.from("style_gallery").insert(newGallery).select("id");
      if (error) throw new Error(`Style gallery: ${error.message}`);
      galleryIds = [...galleryIds, ...(inserted || []).map((g) => g.id)];
      log.push(`Created ${newGallery.length} style gallery entries`);
    } else {
      log.push("Style gallery already populated");
    }

    // ── 7. Consultations ──
    const { data: existingConsults } = await admin.from("consultations").select("id, status").eq("client_id", clientId);
    let consultationIds: string[] = (existingConsults || []).map((c) => c.id);

    if (!existingConsults || existingConsults.length === 0) {
      const consultations = [
        {
          client_id: clientId,
          stylist_id: stylistId,
          salon_id: salonId,
          status: "submitted",
          face_shape: "oval",
          face_shape_confidence: 0.87,
          face_analysis_notes: "Balanced proportions with a slightly narrower forehead. Oval faces are versatile — most styles work well. Consider styles that add width at the temples.",
          client_notes: "I want something fresh for summer. Open to going shorter but nothing above the chin.",
          selfie_url: null,
        },
        {
          client_id: clientId,
          stylist_id: stylistId,
          salon_id: salonId,
          status: "reviewed",
          face_shape: "heart",
          face_shape_confidence: 0.79,
          face_analysis_notes: "Wider forehead with a narrower chin. Best styles add width at the jawline and soften the forehead. Side-swept bangs and chin-length cuts work beautifully.",
          client_notes: "Looking for a style that softens my forehead. I've been growing my hair out.",
          stylist_notes: "Recommended curtain bangs with soft layers. Would complement her face shape and hair texture perfectly. Suggested balayage to add dimension.",
          selfie_url: null,
        },
        {
          client_id: clientId,
          stylist_id: stylistId,
          salon_id: salonId,
          status: "completed",
          face_shape: "round",
          face_shape_confidence: 0.91,
          face_analysis_notes: "Equal width and length with soft angles. Best styles add height and length to create the illusion of an elongated face. Avoid blunt bobs that emphasize roundness.",
          client_notes: "Want to try something that makes my face look slimmer. Currently have a lob.",
          stylist_notes: "Did a layered wolf cut with curtain bangs. The layers create vertical lines that elongate her face. She loved the result. Rebooked for color in 4 weeks.",
          selfie_url: null,
        },
      ];

      const { data: inserted, error } = await admin.from("consultations").insert(consultations).select("id");
      if (error) throw new Error(`Consultations: ${error.message}`);
      consultationIds = (inserted || []).map((c) => c.id);
      log.push("Created 3 consultations");
    } else {
      log.push("Consultations already exist");
    }

    // ── 8. Style board items ──
    if (consultationIds.length > 0 && galleryIds.length > 0) {
      const { data: existingItems } = await admin.from("style_board_items").select("id").eq("user_id", clientId).limit(1);
      if (!existingItems || existingItems.length === 0) {
        const items = [
          { consultation_id: consultationIds[0], user_id: clientId, style_id: galleryIds[0] || null, inspiration_url: "/styles/classic-bob.png", notes: "Love this length!", is_selected: true },
          { consultation_id: consultationIds[0], user_id: clientId, style_id: galleryIds[2] || null, inspiration_url: "/styles/beach-waves.png", notes: "Could this work with shorter hair?", is_selected: false },
          { consultation_id: consultationIds[1], user_id: clientId, style_id: galleryIds[4] || null, inspiration_url: "/styles/curtain-bangs-female.png", notes: "These bangs are exactly what I want", is_selected: true },
          { consultation_id: consultationIds[1], user_id: clientId, style_id: galleryIds[5] || null, inspiration_url: "/styles/wolf-cut.png", notes: "A bit too edgy for me but love the layers", is_selected: false },
          { consultation_id: consultationIds[2], user_id: clientId, style_id: galleryIds[6] || null, inspiration_url: "/styles/butterfly-cut.png", notes: "This is the one we went with!", is_selected: true },
        ];
        const { error } = await admin.from("style_board_items").insert(items);
        if (error) throw new Error(`Style board items: ${error.message}`);
        log.push("Created 5 style board items");
      } else {
        log.push("Style board items exist");
      }
    }

    // ── 9. Membership tiers ──
    const { data: existingTiers } = await admin.from("membership_tiers").select("id, name").eq("salon_id", salonId);
    const existingTierNames = new Set((existingTiers || []).map((t: any) => t.name));
    const tiersDef = [
      { name: "Basic", price: 49, billing_interval: "monthly", cleanup_window_start: 12, cleanup_window_end: 20, max_credits: 1 },
      { name: "Premium", price: 89, billing_interval: "monthly", cleanup_window_start: 10, cleanup_window_end: 22, max_credits: 2 },
      { name: "VIP", price: 149, billing_interval: "monthly", cleanup_window_start: 8, cleanup_window_end: 25, max_credits: 3 },
    ];
    const newTiers = tiersDef.filter((t) => !existingTierNames.has(t.name));
    if (newTiers.length > 0) {
      const { error } = await admin.from("membership_tiers").insert(newTiers.map((t) => ({ ...t, salon_id: salonId })));
      if (error) throw new Error(`Membership tiers: ${error.message}`);
      log.push(`Created ${newTiers.length} membership tiers`);
    } else {
      log.push("Membership tiers already exist");
    }

    // ── 10. Appointments ──
    const { data: existingAppts } = await admin.from("appointments").select("id").eq("client_id", clientId).limit(1);
    if (!existingAppts || existingAppts.length === 0) {
      const now = new Date();
      const day = (offset: number, hour: number, min = 0) => {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        d.setHours(hour, min, 0, 0);
        return d.toISOString();
      };

      const appointments = [
        // Past – completed
        { client_id: clientId, stylist_id: stylistId, salon_id: salonId, service_id: serviceIds[0] || null, consultation_id: consultationIds[2] || null, start_time: day(-14, 10), end_time: day(-14, 10, 45), status: "completed", notes: "Wolf cut consultation & cut" },
        { client_id: clientId, stylist_id: stylistId, salon_id: salonId, service_id: serviceIds[1] || null, consultation_id: null, start_time: day(-7, 14), end_time: day(-7, 15, 30), status: "completed", notes: "Full color – warm brunette" },
        // Past – cancelled
        { client_id: clientId, stylist_id: stylistId, salon_id: salonId, service_id: serviceIds[3] || null, consultation_id: null, start_time: day(-3, 11), end_time: day(-3, 11, 45), status: "cancelled", notes: "Client rescheduled" },
        // Upcoming – confirmed
        { client_id: clientId, stylist_id: stylistId, salon_id: salonId, service_id: serviceIds[2] || null, consultation_id: consultationIds[1] || null, start_time: day(3, 13), end_time: day(3, 15, 30), status: "confirmed", notes: "Balayage – natural blonde" },
        // Upcoming – booked
        { client_id: clientId, stylist_id: stylistId, salon_id: salonId, service_id: serviceIds[4] || null, consultation_id: null, start_time: day(10, 10), end_time: day(10, 10, 30), status: "booked", notes: "Deep conditioning follow-up" },
      ];

      const { error } = await admin.from("appointments").insert(appointments);
      if (error) throw new Error(`Appointments: ${error.message}`);
      log.push("Created 5 appointments");
    } else {
      log.push("Appointments already exist");
    }

    // ── 11. Client-Staff Assignment ──
    const { data: existingAssignment } = await admin
      .from("client_staff_assignments")
      .select("id")
      .eq("client_id", clientId)
      .eq("salon_id", salonId)
      .maybeSingle();

    if (!existingAssignment) {
      await admin.from("client_staff_assignments").insert({
        client_id: clientId,
        stylist_id: stylistId,
        salon_id: salonId,
      });
      log.push("Created client-staff assignment (Maya → Alex)");
    } else {
      log.push("Client-staff assignment already exists");
    }

    return new Response(JSON.stringify({ success: true, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-demo-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
