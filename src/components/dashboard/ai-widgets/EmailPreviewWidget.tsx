import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, ExternalLink, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface EmailPreviewWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

export function EmailPreviewWidget({ salonId, context, onComplete }: EmailPreviewWidgetProps) {
  const { campaign_id, subject } = context;
  const [html, setHtml] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!campaign_id) { setLoading(false); return; }
    supabase
      .from("campaigns")
      .select("body, name, subject, status")
      .eq("id", campaign_id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoading(false);
          return;
        }
        setHtml(data.body);
        setCampaignName(data.name);
        if (data.status === "sent") setSent(true);
        setLoading(false);
      });
  }, [campaign_id]);

  const handleSendNow = async () => {
    if (!campaign_id) return;
    setSending(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", campaign_id)
        .eq("salon_id", salonId);

      if (error) throw error;
      setSent(true);
      onComplete(`✅ Campaign "${campaignName}" has been sent!`);
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSending(false);
    }
  };

  const handleEditInBuilder = () => {
    navigate(`/dashboard/campaigns?edit=${campaign_id}`);
    onComplete("Opening campaign in the Email Builder...");
  };

  const handleSaveAsDraft = () => {
    onComplete(`📁 Campaign "${campaignName}" saved as draft. You can edit and send it from the Campaigns page.`);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading email preview...
      </div>
    );
  }

  if (!html) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Could not load email preview.
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-green-600">
        <Check className="h-4 w-4" /> Campaign sent!
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 glass-elevated rounded-xl p-3">
      {/* Subject line */}
      {(subject || context.subject) && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Subject:</span> {subject || context.subject}
        </div>
      )}

      {/* Email iframe preview */}
      <div className="rounded-lg border border-border/40 overflow-hidden bg-background/50">
        <div className="text-xs text-muted-foreground px-2 py-1 glass-subtle border-b border-border/40">
          Email Preview
        </div>
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          className="w-full"
          style={{ height: "280px", border: "none" }}
          title="Email preview"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSendNow}
          disabled={sending}
          size="sm"
          className="w-full h-8 text-xs"
        >
          {sending ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending...</>
          ) : (
            <><Send className="h-3 w-3 mr-1" /> Send Now</>
          )}
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={handleEditInBuilder}
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
          >
            <ExternalLink className="h-3 w-3 mr-1" /> Edit in Builder
          </Button>
          <Button
            onClick={handleSaveAsDraft}
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" /> Save as Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
