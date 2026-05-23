import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Monitor, Smartphone, ArrowLeft, Save, Sparkles, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { EditableIframe } from "./email-editor/EditableIframe";
import { ElementEditorDialog } from "./email-editor/ElementEditorDialog";
import { useHtmlEditor } from "./email-editor/useHtmlEditor";
import type { ElementSelection } from "./email-editor/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface EmailBuilderProps {
  salonId: string;
  campaign?: any;
  onBack: () => void;
  onSave: (data: { subject: string; body: string; ai_conversation: ChatMessage[] }) => void;
}

const EmailBuilder = ({ salonId, campaign, onBack, onSave }: EmailBuilderProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(
    campaign?.ai_conversation?.length ? (campaign.ai_conversation as ChatMessage[]) : []
  );
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [html, setHtml] = useState(campaign?.channel === "email" && campaign?.body?.startsWith("<") ? campaign.body : "");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [editMode, setEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementSelection | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const htmlEditor = useHtmlEditor(html, setHtml);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: prompt.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setPrompt("");
    setLoading(true);

    // Reset edit mode when AI is regenerating the HTML
    setEditMode(false);
    setSelectedElement(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: {
          salon_id: salonId,
          prompt: prompt.trim(),
          conversation_history: messages,
          current_html: html || undefined,
        },
      });

      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      setHtml(data.html);
      setSubject(data.subject || subject);
      htmlEditor.clearHistory();
      const assistantMsg: ChatMessage = { role: "assistant", content: data.summary || "Email updated." };
      setMessages([...updatedMessages, assistantMsg]);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate email");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave({ subject, body: html, ai_conversation: messages });
  };

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => !prev);
    setSelectedElement(null);
  }, []);

  const handleElementSelected = useCallback((selection: ElementSelection) => {
    setSelectedElement(selection);
  }, []);

  const handleApplyText = useCallback(
    (elementPath: string, newText: string, styles?: Record<string, string>) => {
      // Text + style are applied in a single DOM pass inside updateText
      htmlEditor.updateText(elementPath, newText, styles);
    },
    [htmlEditor]
  );

  const handleApplyImage = useCallback(
    (elementPath: string, newSrc: string, newAlt?: string) => {
      htmlEditor.updateImageSrc(elementPath, newSrc, newAlt);
    },
    [htmlEditor]
  );

  const handleApplyLink = useCallback(
    (elementPath: string, newHref: string, newText?: string, styles?: Record<string, string>) => {
      // Href + text + style are applied in a single DOM pass inside updateHref
      htmlEditor.updateHref(elementPath, newHref, newText, styles);
    },
    [htmlEditor]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              AI Email Builder
            </h2>
            <p className="text-xs text-muted-foreground">
              {editMode
                ? "Click any element in the preview to edit it"
                : "Describe your email and AI will design it"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo button — visible when in edit mode and history exists */}
          {editMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={htmlEditor.undo}
              disabled={!htmlEditor.canUndo}
              title="Undo last edit"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}

          {/* Edit mode toggle */}
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={toggleEditMode}
            disabled={!html}
            title={editMode ? "Exit edit mode" : "Edit elements directly"}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {editMode ? "Editing" : "Edit"}
          </Button>

          {/* Desktop / Mobile toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setPreviewMode("desktop")}
              className={`p-1.5 ${previewMode === "desktop" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPreviewMode("mobile")}
              className={`p-1.5 ${previewMode === "mobile" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" onClick={handleSave} disabled={!html} className="bg-gradient-prism rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
        </div>
      </div>

      {/* Subject line */}
      {subject && (
        <div className="mb-3">
          <Label className="text-xs text-muted-foreground">Subject Line</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="text-sm"
            placeholder="Email subject line..."
          />
        </div>
      )}

      {/* Main split view */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Chat panel */}
        <div className="w-[360px] shrink-0 flex flex-col rounded-xl overflow-hidden glass">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Describe the email you want</p>
                <p className="text-xs mt-1">e.g. &quot;20% off color services this weekend, make it feel luxurious&quot;</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-sm rounded-xl p-2.5 max-w-[90%] ${
                  msg.role === "user"
                    ? "bg-gradient-prism text-white ml-auto"
                    : "glass bg-primary/5"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating email...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generate();
              }}
              className="flex gap-2"
            >
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={html ? "Refine your email..." : "Describe the email you want..."}
                disabled={loading}
                className="text-sm"
              />
              <Button type="submit" size="sm" disabled={loading || !prompt.trim()} className="bg-gradient-prism rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Preview panel */}
        <div className="flex-1 rounded-xl overflow-hidden glass-elevated flex items-start justify-center p-4">
          {html ? (
            <EditableIframe
              html={html}
              editMode={editMode}
              previewMode={previewMode}
              onElementSelected={handleElementSelected}
            />
          ) : (
            <div className="text-center text-muted-foreground py-16">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Your email preview will appear here</p>
              <p className="text-xs mt-1">Start by describing the email in the chat</p>
            </div>
          )}
        </div>
      </div>

      {/* Element editor dialog */}
      {selectedElement && (
        <ElementEditorDialog
          selection={selectedElement}
          salonId={salonId}
          onApplyText={handleApplyText}
          onApplyImage={handleApplyImage}
          onApplyLink={handleApplyLink}
          onClose={() => setSelectedElement(null)}
        />
      )}
    </div>
  );
};

// Fallback icon if Mail isn't imported
const Mail = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export default EmailBuilder;
