import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Send, Mail, MessageSquare, Users, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { SEGMENTS, type ClientSegment } from "@/lib/segmentation";
import EmailBuilder from "@/components/dashboard/EmailBuilder";

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  channel: string;
  segment: string;
  status: string;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
  ai_conversation: any[];
}

const statusColors: Record<string, string> = {
  draft: "badge-glass",
  sending: "badge-champagne",
  sent: "badge-teal",
};

const Campaigns = () => {
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email builder state
  const [builderCampaign, setBuilderCampaign] = useState<Campaign | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [pendingChannel, setPendingChannel] = useState("email");
  const [pendingSegment, setPendingSegment] = useState("all");

  // SMS form state
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState("email");
  const [segment, setSegment] = useState("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).maybeSingle();
      if (!salon) { setLoading(false); return; }
      setSalonId(salon.id);
      const { data } = await supabase
        .from("campaigns")
        .select("*")
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false });
      setCampaigns((data || []) as Campaign[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleCreateSms = async () => {
    if (!salonId || !name.trim() || !body.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("campaigns").insert({
      salon_id: salonId,
      name: name.trim(),
      body: body.trim(),
      channel: "sms",
      segment,
    } as any).select().single();
    if (error) { toast.error("Failed to create campaign"); setSaving(false); return; }
    setCampaigns([data as Campaign, ...campaigns]);
    setShowCreate(false);
    resetForm();
    toast.success("SMS campaign created");
    setSaving(false);
  };

  const handleStartEmailBuilder = () => {
    setShowCreate(false);
    // Create a new campaign placeholder then open builder
    setBuilderCampaign({
      id: "",
      name: "",
      subject: null,
      body: "",
      channel: "email",
      segment: pendingSegment,
      status: "draft",
      sent_at: null,
      sent_count: 0,
      created_at: new Date().toISOString(),
      ai_conversation: [],
    });
    setShowBuilder(true);
  };

  const handleOpenExistingBuilder = (campaign: Campaign) => {
    setBuilderCampaign(campaign);
    setShowBuilder(true);
  };

  const handleBuilderSave = async (data: { subject: string; body: string; ai_conversation: any[] }) => {
    if (!salonId) return;

    if (builderCampaign?.id) {
      // Update existing
      const { error } = await supabase.from("campaigns").update({
        subject: data.subject,
        body: data.body,
        ai_conversation: data.ai_conversation,
      } as any).eq("id", builderCampaign.id);
      if (error) { toast.error("Failed to save"); return; }
      setCampaigns(campaigns.map(c =>
        c.id === builderCampaign.id
          ? { ...c, subject: data.subject, body: data.body, ai_conversation: data.ai_conversation }
          : c
      ));
      toast.success("Campaign updated");
    } else {
      // Create new
      const campaignName = data.subject || "AI Email Campaign";
      const { data: newCamp, error } = await supabase.from("campaigns").insert({
        salon_id: salonId,
        name: campaignName,
        subject: data.subject,
        body: data.body,
        channel: "email",
        segment: pendingSegment,
        ai_conversation: data.ai_conversation,
      } as any).select().single();
      if (error) { toast.error("Failed to save campaign"); return; }
      setCampaigns([newCamp as Campaign, ...campaigns]);
      setBuilderCampaign(newCamp as Campaign);
      toast.success("Campaign saved");
    }
  };

  const handleSend = async (campaign: Campaign) => {
    toast.info("Campaign sending will be available once email/SMS integrations are configured.");
    const { error } = await supabase.from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() } as any)
      .eq("id", campaign.id);
    if (!error) {
      setCampaigns(campaigns.map(c => c.id === campaign.id ? { ...c, status: "sent", sent_at: new Date().toISOString() } : c));
    }
  };

  const resetForm = () => {
    setName(""); setBody(""); setChannel("email"); setSegment("all");
    setPendingChannel("email"); setPendingSegment("all");
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // Show email builder full screen
  if (showBuilder && salonId) {
    return (
      <EmailBuilder
        salonId={salonId}
        campaign={builderCampaign}
        onBack={() => { setShowBuilder(false); setBuilderCampaign(null); }}
        onSave={handleBuilderSave}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground text-sm">Send targeted messages to client segments</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-champagne text-white rounded-full">
          <Plus className="h-4 w-4 mr-1" /> New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No campaigns yet</p>
          <p className="text-sm mt-1">Create your first marketing campaign</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className={`glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 ${c.channel === "email" && c.status === "draft" ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (c.channel === "email" && c.status === "draft") handleOpenExistingBuilder(c);
              }}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-gradient-champagne flex items-center justify-center shrink-0">
                  {c.channel === "sms" ? <MessageSquare className="h-5 w-5 text-white" /> : <Mail className="h-5 w-5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.channel === "email" && c.subject ? c.subject : c.body?.slice(0, 80)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={`text-[10px] ${statusColors[c.status] || ""}`}>{c.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Users className="h-2.5 w-2.5 mr-1" />
                      {c.segment === "all" ? "All Clients" : SEGMENTS[c.segment as ClientSegment]?.label || c.segment}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{c.channel.toUpperCase()}</span>
                    {c.channel === "email" && c.ai_conversation?.length > 0 && (
                      <Badge className="ai-badge text-[10px]">
                        <Sparkles className="h-2.5 w-2.5 mr-1" />AI
                      </Badge>
                    )}
                    {c.sent_at && <span className="text-[10px] text-muted-foreground">Sent {format(parseISO(c.sent_at), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                {c.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); handleSend(c); }}
                  >
                    <Send className="h-3.5 w-3.5 mr-1" /> Send
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Channel</Label>
                <Select value={pendingChannel} onValueChange={(v) => { setPendingChannel(v); setChannel(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Segment</Label>
                <Select value={pendingSegment} onValueChange={(v) => { setPendingSegment(v); setSegment(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {Object.entries(SEGMENTS).map(([key, s]) => (
                      <SelectItem key={key} value={key}>{s.label} — {s.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {pendingChannel === "email" ? (
              <div className="text-center py-6">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
                <p className="text-sm font-medium">AI Email Builder</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">
                  Describe what you want and AI will generate a branded, responsive email
                </p>
                <Button onClick={handleStartEmailBuilder}>
                  <Sparkles className="h-4 w-4 mr-1" /> Open Email Builder
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <Label>Campaign Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Promo" />
                </div>
                <div>
                  <Label>Message Body</Label>
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Write your SMS message..." />
                </div>
                <Button onClick={handleCreateSms} disabled={saving || !name.trim() || !body.trim()} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Create SMS Campaign
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Campaigns;
