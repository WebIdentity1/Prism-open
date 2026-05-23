import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { QuickBookWidget } from "./ai-widgets/QuickBookWidget";
import { CancelAppointmentWidget } from "./ai-widgets/CancelAppointmentWidget";
import { SendMessageWidget } from "./ai-widgets/SendMessageWidget";
import { ClientLookupWidget } from "./ai-widgets/ClientLookupWidget";
import { BlockTimeWidget } from "./ai-widgets/BlockTimeWidget";
import { SendCampaignWidget } from "./ai-widgets/SendCampaignWidget";
import { EmailPreviewWidget } from "./ai-widgets/EmailPreviewWidget";

export type WidgetData = {
  type: "quick_book" | "cancel_appointment" | "send_message" | "send_campaign" | "client_lookup" | "block_time" | "email_preview";
  context: Record<string, any>;
};

type Message = { role: "user" | "assistant"; content: string; widget?: WidgetData };

interface AiAssistantProps {
  salonId: string | null;
  userName: string;
}

export function AiAssistant({ salonId, userName }: AiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "assistant", content }]);
  }, []);

  const sendText = useCallback(async (text: string) => {
    if (!text || loading || !salonId) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Truncate history to last 30 messages to prevent exceeding model context limits
      const truncated = newMessages.length > 30
        ? newMessages.slice(-30)
        : newMessages;

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: truncated.map((m) => ({ role: m.role, content: m.content })),
          salon_id: salonId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error("AI Error", { description: data.error });
        setLoading(false);
        return;
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.content,
        widget: data.widget || undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      console.error("AI assistant error:", e);
      toast.error("Error", { description: e.message || "Failed to get AI response" });
    } finally {
      setLoading(false);
    }
  }, [loading, messages, salonId, toast]);

  const sendMessage = useCallback(() => {
    sendText(input.trim());
  }, [input, sendText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderWidget = (widget: WidgetData) => {
    if (!salonId) return null;
    const commonProps = { salonId, context: widget.context, onComplete: addSystemMessage };

    switch (widget.type) {
      case "quick_book":
        return <QuickBookWidget {...commonProps} />;
      case "cancel_appointment":
        return <CancelAppointmentWidget {...commonProps} />;
      case "send_message":
        return <SendMessageWidget {...commonProps} />;
      case "send_campaign":
        return <SendCampaignWidget {...commonProps} />;
      case "client_lookup":
        return <ClientLookupWidget {...commonProps} />;
      case "block_time":
        return <BlockTimeWidget {...commonProps} />;
      case "email_preview":
        return <EmailPreviewWidget {...commonProps} />;
      default:
        return null;
    }
  };

  if (!salonId) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col glass-elevated rounded-xl">
          <SheetHeader className="p-4 pb-2 border-b border-border/40 shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <SheetTitle className="text-base font-medium">Prism AI Assistant</SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask about your business, clients, revenue, or schedule
            </p>
          </SheetHeader>

          <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <Bot className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Hi {userName.split(" ")[0]}! Ask me anything about your salon.
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      "Book Sarah for a haircut tomorrow",
                      "How much revenue did we make this week?",
                      "Who hasn't visited in 60 days?",
                      "What's today's schedule?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendText(q)}
                        className="text-xs text-left px-3 py-2 rounded-md border border-border hover:bg-accent transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-gradient-prism text-white rounded-xl"
                        : "glass bg-primary/5 rounded-lg"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="space-y-3">
                        {msg.content && (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                        {msg.widget && renderWidget(msg.widget)}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="glass rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin ai-pulse" />
                    <span className="text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 pt-2 border-t border-border/40 shrink-0 glass-subtle">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your business..."
                disabled={loading}
                className="text-sm rounded-lg"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-gradient-prism rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
