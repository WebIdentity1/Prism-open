import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Check } from "lucide-react";

interface SendMessageWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

type Client = { user_id: string; full_name: string; phone: string | null };

export function SendMessageWidget({ salonId, context, onComplete }: SendMessageWidgetProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState(context.client_name || "");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [messageText, setMessageText] = useState(context.message_hint || "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Search clients (salon-scoped: only clients who have appointments at this salon)
  useEffect(() => {
    if (clientSearch.length < 2) { setClients([]); return; }
    const timer = setTimeout(async () => {
      const { data: appts } = await supabase
        .from("appointments")
        .select("client_id")
        .eq("salon_id", salonId);
      const clientIds = [...new Set((appts || []).map((a) => a.client_id))];
      if (clientIds.length === 0) { setClients([]); return; }

      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .ilike("full_name", `%${clientSearch}%`)
        .in("user_id", clientIds)
        .limit(5);
      setClients((data || []).filter((p) => p.full_name) as Client[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, salonId]);

  const handleSend = async () => {
    if (!selectedClient || !messageText.trim()) return;
    setSending(true);

    try {
      const { error } = await supabase.functions.invoke("send-message", {
        body: {
          recipient_id: selectedClient.user_id,
          body: messageText.trim(),
          salon_id: salonId,
        },
      });

      if (error) throw error;
      setSent(true);
      onComplete(`✅ Message sent to ${selectedClient.full_name}`);
    } catch (e: any) {
      onComplete(`❌ Failed to send: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-green-600">
        <Check className="h-4 w-4" /> Message sent!
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2 glass rounded-xl p-3">
      {/* Client */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        {selectedClient ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">{selectedClient.full_name}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setSelectedClient(null); setClientSearch(""); }}>
              Change
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              placeholder="Search client name..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="h-8 text-xs"
            />
            {clients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md">
                {clients.map((c) => (
                  <button
                    key={c.user_id}
                    onClick={() => { setSelectedClient(c); setClientSearch(c.full_name); }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {c.full_name} {c.phone && <span className="text-muted-foreground ml-1">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Message</label>
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type your message..."
          className="text-xs min-h-[60px] resize-none"
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={!selectedClient || !messageText.trim() || sending}
        className="w-full h-8 text-xs"
        size="sm"
      >
        {sending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending...</> : <><Send className="h-3 w-3 mr-1" /> Send Message</>}
      </Button>
    </div>
  );
}
