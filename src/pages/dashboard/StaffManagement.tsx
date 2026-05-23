import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Save, Loader2, UserPlus, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SlidingTier {
  min: number;
  max: number | null;
  rate: number;
}

interface Stylist {
  id: string;
  user_id: string;
  commission_rate: number | null;
  commission_type: string;
  sliding_scale_tiers: SlidingTier[];
  product_commission_rate: number | null;
  hourly_rate: number | null;
  enable_greater_of: boolean;
  years_experience: number | null;
  specialties: string[] | null;
  level_id: string | null;
  profile: { full_name: string; avatar_url: string | null } | null;
}

interface StylistLevel {
  id: string;
  name: string;
  sort_order: number;
}

const StaffManagement = () => {
  const { user } = useAuth(false);
  const [salon, setSalon] = useState<any>(null);
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [levels, setLevels] = useState<StylistLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const { data: salonData } = await supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle();
    setSalon(salonData);
    if (salonData) {
      const [stylistRes, levelsRes] = await Promise.all([
        supabase.from("stylist_profiles").select("*").eq("salon_id", salonData.id),
        supabase.from("stylist_levels").select("*").eq("salon_id", salonData.id).order("sort_order"),
      ]);
      setLevels((levelsRes.data as StylistLevel[]) || []);
      const stylistData = stylistRes.data;
      if (stylistData && stylistData.length > 0) {
        const userIds = stylistData.map((s) => s.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p]));
        setStylists(
          stylistData.map((s: any) => ({
            ...s,
            sliding_scale_tiers: Array.isArray(s.sliding_scale_tiers) ? s.sliding_scale_tiers : [],
            profile: profileMap.get(s.user_id) || null,
          }))
        );
      } else {
        setStylists([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const updateStylist = (id: string, patch: Partial<Stylist>) => {
    setStylists((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const saveCompensation = async (stylist: Stylist) => {
    setSavingId(stylist.id);
    const { error } = await supabase
      .from("stylist_profiles")
      .update({
        commission_type: stylist.commission_type,
        commission_rate: stylist.commission_rate ?? 0,
        sliding_scale_tiers: stylist.sliding_scale_tiers as any,
        product_commission_rate: stylist.product_commission_rate ?? 0,
        hourly_rate: stylist.hourly_rate ?? 0,
        enable_greater_of: stylist.enable_greater_of,
        level_id: stylist.level_id,
      })
      .eq("id", stylist.id);
    if (error) toast.error("Failed to save compensation settings");
    else toast.success("Compensation settings saved");
    setSavingId(null);
  };

  const addTier = (stylistId: string) => {
    const s = stylists.find((st) => st.id === stylistId);
    if (!s) return;
    const tiers = [...s.sliding_scale_tiers];
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].max ?? 0) : 0;
    tiers.push({ min: lastMax, max: lastMax + 5000, rate: 45 });
    updateStylist(stylistId, { sliding_scale_tiers: tiers });
  };

  const updateTier = (stylistId: string, index: number, patch: Partial<SlidingTier>) => {
    const s = stylists.find((st) => st.id === stylistId);
    if (!s) return;
    const tiers = s.sliding_scale_tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    updateStylist(stylistId, { sliding_scale_tiers: tiers });
  };

  const removeTier = (stylistId: string, index: number) => {
    const s = stylists.find((st) => st.id === stylistId);
    if (!s) return;
    updateStylist(stylistId, { sliding_scale_tiers: s.sliding_scale_tiers.filter((_, i) => i !== index) });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-stylist", {
        body: { email: inviteEmail.trim() },
      });
      if (error) throw error;
      toast.success(data.message || "Stylist invited successfully");
      setInviteEmail("");
      setInviteOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite stylist");
    }
    setInviting(false);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight mb-1">Staff & Compensation</h1>
          <p className="text-muted-foreground">Manage your team and compensation settings</p>
        </div>
        {salon && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-prism text-white rounded-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Stylist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a Stylist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="stylist@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If the user already has an account, they'll be added. Otherwise, they'll receive an invitation email.
                  </p>
                </div>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="w-full">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!salon ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Set up your salon first to manage staff</p>
        </div>
      ) : stylists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No stylists yet. Use the invite button above to add your team.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stylists.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <Card key={s.id} className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
                {/* Header row */}
                <CardHeader
                  className="cursor-pointer p-6"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-prism flex items-center justify-center text-sm font-medium text-white shrink-0">
                      {(s.profile?.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">{s.profile?.full_name || "Unknown"}</CardTitle>
                        <Badge variant="secondary" className="text-[10px]">
                          {s.commission_type === "sliding_scale" ? "Sliding Scale" : "Flat Rate"}
                        </Badge>
                        {s.enable_greater_of && (
                          <Badge variant="outline" className="text-[10px]">Greater-of</Badge>
                        )}
                        {s.level_id && levels.find(l => l.id === s.level_id) && (
                          <Badge variant="default" className="text-[10px]">{levels.find(l => l.id === s.level_id)!.name}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.years_experience}yr exp · {s.specialties?.join(", ") || "No specialties"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={savingId === s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          saveCompensation(s);
                        }}
                      >
                        {savingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="ml-1 hidden sm:inline">Save</span>
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 pb-5 px-4 space-y-6">
                    <Separator />

                    {/* Stylist Level */}
                    {levels.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold">Stylist Level</h3>
                        <div className="flex items-center gap-4">
                          <Label className="text-sm text-muted-foreground w-28 shrink-0">Level</Label>
                          <Select
                            value={s.level_id || "none"}
                            onValueChange={(v) => updateStylist(s.id, { level_id: v === "none" ? null : v })}
                          >
                            <SelectTrigger className="w-56">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Level</SelectItem>
                              {levels.map((l) => (
                                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">Assigns this stylist to a pricing tier. Set up levels in Settings → Levels.</p>
                      </div>
                    )}

                    <Separator />

                    {/* Service Commission Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Service Commission</h3>
                      <div className="flex items-center gap-4">
                        <Label className="text-sm text-muted-foreground w-28 shrink-0">Type</Label>
                        <Select
                          value={s.commission_type}
                          onValueChange={(v) => updateStylist(s.id, { commission_type: v })}
                        >
                          <SelectTrigger className="w-56">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat Percentage</SelectItem>
                            <SelectItem value="sliding_scale">Sliding Scale</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {s.commission_type === "flat" ? (
                        <div className="flex items-center gap-4">
                          <Label className="text-sm text-muted-foreground w-28 shrink-0">Commission Rate</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="w-24 text-right"
                              value={s.commission_rate ?? ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateStylist(s.id, { commission_rate: isNaN(val) ? null : val });
                              }}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">Commission rate varies based on total service sales in the period.</p>
                          {s.sliding_scale_tiers.map((tier, i) => (
                            <div key={i} className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                className="w-24 text-right"
                                value={tier.min}
                                onChange={(e) => updateTier(s.id, i, { min: parseFloat(e.target.value) || 0 })}
                              />
                              <span className="text-xs text-muted-foreground">to $</span>
                              <Input
                                type="number"
                                className="w-24 text-right"
                                placeholder="∞"
                                value={tier.max ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  updateTier(s.id, i, { max: v === "" ? null : parseFloat(v) || 0 });
                                }}
                              />
                              <span className="text-xs text-muted-foreground">→</span>
                              <Input
                                type="number"
                                className="w-20 text-right"
                                value={tier.rate}
                                onChange={(e) => updateTier(s.id, i, { rate: parseFloat(e.target.value) || 0 })}
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTier(s.id, i)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => addTier(s.id)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Tier
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Product Commission */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Product Commission</h3>
                      <div className="flex items-center gap-4">
                        <Label className="text-sm text-muted-foreground w-28 shrink-0">Product Rate</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="w-24 text-right"
                            value={s.product_commission_rate ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateStylist(s.id, { product_commission_rate: isNaN(val) ? null : val });
                            }}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Percentage of product sales paid to this stylist.</p>
                    </div>

                    <Separator />

                    {/* Hourly Rate */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Hourly Compensation</h3>
                      <div className="flex items-center gap-4">
                        <Label className="text-sm text-muted-foreground w-28 shrink-0">Hourly Rate</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            className="w-24 text-right"
                            value={s.hourly_rate ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateStylist(s.id, { hourly_rate: isNaN(val) ? null : val });
                            }}
                          />
                          <span className="text-sm text-muted-foreground">/ hr</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Greater-of Toggle */}
                    <div className="flex items-start gap-4">
                      <Switch
                        checked={s.enable_greater_of}
                        onCheckedChange={(v) => updateStylist(s.id, { enable_greater_of: v })}
                      />
                      <div>
                        <Label className="text-sm font-semibold">Enable "Greater-of" Calculation</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          When enabled, the stylist is compensated based on the <strong>higher value</strong> between their total hourly pay (hourly rate × hours worked) and their total commission earnings for the period.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
