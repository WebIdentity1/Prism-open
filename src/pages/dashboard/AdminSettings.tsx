import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Settings, Database, Loader2, CheckCircle2, AlertCircle, Clock, DollarSign, Bell, Crown, Plus, Pencil, Trash2, ToggleLeft, Layers, FileText, TrendingUp, TrendingDown, Globe, BarChart3, X, Gift, Star, Users, Palette, Link2, Copy, ExternalLink, RefreshCw, Apple, Unlink, Image, Eye, EyeOff, Search, Upload, Sparkles } from "lucide-react";
import { type SurgeRule, type OffpeakRule, DAY_OPTIONS, HOUR_OPTIONS } from "@/lib/pricing";
import StylistLevels from "@/components/dashboard/StylistLevels";
import BrandingSettings from "@/components/dashboard/BrandingSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { isDemoLoginEnabled } from "@/lib/demo-login";

/* ── Google Business Profile Card ── */
const GoogleBusinessCard = ({ salon, onSalonUpdate }: { salon: any; onSalonUpdate: (u: any) => void }) => {
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const isConnected = !!salon.google_bp_tokens?.refresh_token;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/dashboard/settings`;
      const { data, error } = await supabase.functions.invoke("google-bp-auth", {
        body: { action: "get_auth_url", salon_id: salon.id, redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (data?.auth_url) window.location.href = data.auth_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start Google auth");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-bp-auth", {
        body: { action: "disconnect", salon_id: salon.id },
      });
      if (error) throw error;
      onSalonUpdate({ google_bp_tokens: null, google_bp_account_id: null, google_bp_location_id: null, google_bp_last_sync: null });
      toast.success("Google Business Profile disconnected");
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async (actions: string[] = ["reviews", "hours", "booking_link"]) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-bp-sync", {
        body: {
          salon_id: salon.id,
          actions,
          booking_base_url: window.location.origin,
        },
      });
      if (error) throw error;
      onSalonUpdate({ google_bp_last_sync: new Date().toISOString() });
      const reviewCount = data?.results?.reviews?.synced;
      toast.success(`Sync complete${reviewCount ? ` — ${reviewCount} reviews synced` : ""}`);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (code && state === salon.id) {
      // Exchange the code
      const exchange = async () => {
        setConnecting(true);
        try {
          const { data, error } = await supabase.functions.invoke("google-bp-auth", {
            body: {
              action: "exchange_code",
              salon_id: salon.id,
              code,
              redirect_uri: `${window.location.origin}/dashboard/settings`,
            },
          });
          if (error) throw error;
          onSalonUpdate({
            google_bp_tokens: { refresh_token: "connected" }, // placeholder to show connected
            google_bp_account_id: data.account_id,
            google_bp_location_id: data.location_id,
          });
          toast.success("Google Business Profile connected!");
          // Clean URL
          window.history.replaceState({}, "", "/dashboard/settings");
        } catch (e: any) {
          toast.error(e.message || "Failed to connect Google account");
        } finally {
          setConnecting(false);
        }
      };
      exchange();
    }
  }, []);

  return (
    <Card className="glass rounded-xl border-0">
      <CardHeader className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5 text-primary" />Google Business Profile
            </CardTitle>
            <CardDescription>Sync reviews, photos, hours, and booking links with your Google listing</CardDescription>
          </div>
          {isConnected ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to manage your Business Profile directly from here — sync reviews, push photos, update hours, and set your booking link.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Connect Google Account
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Account</p>
                <p className="text-sm font-medium truncate">{salon.google_bp_account_id || "Connected"}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">Last Sync</p>
                <p className="text-sm font-medium">
                  {salon.google_bp_last_sync ? format(new Date(salon.google_bp_last_sync), "MMM d, h:mm a") : "Never"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleSync(["reviews"])} disabled={syncing} variant="outline" size="sm">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} /> Sync Reviews
              </Button>
              <Button onClick={() => handleSync(["hours"])} disabled={syncing} variant="outline" size="sm">
                <Clock className="h-3.5 w-3.5 mr-1.5" /> Push Hours
              </Button>
              <Button onClick={() => handleSync(["booking_link"])} disabled={syncing} variant="outline" size="sm">
                <Link2 className="h-3.5 w-3.5 mr-1.5" /> Set Booking Link
              </Button>
              <Button onClick={() => handleSync(["reviews", "hours", "booking_link"])} disabled={syncing} size="sm">
                {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Sync All
              </Button>
            </div>

            <div className="pt-2 border-t">
              <Button onClick={handleDisconnect} disabled={disconnecting} variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Unlink className="h-3.5 w-3.5 mr-1.5" /> Disconnect Google Account
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Apple Business Connect Card ── */
const AppleBusinessCard = ({ salonId }: { salonId: string }) => {
  const bookingUrl = `${window.location.origin}/join/${salonId}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success("Booking URL copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="glass rounded-xl border-0">
      <CardHeader className="p-6">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Apple className="h-5 w-5 text-primary" />Apple Business Connect
        </CardTitle>
        <CardDescription>Add a "Book" button on your Apple Maps listing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-muted space-y-3">
          <p className="text-sm font-medium">Setup Instructions</p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Go to <a href="https://businessconnect.apple.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Apple Business Connect</a> and sign in with your Apple ID</li>
            <li>Claim or verify your business listing</li>
            <li>Navigate to the <strong>Action Links</strong> section</li>
            <li>Select <strong>"Book"</strong> as the action type</li>
            <li>Paste your booking URL below into the link field</li>
            <li>Save and publish your changes</li>
          </ol>
        </div>

        <div className="space-y-2">
          <Label>Your Booking URL</Label>
          <div className="flex gap-2">
            <Input value={bookingUrl} readOnly className="font-mono text-xs" />
            <Button onClick={handleCopy} variant="outline" size="icon" className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Apple Business Connect API requires an approved Third-Party Partner agreement. Once we obtain partner access, this integration will become fully automated like Google Business Profile.
        </p>
      </CardContent>
    </Card>
  );
};


