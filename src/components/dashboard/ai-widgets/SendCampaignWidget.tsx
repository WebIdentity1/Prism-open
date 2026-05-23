import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Check } from "lucide-react";

interface SendCampaignWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

const SEGMENTS = [
  { value: "all", label: "All clients" },
  { value: "active", label: "Active clients (visited < 30 days)" },
  { value: "at_risk", label: "At-risk clients (30-60 days)" },
  { value: "inactive", label: "Inactive clients (60+ days)" },
  { value: "new", label: "New clients (1 visit)" },
];

export function SendCampaignWidget({ salonId, context, onComplete }: SendCampaignWidgetProps) {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState(context.segment_hint || "all");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(context.message_hint || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !body.trim()) return;
    setSending(true);

    const { error } = await supabase.from("campaigns").insert({
      salon_id: salonId,
      name: name.trim(),
      segment,
      channel,
      subject: channel === "email" ? subject.trim() : null,
      body: body.trim(),
      status: "draft",
    });

    setSending(false);
    if (error) {
      onComplete(`❌ Failed to create campaign: ${error.message}`);
    } else {
      setSent(true);
      onComplete(`✅ Campaign "${name}" created as draft targeting ${SEGMENTS.find((s) => s.value === segment)?.label || segment}. Go to Campaigns to review and send.`);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-green-600">
        <Check className="h-4 w-4" /> Campaign created!
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 glass rounded-xl p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring Promo" className="h-8 text-xs" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Audience</label>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Channel</label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="email" className="text-xs">Email</SelectItem>
              <SelectItem value="sms" className="text-xs">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {channel === "email" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Subject Line</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject..." className="h-8 text-xs" />
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Message</label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your campaign message..."
          className="text-xs min-h-[60px] resize-none"
        />
      </div>

      <Button
        onClick={handleCreate}
        disabled={!name.trim() || !body.trim() || sending}
        className="w-full h-8 text-xs bg-gradient-champagne rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"
        size="sm"
      >
        {sending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Creating...</> : <><Send className="h-3 w-3 mr-1" /> Create Campaign Draft</>}
      </Button>
    </div>
  );
}
