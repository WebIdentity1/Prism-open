import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Gift, Star, Users, Plus, Copy, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface PointEntry {
  id: string;
  client_id: string;
  points: number;
  reason: string;
  created_at: string;
  client_name?: string;
}

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: string;
  points_awarded: number;
  created_at: string;
  referrer_name?: string;
  referred_name?: string;
}

const Loyalty = () => {
  const { user, role } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<PointEntry[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ client_id: string; name: string; total: number }[]>([]);
  const [showAward, setShowAward] = useState(false);
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [awardClientId, setAwardClientId] = useState("");
  const [awardPoints, setAwardPoints] = useState("10");
  const [awardReason, setAwardReason] = useState("Manual bonus");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSalonAdmin = role === "salon_admin";

  const loadData = async () => {
    if (!user) return;
    if (isSalonAdmin) {
      const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).maybeSingle();
      if (!salon) { setLoading(false); return; }
      setSalonId(salon.id);

      const [ptsRes, refRes] = await Promise.all([
        supabase.from("loyalty_points").select("*").eq("salon_id", salon.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("referrals").select("*").eq("salon_id", salon.id).order("created_at", { ascending: false }).limit(50),
      ]);

      const allClientIds = [...new Set([
        ...(ptsRes.data || []).map((p: any) => p.client_id),
        ...(refRes.data || []).map((r: any) => r.referrer_id),
        ...(refRes.data || []).map((r: any) => r.referred_id),
      ])];

      let profileMap = new Map<string, string>();
      if (allClientIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", allClientIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name || "Unknown"]));
      }

      const enrichedPoints = (ptsRes.data || []).map((p: any) => ({
        ...p,
        client_name: profileMap.get(p.client_id) || "Unknown",
      }));
      setPoints(enrichedPoints);

      setReferrals((refRes.data || []).map((r: any) => ({
        ...r,
        referrer_name: profileMap.get(r.referrer_id) || "Unknown",
        referred_name: profileMap.get(r.referred_id) || "Unknown",
      })));

      // Build leaderboard
      const totals = new Map<string, number>();
      enrichedPoints.forEach((p: PointEntry) => {
        totals.set(p.client_id, (totals.get(p.client_id) || 0) + p.points);
      });
      setLeaderboard(
        [...totals.entries()]
          .map(([client_id, total]) => ({ client_id, name: profileMap.get(client_id) || "Unknown", total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 10)
      );

      // Get clients for award dialog
      const { data: appts } = await supabase.from("appointments").select("client_id").eq("salon_id", salon.id);
      const uniqueIds = [...new Set((appts || []).map((a: any) => a.client_id))];
      if (uniqueIds.length > 0) {
        const { data: cProfiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", uniqueIds);
        setClients((cProfiles || []).map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || "Unknown" })));
      }
    } else {
      // Client view
      const { data } = await supabase.from("loyalty_points").select("*").eq("client_id", user.id).order("created_at", { ascending: false });
      setPoints((data || []) as PointEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, role]);

  const handleAward = async () => {
    if (!salonId || !awardClientId || !awardPoints) return;
    setSaving(true);
    const { error } = await supabase.from("loyalty_points").insert({
      client_id: awardClientId,
      salon_id: salonId,
      points: parseInt(awardPoints),
      reason: awardReason || "Manual bonus",
    });
    if (error) { toast.error("Failed to award points"); setSaving(false); return; }
    toast.success("Points awarded!");
    setShowAward(false);
    setSaving(false);
    await loadData();
  };

  const referralLink = salonId ? `${window.location.origin}/join/${salonId}?ref=${user?.id}` : "";

  const copyReferralLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const totalPoints = points.reduce((s, p) => s + p.points, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">
            {isSalonAdmin ? "Loyalty & Referrals" : "My Rewards"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isSalonAdmin ? "Track points, referrals, and reward your best clients" : "Your loyalty points and referral rewards"}
          </p>
        </div>
        {isSalonAdmin && (
          <Button onClick={() => setShowAward(true)} className="bg-gradient-champagne text-white rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Award Points
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
        <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"><CardContent className="p-6 text-center">
          <Star className="h-5 w-5 mx-auto mb-1 text-champagne" />
          <p className="text-2xl font-light">{totalPoints}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Points</p>
        </CardContent></Card>
        <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"><CardContent className="p-6 text-center">
          <Gift className="h-5 w-5 mx-auto mb-1 text-rose" />
          <p className="text-2xl font-light">{points.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transactions</p>
        </CardContent></Card>
        {isSalonAdmin && (
          <>
            <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"><CardContent className="p-6 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-light">{referrals.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Referrals</p>
            </CardContent></Card>
            <Card className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"><CardContent className="p-6 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-light">{leaderboard.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Members</p>
            </CardContent></Card>
          </>
        )}
      </div>

      {/* Referral link for clients */}
      {!isSalonAdmin && referralLink && (
        <Card className="glass rounded-xl border-0 mb-6">
          <CardContent className="p-6">
            <Label className="text-xs">Share your referral link</Label>
            <div className="flex gap-2 mt-1">
              <Input value={referralLink} readOnly className="text-xs rounded-lg" />
              <Button size="sm" variant="outline" onClick={copyReferralLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isSalonAdmin ? (
        <Tabs defaultValue="leaderboard">
          <TabsList>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            <TabsTrigger value="history">Point History</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>
          <TabsContent value="leaderboard" className="mt-4 space-y-2">
            {leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No points awarded yet</p>
            ) : leaderboard.map((l, i) => (
              <div key={l.client_id} className="flex items-center gap-3 p-3 glass-subtle rounded-lg">
                <span className="text-lg font-light text-muted-foreground w-6 text-center">#{i + 1}</span>
                <div className="flex-1"><p className="text-sm font-medium">{l.name}</p></div>
                <Badge className="badge-champagne">{l.total} pts</Badge>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="history" className="mt-4 space-y-2">
            {points.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 glass-subtle rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.client_name}</p>
                  <p className="text-xs text-muted-foreground">{p.reason}</p>
                </div>
                <Badge variant="secondary">+{p.points}</Badge>
                <span className="text-[10px] text-muted-foreground">{format(parseISO(p.created_at), "MMM d")}</span>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="referrals" className="mt-4 space-y-2">
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No referrals yet</p>
            ) : referrals.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 glass-subtle rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.referrer_name} → {r.referred_name}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "MMM d, yyyy")}</p>
                </div>
                <Badge variant="secondary" className={r.status === "completed" ? "bg-green-100 text-green-700" : ""}>{r.status}</Badge>
                {r.points_awarded > 0 && <Badge variant="outline">+{r.points_awarded} pts</Badge>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Points History</h2>
          {points.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No points yet — earn points by visiting the salon!</p>
          ) : points.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 glass-subtle rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">{p.reason}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(p.created_at), "MMM d, yyyy")}</p>
              </div>
              <Badge variant="secondary">+{p.points}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Award Points Dialog */}
      <Dialog open={showAward} onOpenChange={setShowAward}>
        <DialogContent>
          <DialogHeader><DialogTitle>Award Points</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select value={awardClientId} onValueChange={setAwardClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" value={awardPoints} onChange={(e) => setAwardPoints(e.target.value)} />
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={awardReason} onChange={(e) => setAwardReason(e.target.value)} placeholder="e.g. Referral bonus" />
            </div>
            <Button onClick={handleAward} disabled={saving || !awardClientId} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Star className="h-4 w-4 mr-1" />}
              Award Points
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Loyalty;