const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

const AdminSettings = () => {
  const { user } = useAuth(false);
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // General tab
  const [cancellationHours, setCancellationHours] = useState(24);
  const [depositPct, setDepositPct] = useState(20);
  const [paymentMode, setPaymentMode] = useState<"none" | "deposit" | "full">("none");
  const [defaultCommission, setDefaultCommission] = useState(50);
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>({});
  const [requireBookingForms, setRequireBookingForms] = useState(false);

  // Notifications tab
  const [notifPrefs, setNotifPrefs] = useState({
    booking_confirmed: true,
    booking_cancelled: true,
    consultation_submitted: true,
    appointment_reminder: true,
  });

  // Memberships tab
  const [tiers, setTiers] = useState<any[]>([]);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [tierForm, setTierForm] = useState({ name: "", price: "", billing_interval: "monthly", cleanup_window_start: "12", cleanup_window_end: "20", max_credits: "1" });

  // Seed
  const [seeding, setSeeding] = useState(false);
  const [seedLog, setSeedLog] = useState<string[] | null>(null);

  // Pricing tab
  const [surgeEnabled, setSurgeEnabled] = useState(false);
  const [surgeRules, setSurgeRules] = useState<SurgeRule[]>([]);
  const [offpeakEnabled, setOffpeakEnabled] = useState(false);
  const [offpeakRules, setOffpeakRules] = useState<OffpeakRule[]>([]);

  // Integrations tab
  const [googleReserveEnabled, setGoogleReserveEnabled] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaConversionsApiKey, setMetaConversionsApiKey] = useState("");
  const [googleAnalyticsId, setGoogleAnalyticsId] = useState("");

  // Loyalty tab
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [pointsPerDollar, setPointsPerDollar] = useState(1);
  const [pointsPerService, setPointsPerService] = useState(0);
  const [referralPoints, setReferralPoints] = useState(50);
  const [pointValueCents, setPointValueCents] = useState(1);

  // Styles tab
  const [styles, setStyles] = useState<any[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [styleCategory, setStyleCategory] = useState("all");
  const [styleGender, setStyleGender] = useState("all");
  const [styleSearch, setStyleSearch] = useState("");
  // Rename style
  const [renamingStyle, setRenamingStyle] = useState<{ id: string; name: string } | null>(null);
  // Add new style
  const [addStyleOpen, setAddStyleOpen] = useState(false);
  const [newStyleForm, setNewStyleForm] = useState({ name: "", category: "classic", gender: "unisex", hair_length: "medium", compatible_hair_types: ["straight", "wavy", "curly", "coily"] as string[], compatible_hair_thicknesses: ["fine", "medium", "thick"] as string[] });
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyLog, setClassifyLog] = useState<string[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: s } = await supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle();
      if (s) {
        setSalon(s);
        setCancellationHours(s.cancellation_window_hours ?? 24);
        setDepositPct(s.deposit_percentage ?? 20);
        setPaymentMode((s as any).payment_collection_mode || "none");
        setDefaultCommission((s as any).default_commission_rate ?? 50);
        setHours(typeof s.hours === "object" && s.hours ? (s.hours as any) : {});
        setRequireBookingForms((s as any).require_booking_forms ?? false);
        const np = (s as any).notification_preferences;
        if (np && typeof np === "object") setNotifPrefs({ ...notifPrefs, ...np });

        // Pricing
        setSurgeEnabled((s as any).surge_pricing_enabled ?? false);
        setSurgeRules(Array.isArray((s as any).surge_pricing_rules) ? (s as any).surge_pricing_rules : []);
        setOffpeakEnabled((s as any).offpeak_discounts_enabled ?? false);
        setOffpeakRules(Array.isArray((s as any).offpeak_discount_rules) ? (s as any).offpeak_discount_rules : []);

        // Integrations
        setGoogleReserveEnabled((s as any).google_reserve_enabled ?? false);
        setMetaPixelId((s as any).meta_pixel_id ?? "");
        setMetaConversionsApiKey((s as any).meta_conversions_api_key ?? "");
        setGoogleAnalyticsId((s as any).google_analytics_id ?? "");

        // Loyalty
        setLoyaltyEnabled((s as any).loyalty_enabled ?? false);
        setPointsPerDollar(Number((s as any).loyalty_points_per_dollar) || 1);
        setPointsPerService((s as any).loyalty_points_per_service ?? 0);
        setReferralPoints((s as any).loyalty_referral_points ?? 50);
        setPointValueCents((s as any).loyalty_point_value_cents ?? 1);

        // Fetch membership tiers
        const { data: tiersData } = await supabase.from("membership_tiers").select("*").eq("salon_id", s.id).order("price");
        setTiers(tiersData || []);

        // Fetch style gallery (all, including inactive)
        setStylesLoading(true);
        const { data: stylesData } = await supabase
          .from("style_gallery")
          .select("id, name, description, category, image_url, gender, hair_length, compatible_face_shapes, tags, is_active, created_at")
          .order("category")
          .order("name");
        setStyles(stylesData || []);
        setStylesLoading(false);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const saveGeneral = async () => {
    if (!salon) return;
    setSaving(true);
    const { error } = await supabase.from("salons").update({
      cancellation_window_hours: cancellationHours,
      deposit_percentage: depositPct,
      payment_collection_mode: paymentMode,
      default_commission_rate: defaultCommission,
      hours,
    } as any).eq("id", salon.id);
    if (error) toast.error("Failed to save");
    else toast.success("Settings saved");
    setSaving(false);
  };

  const saveNotifications = async () => {
    if (!salon) return;
    setSaving(true);
    const { error } = await supabase.from("salons").update({ notification_preferences: notifPrefs } as any).eq("id", salon.id);
    if (error) toast.error("Failed to save");
    else toast.success("Notification preferences saved");
    setSaving(false);
  };

  const savePricing = async () => {
    if (!salon) return;
    setSaving(true);
    const { error } = await supabase.from("salons").update({
      surge_pricing_enabled: surgeEnabled,
      surge_pricing_rules: surgeRules,
      offpeak_discounts_enabled: offpeakEnabled,
      offpeak_discount_rules: offpeakRules,
    } as any).eq("id", salon.id);
    if (error) toast.error("Failed to save");
    else toast.success("Pricing rules saved");
    setSaving(false);
  };

  const saveIntegrations = async () => {
    if (!salon) return;
    setSaving(true);
    const { error } = await supabase.from("salons").update({
      google_reserve_enabled: googleReserveEnabled,
      meta_pixel_id: metaPixelId || null,
      meta_conversions_api_key: metaConversionsApiKey || null,
      google_analytics_id: googleAnalyticsId || null,
    } as any).eq("id", salon.id);
    if (error) toast.error("Failed to save");
    else toast.success("Integrations saved");
    setSaving(false);
  };

  const saveLoyalty = async () => {
    if (!salon) return;
    setSaving(true);
    const { error } = await supabase.from("salons").update({
      loyalty_enabled: loyaltyEnabled,
      loyalty_points_per_dollar: pointsPerDollar,
      loyalty_points_per_service: pointsPerService,
      loyalty_referral_points: referralPoints,
      loyalty_point_value_cents: pointValueCents,
    } as any).eq("id", salon.id);
    if (error) toast.error("Failed to save");
    else toast.success("Loyalty settings saved");
    setSaving(false);
  };

  const updateHoursDay = (day: string, field: "open" | "close", value: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] ? { ...prev[day]!, [field]: value } : { open: "09:00", close: "18:00", [field]: value },
    }));
  };

  const addSurgeRule = () => {
    setSurgeRules([...surgeRules, { day_of_week: 6, start_hour: 10, end_hour: 14, multiplier: 1.2 }]);
  };

  const addOffpeakRule = () => {
    setOffpeakRules([...offpeakRules, { day_of_week: 1, start_hour: 9, end_hour: 12, discount_pct: 15 }]);
  };

  const toggleDayOpen = (day: string) => {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: "09:00", close: "18:00" },
    }));
  };

  const openTierDialog = (tier?: any) => {
    if (tier) {
      setEditingTier(tier);
      setTierForm({
        name: tier.name,
        price: String(tier.price),
        billing_interval: tier.billing_interval,
        cleanup_window_start: String(tier.cleanup_window_start),
        cleanup_window_end: String(tier.cleanup_window_end),
        max_credits: String(tier.max_credits),
      });
    } else {
      setEditingTier(null);
      setTierForm({ name: "", price: "", billing_interval: "monthly", cleanup_window_start: "12", cleanup_window_end: "20", max_credits: "1" });
    }
    setTierDialogOpen(true);
  };

  const saveTier = async () => {
    if (!salon || !tierForm.name || !tierForm.price) return;
    const payload = {
      salon_id: salon.id,
      name: tierForm.name,
      price: parseFloat(tierForm.price),
      billing_interval: tierForm.billing_interval,
      cleanup_window_start: parseInt(tierForm.cleanup_window_start) || 12,
      cleanup_window_end: parseInt(tierForm.cleanup_window_end) || 20,
      max_credits: parseInt(tierForm.max_credits) || 1,
    };

    if (editingTier) {
      const { error } = await supabase.from("membership_tiers").update(payload).eq("id", editingTier.id);
      if (error) { toast.error("Failed to update tier"); return; }
      setTiers(tiers.map((t) => (t.id === editingTier.id ? { ...t, ...payload } : t)));
      toast.success("Tier updated");
    } else {
      const { data, error } = await supabase.from("membership_tiers").insert(payload).select().single();
      if (error) { toast.error("Failed to create tier"); return; }
      setTiers([...tiers, data]);
      toast.success("Tier created");
    }
    setTierDialogOpen(false);
  };

  const toggleTierActive = async (tier: any) => {
    const { error } = await supabase.from("membership_tiers").update({ is_active: !tier.is_active }).eq("id", tier.id);
    if (error) { toast.error("Failed to update"); return; }
    setTiers(tiers.map((t) => (t.id === tier.id ? { ...t, is_active: !t.is_active } : t)));
  };

  const deleteTier = async (id: string) => {
    const { error } = await supabase.from("membership_tiers").delete().eq("id", id);
    if (error) { toast.error("Failed to delete tier"); return; }
    setTiers(tiers.filter((t) => t.id !== id));
    toast.success("Tier deleted");
  };

  const handleSeedDemoData = async () => {
    if (!demoModeEnabled) {
      toast.error("Demo mode is disabled. Enable it only in local or non-production environments.");
      return;
    }

    setSeeding(true);
    setSeedLog(null);
    try {
      const { data, error } = await supabase.functions.invoke("seed-demo-data");
      if (error) throw error;
      setSeedLog(data.log || []);
      toast.success("Demo data seeded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  };

  const toggleStyleActive = async (styleId: string, currentActive: boolean) => {
    const { error } = await supabase.from("style_gallery").update({ is_active: !currentActive } as any).eq("id", styleId);
    if (error) { toast.error("Failed to update style"); return; }
    setStyles(styles.map((s) => (s.id === styleId ? { ...s, is_active: !currentActive } : s)));
    toast.success(!currentActive ? "Style activated" : "Style hidden from consultations");
  };

  const handleRenameStyle = async () => {
    if (!renamingStyle || !renamingStyle.name.trim()) return;
    const { error } = await supabase.from("style_gallery").update({ name: renamingStyle.name.trim() } as any).eq("id", renamingStyle.id);
    if (error) { toast.error("Failed to rename style"); return; }
    setStyles(styles.map((s) => (s.id === renamingStyle.id ? { ...s, name: renamingStyle.name.trim() } : s)));
    toast.success("Style renamed");
    setRenamingStyle(null);
  };

  const handleReferenceFileChange = (file: File | null) => {
    setReferenceFile(file);
    if (referencePreview) URL.revokeObjectURL(referencePreview);
    setReferencePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleAddStyle = async () => {
    if (!newStyleForm.name.trim() || !referenceFile) return;
    setGenerating(true);
    try {
      // 1. Upload reference photo to Supabase storage
      const ext = referenceFile.name.split(".").pop() || "png";
      const refPath = `style-references/ref-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("consultation-photos").upload(refPath, referenceFile, { contentType: referenceFile.type });
      if (uploadErr) throw uploadErr;

      const { data: refUrlData } = supabase.storage.from("consultation-photos").getPublicUrl(refPath);
      const referenceImageUrl = refUrlData.publicUrl;

      // 2. Call edge function to generate mannequin image (mannequin is stored server-side in Supabase storage)
      const resp = await supabase.functions.invoke("generate-style-image", {
        body: { referenceImageUrl, styleName: newStyleForm.name.trim() },
      });
      if (resp.error) throw resp.error;
      if (resp.data?.error) throw new Error(resp.data.error);

      const generatedImageUrl = resp.data.imageUrl;

      // 3. Insert into style_gallery
      const { data: newStyle, error: insertErr } = await supabase
        .from("style_gallery")
        .insert({
          name: newStyleForm.name.trim(),
          category: newStyleForm.category,
          gender: newStyleForm.gender,
          hair_length: newStyleForm.hair_length,
          compatible_hair_types: newStyleForm.compatible_hair_types,
          compatible_hair_thicknesses: newStyleForm.compatible_hair_thicknesses,
          image_url: generatedImageUrl,
          is_active: true,
        } as any)
        .select()
        .single();

      if (insertErr) throw insertErr;
      setStyles([newStyle, ...styles]);
      toast.success("Style added successfully!");
      setAddStyleOpen(false);
      setNewStyleForm({ name: "", category: "classic", gender: "unisex", hair_length: "medium", compatible_hair_types: ["straight", "wavy", "curly", "coily"], compatible_hair_thicknesses: ["fine", "medium", "thick"] });
      handleReferenceFileChange(null);

      // Auto-classify the new style in the background (non-blocking)
      supabase.functions.invoke("classify-styles", {
        body: { styleIds: [newStyle.id] },
      }).then((resp) => {
        if (!resp.error && resp.data?.updated > 0) {
          // Refresh the style in the local list with AI-classified metadata
          supabase.from("style_gallery").select("*").eq("id", newStyle.id).single().then(({ data }) => {
            if (data) setStyles((prev) => prev.map((s) => s.id === data.id ? data : s));
          });
          toast.success("Style auto-classified with AI metadata");
        }
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to add style");
    } finally {
      setGenerating(false);
    }
  };

  const handleClassifyStyles = async () => {
    setClassifying(true);
    setClassifyLog(null);
    try {
      // Get all active style IDs and process in batches to avoid edge function timeout
      const activeIds = styles.filter((s) => s.is_active).map((s) => s.id);
      const BATCH_SIZE = 10;
      const allLogs: string[] = [];
      let totalUpdated = 0;
      let totalFailed = 0;

      for (let i = 0; i < activeIds.length; i += BATCH_SIZE) {
        const batch = activeIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(activeIds.length / BATCH_SIZE);
        toast.info(`Classifying batch ${batchNum}/${totalBatches}...`);

        const resp = await supabase.functions.invoke("classify-styles", {
          body: { styleIds: batch, baseUrl: window.location.origin },
        });
        if (resp.error) throw resp.error;
        if (resp.data?.error) throw new Error(resp.data.error);

        const { updated, failed, log } = resp.data;
        totalUpdated += updated || 0;
        totalFailed += failed || 0;
        if (log) allLogs.push(...log);
        setClassifyLog([...allLogs]);
      }

      toast.success(`Classified ${totalUpdated}/${activeIds.length} styles${totalFailed > 0 ? ` (${totalFailed} failed)` : ""}`);
      // Refresh styles list
      const { data } = await supabase.from("style_gallery").select("*").order("created_at", { ascending: false });
      if (data) setStyles(data);
    } catch (e: any) {
      toast.error(e.message || "Classification failed");
    } finally {
      setClassifying(false);
    }
  };

  const STYLE_CATEGORIES = ["bob", "pixie", "layers", "fade", "classic", "bangs", "waves", "braids", "natural", "curls", "undercut", "pompadour", "crop", "buzz", "slick", "edgy", "updo"];

  const styleCategories = ["all", ...Array.from(new Set(styles.map((s) => s.category))).sort()];
  const styleGenders = ["all", "female", "male", "unisex"];

  const filteredStyles = styles.filter((s) => {
    if (styleCategory !== "all" && s.category !== styleCategory) return false;
    if (styleGender !== "all" && s.gender !== styleGender) return false;
    if (styleSearch && !s.name.toLowerCase().includes(styleSearch.toLowerCase())) return false;
    return true;
  });

  const activeCount = styles.filter((s) => s.is_active).length;
  const demoModeEnabled = isDemoLoginEnabled();

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  if (!salon) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Set up your salon first to access settings</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">Settings</h1>
      <p className="text-muted-foreground mb-6">Manage your salon configuration</p>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="glass-subtle rounded-xl h-auto p-1.5 flex flex-wrap justify-start">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="hairstyles">Hairstyles</TabsTrigger>
          {demoModeEnabled && <TabsTrigger value="demo">Demo Data</TabsTrigger>}
        </TabsList>

        {/* ── Business (General + Booking + Pricing) ── */}
        <TabsContent value="business">
          <div className="grid gap-6 max-w-2xl">
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" />Business Policies
                </CardTitle>
                <CardDescription>Cancellation window, deposit requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Cancellation Window (hours)</Label>
                  <Input type="number" value={cancellationHours} onChange={(e) => setCancellationHours(parseInt(e.target.value) || 0)} className="max-w-xs" />
                  <p className="text-xs text-muted-foreground">Clients must cancel at least this many hours before their appointment</p>
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-sm font-medium">Payment Collection at Booking</Label>
                  <div className="grid gap-2">
                    {([
                      { value: "none", label: "No Payment", desc: "Book without any upfront payment" },
                      { value: "deposit", label: "Deposit", desc: "Collect a percentage deposit at booking" },
                      { value: "full", label: "Full Payment", desc: "Collect full service price upfront; card is saved for future visits" },
                    ] as const).map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${paymentMode === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                        onClick={() => setPaymentMode(opt.value)}
                      >
                        <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMode === opt.value ? "border-primary" : "border-muted-foreground/40"}`}>
                          {paymentMode === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {paymentMode === "deposit" && (
                  <div className="space-y-2 pl-7">
                    <Label>Deposit Percentage (%)</Label>
                    <Input type="number" value={depositPct} onChange={(e) => setDepositPct(parseInt(e.target.value) || 0)} className="max-w-xs" />
                    <p className="text-xs text-muted-foreground">Percentage of service price collected at booking</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5 text-primary" />Operating Hours
                </CardTitle>
                <CardDescription>Set your salon's weekly schedule</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <div className="w-24">
                      <Label className="text-sm">{DAY_LABELS[day]}</Label>
                    </div>
                    <Switch checked={!!hours[day]} onCheckedChange={() => toggleDayOpen(day)} />
                    {hours[day] ? (
                      <div className="flex items-center gap-2">
                        <Input type="time" value={hours[day]!.open} onChange={(e) => updateHoursDay(day, "open", e.target.value)} className="w-32" />
                        <span className="text-muted-foreground text-sm">to</span>
                        <Input type="time" value={hours[day]!.close} onChange={(e) => updateHoursDay(day, "close", e.target.value)} className="w-32" />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={saveGeneral} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />Booking Forms
                </CardTitle>
                <CardDescription>
                  When enabled, clients will be prompted to fill out any forms linked to the selected service before confirming their booking. Forms already completed by the client are automatically skipped.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Require forms during booking</p>
                    <p className="text-xs text-muted-foreground">Link forms to services in the Services page</p>
                  </div>
                  <Switch
                    checked={requireBookingForms}
                    onCheckedChange={async (checked) => {
                      setRequireBookingForms(checked);
                      const { error } = await supabase.from("salons").update({
                        require_booking_forms: checked,
                      } as any).eq("id", salon.id);
                      if (error) toast.error("Failed to save");
                      else toast.success(checked ? "Booking forms enabled" : "Booking forms disabled");
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing Rules */}
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingUp className="h-5 w-5 text-primary" />Price Increases
                    </CardTitle>
                    <CardDescription>Increase prices during high-demand periods to maximize revenue</CardDescription>
                  </div>
                  <Switch checked={surgeEnabled} onCheckedChange={setSurgeEnabled} />
                </div>
              </CardHeader>
              {surgeEnabled && (
                <CardContent className="space-y-3">
                  {surgeRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-muted/30">
                      <select
                        value={rule.day_of_week}
                        onChange={(e) => {
                          const updated = [...surgeRules];
                          updated[i] = { ...rule, day_of_week: parseInt(e.target.value) };
                          setSurgeRules(updated);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <select
                        value={rule.start_hour}
                        onChange={(e) => {
                          const updated = [...surgeRules];
                          updated[i] = { ...rule, start_hour: parseInt(e.target.value) };
                          setSurgeRules(updated);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <span className="text-sm text-muted-foreground">to</span>
                      <select
                        value={rule.end_hour}
                        onChange={(e) => {
                          const updated = [...surgeRules];
                          updated[i] = { ...rule, end_hour: parseInt(e.target.value) };
                          setSurgeRules(updated);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <span className="text-sm text-muted-foreground">→</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">+</span>
                        <Input
                          type="number"
                          value={Math.round((rule.multiplier - 1) * 100)}
                          onChange={(e) => {
                            const updated = [...surgeRules];
                            updated[i] = { ...rule, multiplier: 1 + (parseInt(e.target.value) || 0) / 100 };
                            setSurgeRules(updated);
                          }}
                          className="w-16 h-9"
                        />
                        <span className="text-sm">%</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSurgeRules(surgeRules.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addSurgeRule}>
                    <Plus className="h-4 w-4 mr-1" />Add Rule
                  </Button>
                </CardContent>
              )}
            </Card>

            {/* Off-Peak Discounts */}
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <TrendingDown className="h-5 w-5 text-primary" />Off-Peak Discounts
                    </CardTitle>
                    <CardDescription>Fill quieter hours by offering lower prices during off-peak times</CardDescription>
                  </div>
                  <Switch checked={offpeakEnabled} onCheckedChange={setOffpeakEnabled} />
                </div>
              </CardHeader>
              {offpeakEnabled && (
                <CardContent className="space-y-3">
                  {offpeakRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-muted/30">
                      <select
                        value={rule.day_of_week}
                        onChange={(e) => {
                          const updated = [...offpeakRules];
                          updated[i] = { ...rule, day_of_week: parseInt(e.target.value) };
                          setOffpeakRules(updated);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {DAY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <select
                        value={rule.start_hour}
                        onChange={(e) => {
                          const updated = [...offpeakRules];
                          updated[i] = { ...rule, start_hour: parseInt(e.target.value) };
                          setOffpeakRules(updated);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <span className="text-sm text-muted-foreground">to</span>
                      <select
                        value={rule.end_hour}
                        onChange={(e) => {
                          const updated = [...offpeakRules];
                          updated[i] = { ...rule, end_hour: parseInt(e.target.value) };
                          setOffpeakRules(updated);
                        }}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {HOUR_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                      <span className="text-sm text-muted-foreground">→</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">-</span>
                        <Input
                          type="number"
                          value={rule.discount_pct}
                          onChange={(e) => {
                            const updated = [...offpeakRules];
                            updated[i] = { ...rule, discount_pct: parseInt(e.target.value) || 0 };
                            setOffpeakRules(updated);
                          }}
                          className="w-16 h-9"
                        />
                        <span className="text-sm">%</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOffpeakRules(offpeakRules.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOffpeakRule}>
                    <Plus className="h-4 w-4 mr-1" />Add Rule
                  </Button>
                </CardContent>
              )}
            </Card>

            <Button onClick={savePricing} disabled={saving}>{saving ? "Saving..." : "Save Pricing Rules"}</Button>
          </div>
        </TabsContent>

        {/* ── Team (Commission + Levels) ── */}
        <TabsContent value="team">
          <div className="grid gap-6 max-w-2xl">
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DollarSign className="h-5 w-5 text-primary" />Default Commission Rate
                </CardTitle>
                <CardDescription>Applied to new stylists unless overridden individually</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Input type="number" value={defaultCommission} onChange={(e) => setDefaultCommission(parseInt(e.target.value) || 0)} className="w-32" />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Override individual rates in the Staff Management page. Per-stylist rates take priority over this default.
                </p>
                <Button onClick={saveGeneral} disabled={saving}>{saving ? "Saving..." : "Save Default Rate"}</Button>
              </CardContent>
            </Card>
          </div>
          <div className="mt-6">
            <StylistLevels salonId={salon.id} />
          </div>
        </TabsContent>

        {/* ── Programs (Memberships + Loyalty) ── */}
        <TabsContent value="programs">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Membership Tiers</h2>
                <p className="text-sm text-muted-foreground">Create and manage membership plans for your salon</p>
              </div>
              <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => openTierDialog()}><Plus className="h-4 w-4 mr-1" />Add Tier</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editingTier ? "Edit Tier" : "Add Membership Tier"}</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1"><Label>Name</Label><Input value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} placeholder="e.g. Premium" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Price ($)</Label><Input type="number" value={tierForm.price} onChange={(e) => setTierForm({ ...tierForm, price: e.target.value })} /></div>
                      <div className="space-y-1">
                        <Label>Billing</Label>
                        <select value={tierForm.billing_interval} onChange={(e) => setTierForm({ ...tierForm, billing_interval: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="annual">Annual</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><Label>Cleanup Start (day)</Label><Input type="number" value={tierForm.cleanup_window_start} onChange={(e) => setTierForm({ ...tierForm, cleanup_window_start: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Cleanup End (day)</Label><Input type="number" value={tierForm.cleanup_window_end} onChange={(e) => setTierForm({ ...tierForm, cleanup_window_end: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Max Credits</Label><Input type="number" value={tierForm.max_credits} onChange={(e) => setTierForm({ ...tierForm, max_credits: e.target.value })} /></div>
                    </div>
                    <Button onClick={saveTier} className="w-full" disabled={!tierForm.name || !tierForm.price}>{editingTier ? "Update" : "Create"} Tier</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {tiers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Crown className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No membership tiers yet. Create your first tier to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tiers.map((t) => (
                  <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{t.name}</p>
                          {!t.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">${t.price}/{t.billing_interval} · {t.max_credits} credit{t.max_credits > 1 ? "s" : ""} · Cleanup days {t.cleanup_window_start}–{t.cleanup_window_end}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openTierDialog(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleTierActive(t)}><ToggleLeft className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTier(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Loyalty Program */}
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gift className="h-5 w-5 text-primary" />Loyalty Program
                </CardTitle>
                <CardDescription>Configure how clients earn and redeem points</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Loyalty Program</p>
                    <p className="text-xs text-muted-foreground">Clients automatically earn points based on these rules</p>
                  </div>
                  <Switch checked={loyaltyEnabled} onCheckedChange={setLoyaltyEnabled} />
                </div>

                {loyaltyEnabled && (
                  <div className="space-y-5 pt-2 border-t border-border">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Label>Points per dollar spent</Label>
                      </div>
                      <Input type="number" min={0} step={0.5} value={pointsPerDollar} onChange={(e) => setPointsPerDollar(parseFloat(e.target.value) || 0)} className="max-w-xs" />
                      <p className="text-xs text-muted-foreground">Clients earn this many points for every $1 spent on services.</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <Label>Flat points per completed service</Label>
                      </div>
                      <Input type="number" min={0} value={pointsPerService} onChange={(e) => setPointsPerService(parseInt(e.target.value) || 0)} className="max-w-xs" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Label>Points per successful referral</Label>
                      </div>
                      <Input type="number" min={0} value={referralPoints} onChange={(e) => setReferralPoints(parseInt(e.target.value) || 0)} className="max-w-xs" />
                    </div>
                    <div className="space-y-2 border-t border-border pt-5">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-muted-foreground" />
                        <Label>Point redemption value (cents)</Label>
                      </div>
                      <Input type="number" min={1} value={pointValueCents} onChange={(e) => setPointValueCents(parseInt(e.target.value) || 1)} className="max-w-xs" />
                      <p className="text-xs text-muted-foreground">
                        Each point is worth {pointValueCents} cent{pointValueCents !== 1 ? "s" : ""} when redeemed.
                        {pointsPerDollar > 0 && (
                          <> For example, spending $100 earns {pointsPerDollar * 100} points = ${((pointsPerDollar * 100 * pointValueCents) / 100).toFixed(2)} off a future service.</>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Button onClick={saveLoyalty} disabled={saving}>{saving ? "Saving..." : "Save Loyalty Settings"}</Button>
          </div>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications">
          <div className="max-w-2xl">
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="h-5 w-5 text-primary" />Notification Preferences
                </CardTitle>
                <CardDescription>Control which notifications your salon sends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "booking_confirmed", label: "Booking Confirmed", desc: "When a client books an appointment" },
                  { key: "booking_cancelled", label: "Booking Cancelled", desc: "When a client cancels their appointment" },
                  { key: "consultation_submitted", label: "Consultation Submitted", desc: "When a new consultation is submitted" },
                  { key: "appointment_reminder", label: "Appointment Reminder", desc: "Automatic reminder before appointments" },
                ].map((n) => (
                  <div key={n.key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch
                      checked={(notifPrefs as any)[n.key]}
                      onCheckedChange={(v) => setNotifPrefs({ ...notifPrefs, [n.key]: v })}
                    />
                  </div>
                ))}
                <Button onClick={saveNotifications} disabled={saving}>{saving ? "Saving..." : "Save Preferences"}</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Integrations ── */}
        <TabsContent value="integrations">
          <div className="max-w-2xl space-y-6">
            {/* Google Business Profile */}
            <GoogleBusinessCard salon={salon} onSalonUpdate={(updates: any) => setSalon({ ...salon, ...updates })} />

            {/* Apple Business Connect */}
            <AppleBusinessCard salonId={salon.id} />

            {/* Google Reserve */}
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className="h-5 w-5 text-primary" />Google Reserve
                    </CardTitle>
                    <CardDescription>Capture bookings directly from Google Search, Maps and more</CardDescription>
                  </div>
                  <Switch checked={googleReserveEnabled} onCheckedChange={setGoogleReserveEnabled} />
                </div>
              </CardHeader>
              {googleReserveEnabled && (
                <CardContent>
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                    <p className="font-medium">Feed URL</p>
                    <code className="text-xs break-all text-muted-foreground">
                      {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-reserve-feed?salon_id=${salon.id}`}
                    </code>
                    <p className="text-xs text-muted-foreground mt-2">Register this URL with Google to enable Reserve with Google.</p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Meta Pixel */}
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />Meta Pixel
                </CardTitle>
                <CardDescription>Track conversions and send events to your Meta Pixel for ad optimization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Pixel ID</Label>
                  <Input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} placeholder="e.g. 123456789012345" />
                </div>
                <div className="space-y-2">
                  <Label>Conversions API Key (optional, for server-side tracking)</Label>
                  <Input value={metaConversionsApiKey} onChange={(e) => setMetaConversionsApiKey(e.target.value)} placeholder="EAAx..." />
                </div>
              </CardContent>
            </Card>

            {/* Google Analytics */}
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />Google Analytics
                </CardTitle>
                <CardDescription>Send events about user actions to Google Analytics for conversion tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>GA4 Measurement ID</Label>
                  <Input value={googleAnalyticsId} onChange={(e) => setGoogleAnalyticsId(e.target.value)} placeholder="G-XXXXXXXXXX" />
                </div>
              </CardContent>
            </Card>

            <Button onClick={saveIntegrations} disabled={saving}>{saving ? "Saving..." : "Save Integrations"}</Button>
          </div>
        </TabsContent>

        {/* ── Appearance (Branding) ── */}
        <TabsContent value="appearance">
          <div className="space-y-8">
            <BrandingSettings
              salonId={salon.id}
              salon={salon}
              onSalonUpdate={(updates: any) => setSalon({ ...salon, ...updates })}
            />
          </div>
        </TabsContent>

        {/* ── Hairstyles ── */}
        <TabsContent value="hairstyles">
          <div className="space-y-8">
          <Card className="glass rounded-xl border-0">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Image className="h-5 w-5 text-primary" />Consultation Styles
                  </CardTitle>
                  <CardDescription>{styles.length} styles total, {activeCount} active in consultations</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleClassifyStyles} disabled={classifying || styles.length === 0}>
                    {classifying ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Classifying...</> : <><Sparkles className="h-4 w-4 mr-1" />Auto-Classify</>}
                  </Button>
                  <Dialog open={addStyleOpen} onOpenChange={(open) => { setAddStyleOpen(open); if (!open) { handleReferenceFileChange(null); setNewStyleForm({ name: "", category: "classic", gender: "unisex", hair_length: "medium", compatible_hair_types: ["straight", "wavy", "curly", "coily"], compatible_hair_thicknesses: ["fine", "medium", "thick"] }); } }}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Style</Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add New Style</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <Label>Style Name</Label>
                        <Input value={newStyleForm.name} onChange={(e) => setNewStyleForm({ ...newStyleForm, name: e.target.value })} placeholder="e.g. Textured French Bob" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>Category</Label>
                          <select value={newStyleForm.category} onChange={(e) => setNewStyleForm({ ...newStyleForm, category: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            {STYLE_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Gender</Label>
                          <select value={newStyleForm.gender} onChange={(e) => setNewStyleForm({ ...newStyleForm, gender: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="unisex">Unisex</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Length</Label>
                          <select value={newStyleForm.hair_length} onChange={(e) => setNewStyleForm({ ...newStyleForm, hair_length: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="long">Long</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Compatible Hair Types</Label>
                        <div className="flex flex-wrap gap-2">
                          {(["straight", "wavy", "curly", "coily"] as const).map((ht) => (
                            <button
                              key={ht}
                              type="button"
                              onClick={() => setNewStyleForm(prev => ({
                                ...prev,
                                compatible_hair_types: prev.compatible_hair_types.includes(ht)
                                  ? prev.compatible_hair_types.filter((t: string) => t !== ht)
                                  : [...prev.compatible_hair_types, ht]
                              }))}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                                newStyleForm.compatible_hair_types.includes(ht)
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                            >
                              {ht}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Select which hair types this style works with</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Compatible Hair Thicknesses</Label>
                        <div className="flex flex-wrap gap-2">
                          {(["fine", "medium", "thick"] as const).map((th) => (
                            <button
                              key={th}
                              type="button"
                              onClick={() => setNewStyleForm(prev => ({
                                ...prev,
                                compatible_hair_thicknesses: prev.compatible_hair_thicknesses.includes(th)
                                  ? prev.compatible_hair_thicknesses.filter((t: string) => t !== th)
                                  : [...prev.compatible_hair_thicknesses, th]
                              }))}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                                newStyleForm.compatible_hair_thicknesses.includes(th)
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/40"
                              }`}
                            >
                              {th}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">Select which hair thicknesses this style works with</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Reference Hairstyle Photo</Label>
                        <p className="text-xs text-muted-foreground mb-2">Upload a photo of the hairstyle. AI will apply it to the mannequin head.</p>
                        {referencePreview ? (
                          <div className="relative">
                            <img src={referencePreview} alt="Reference" className="w-full h-48 object-cover rounded-lg border border-border" />
                            <button onClick={() => handleReferenceFileChange(null)} className="absolute top-2 right-2 p-1 rounded-full bg-obsidian/70 text-white hover:bg-obsidian/90">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">Click to upload</span>
                            <span className="text-xs text-muted-foreground/60">JPG, PNG</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleReferenceFileChange(e.target.files?.[0] || null)} />
                          </label>
                        )}
                      </div>
                      <Button onClick={handleAddStyle} disabled={generating || !newStyleForm.name.trim() || !referenceFile} className="w-full">
                        {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating style image...</> : <><Plus className="h-4 w-4 mr-1" />Generate & Add Style</>}
                      </Button>
                    </div>
                  </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search styles..."
                  value={styleSearch}
                  onChange={(e) => setStyleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Gender filter */}
              <div className="flex gap-2">
                {styleGenders.map((g) => (
                  <button
                    key={g}
                    onClick={() => setStyleGender(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                      styleGender === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g === "all" ? "All Genders" : g}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              <div className="flex flex-wrap gap-2">
                {styleCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStyleCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                      styleCategory === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Grid */}
              {stylesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStyles.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Image className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p>{styles.length === 0 ? "No hairstyles found. Seed demo data to add styles." : "No styles match your filters."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredStyles.map((style) => (
                    <div
                      key={style.id}
                      className={`group relative aspect-[3/4] rounded-xl overflow-hidden bg-muted border transition-all ${
                        style.is_active ? "border-border hover:border-primary/40" : "border-border opacity-60 grayscale"
                      }`}
                    >
                      <img
                        src={style.image_url}
                        alt={style.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {/* Info overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10">
                        <p className="text-white text-sm font-medium leading-tight">{style.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-white/60 text-xs capitalize">{style.category}</span>
                          {style.gender && style.gender !== "unisex" && (
                            <span className="text-white/50 text-[10px] px-1.5 py-0.5 rounded-full border border-white/20 capitalize">{style.gender}</span>
                          )}
                        </div>
                      </div>
                      {/* Action buttons (top-right) */}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          onClick={() => setRenamingStyle({ id: style.id, name: style.name })}
                          className="p-1.5 rounded-full bg-obsidian/60 text-white/70 hover:bg-obsidian/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rename style"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleStyleActive(style.id, style.is_active)}
                          className={`p-1.5 rounded-full transition-colors ${
                            style.is_active
                              ? "bg-green-500/90 text-white hover:bg-green-600"
                              : "bg-obsidian/60 text-white/70 hover:bg-obsidian/80"
                          }`}
                          title={style.is_active ? "Click to hide from consultations" : "Click to show in consultations"}
                        >
                          {style.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {/* Inactive badge */}
                      {!style.is_active && (
                        <div className="absolute top-2 left-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-obsidian/70 text-white/80">Hidden</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {classifyLog && (
                <div className="pt-4 border-t border-border">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                      Classification Log ({classifyLog.length} entries)
                    </summary>
                    <div className="mt-2 bg-muted rounded-lg p-3 space-y-0.5 max-h-64 overflow-y-auto font-mono">
                      {classifyLog.map((line, i) => (
                        <div key={i} className={line.startsWith("OK") ? "text-green-500" : line.startsWith("ERROR") ? "text-red-500" : "text-yellow-500"}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rename Style Dialog */}
          <Dialog open={!!renamingStyle} onOpenChange={(open) => { if (!open) setRenamingStyle(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Rename Style</DialogTitle></DialogHeader>
              {renamingStyle && (
                <div className="space-y-4 pt-2">
                  {(() => {
                    const s = styles.find((st) => st.id === renamingStyle.id);
                    return s ? (
                      <img src={s.image_url} alt={s.name} className="w-full h-40 object-cover rounded-lg border border-border" />
                    ) : null;
                  })()}
                  <div className="space-y-1">
                    <Label>Style Name</Label>
                    <Input
                      value={renamingStyle.name}
                      onChange={(e) => setRenamingStyle({ ...renamingStyle, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameStyle(); }}
                      autoFocus
                    />
                  </div>
                  <Button onClick={handleRenameStyle} disabled={!renamingStyle.name.trim()} className="w-full">Save Name</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          </div>
        </TabsContent>

        {/* ── Demo Data ── */}
        {demoModeEnabled && <TabsContent value="demo">
          <div className="max-w-2xl">
            <Card className="glass rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-5 w-5 text-primary" />Demo Data
                </CardTitle>
                <CardDescription>Seed the database with realistic demo data. Safe to run multiple times.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Demo accounts:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Client: <code className="text-xs bg-muted px-1 py-0.5 rounded">demo-client@prism.app</code></li>
                    <li>Stylist: <code className="text-xs bg-muted px-1 py-0.5 rounded">demo-stylist@prism.app</code></li>
                    <li>Admin: <code className="text-xs bg-muted px-1 py-0.5 rounded">demo-admin@prism.app</code></li>
                  </ul>
                  <p className="mt-2">Password: <code className="text-xs bg-muted px-1 py-0.5 rounded">demo1234</code></p>
                </div>
                <Button onClick={handleSeedDemoData} disabled={seeding} className="w-full">
                  {seeding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Seeding…</> : <><Database className="h-4 w-4 mr-2" />Seed Demo Data</>}
                </Button>
                {seedLog && (
                  <div className="bg-muted rounded-lg p-3 text-xs space-y-1 max-h-48 overflow-y-auto">
                    {seedLog.map((line, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {line.includes("Created") ? <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>}
      </Tabs>
    </div>
  );
};

export default AdminSettings;
