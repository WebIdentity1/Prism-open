import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Phone, PhoneCall, Settings, Mic, ArrowRight, Play, Square, Check, MessageCircle, Gauge } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { VoiceAgentDemo } from "@/components/dashboard/VoiceAgentDemo";

const VOICE_PRESETS = [
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep, warm male voice" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Soft, friendly female voice" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "Professional British male" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", description: "Clear, professional female" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", description: "Warm, conversational female" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Friendly, casual male" },
];

export default function VoiceAgent() {
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agent, setAgent] = useState<any>(null);

  // Form state
  const [isActive, setIsActive] = useState(true);
  const [voiceId, setVoiceId] = useState("pNInz6obpgDQGcFmaJgB");
  const [greeting, setGreeting] = useState("Hello! Thank you for calling. How can I help you today?");
  const [transferPhone, setTransferPhone] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneType, setPhoneType] = useState("twilio");
  const [speed, setSpeed] = useState(1.0);

  // Demo dialog
  const [demoOpen, setDemoOpen] = useState(false);

  // Voice preview state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingVoiceId(null);
  }, []);

  const handlePreview = useCallback(async (previewVoiceId: string) => {
    // Toggle off if already playing this voice
    if (playingVoiceId === previewVoiceId) {
      stopPreview();
      return;
    }
    stopPreview();

    // Check cache first
    const cached = audioCacheRef.current.get(previewVoiceId);
    if (cached) {
      const audio = new Audio(cached);
      audioRef.current = audio;
      setPlayingVoiceId(previewVoiceId);
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      return;
    }

    // Fetch from edge function
    setLoadingVoiceId(previewVoiceId);
    try {
      const resp = await supabase.functions.invoke("preview-voice", {
        body: { voice_id: previewVoiceId },
      });
      if (resp.error) throw resp.error;
      if (resp.data?.error) throw new Error(resp.data.error);

      // Decode base64 audio to blob URL
      const base64 = resp.data.audio;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      audioCacheRef.current.set(previewVoiceId, url);

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingVoiceId(previewVoiceId);
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
    } catch (e: any) {
      toast.error("Preview failed", { description: e.message });
    } finally {
      setLoadingVoiceId(null);
    }
  }, [playingVoiceId, stopPreview]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopPreview();
      audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [stopPreview]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: salon } = await supabase
        .from("salons")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!salon) { setLoading(false); return; }
      setSalonId(salon.id);

      // Load existing voice agent config
      const { data: va } = await supabase
        .from("salon_voice_agents" as any)
        .select("*")
        .eq("salon_id", salon.id)
        .maybeSingle();

      if (va) {
        setAgent(va);
        setIsActive((va as any).is_active);
        setVoiceId((va as any).voice_id || "pNInz6obpgDQGcFmaJgB");
        setGreeting((va as any).greeting || "");
        setTransferPhone((va as any).transfer_phone || "");
        setPhoneNumber((va as any).phone_number || "");
        setPhoneType((va as any).phone_type || "twilio");
        setSpeed((va as any).speed ?? 1.0);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSetup = async () => {
    if (!salonId) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("setup-voice-agent", {
        body: {
          action: "create",
          salon_id: salonId,
          voice_id: voiceId,
          greeting,
          transfer_phone: transferPhone || null,
          phone_number: phoneNumber || null,
          phone_type: phoneType,
          speed,
        },
      });

      if (resp.error) throw resp.error;
      const result = resp.data;
      if (result.error) throw new Error(result.error);

      setAgent(result.voice_agent);
      toast.success("Voice agent created!", { description: "Your AI receptionist is now active." });
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!salonId) return;
    setSaving(true);
    try {
      const resp = await supabase.functions.invoke("setup-voice-agent", {
        body: {
          action: "update",
          salon_id: salonId,
          voice_id: voiceId,
          greeting,
          transfer_phone: transferPhone || null,
          phone_number: phoneNumber || null,
          phone_type: phoneType,
          is_active: isActive,
          speed,
        },
      });

      if (resp.error) throw resp.error;
      const result = resp.data;
      if (result.error) throw new Error(result.error);

      setAgent(result.voice_agent);
      toast.success("Updated", { description: "Voice agent settings saved." });
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!salonId) return;
    setSaving(true);
    try {
      const resp = await supabase.functions.invoke("setup-voice-agent", {
        body: { action: "delete", salon_id: salonId },
      });

      if (resp.error) throw resp.error;
      setAgent(null);
      setPhoneNumber("");
      setTransferPhone("");
      toast.success("Deleted", { description: "Voice agent has been removed." });
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!salonId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>No salon found. Please complete salon setup first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight">AI Voice Agent</h1>
          <p className="text-sm text-muted-foreground">
            Set up an AI receptionist to answer your salon's phone calls
          </p>
        </div>
        {agent && (
          <Link to="/dashboard/voice-call-logs">
            <Button variant="outline" size="sm" className="rounded-full">
              <PhoneCall className="h-4 w-4 mr-2" /> Call Logs <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>

      {/* Status card */}
      {agent && (
        <Card className="glass-elevated rounded-xl border-0">
          <CardContent className="pt-6 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ai-pulse ${isActive ? "bg-green-500" : "bg-gray-400"}`} />
                <div>
                  <p className="text-sm font-medium">{isActive ? "Active" : "Paused"}</p>
                  <p className="text-xs text-muted-foreground">
                    Agent ID: {(agent as any).elevenlabs_agent_id?.slice(0, 12)}...
                  </p>
                </div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Try Demo card */}
      {agent && (
        <Card
          className="glass-elevated rounded-xl border-0 cursor-pointer group hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 overflow-hidden relative"
          onClick={() => setDemoOpen(true)}
        >
          {/* Ambient glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-prism/10 blur-[50px] pointer-events-none" />
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-prism to-prism-light flex items-center justify-center voice-orb-idle">
                  <Mic className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-medium">
                    Try Voice Demo
                  </h3>
                  <span className="ai-badge text-[10px]">AI</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Talk to your AI receptionist right in the browser — no phone call needed
                </p>
              </div>
              <MessageCircle className="h-5 w-5 text-prism-light opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardContent>
        </Card>
      )}

      <VoiceAgentDemo
        open={demoOpen}
        onOpenChange={setDemoOpen}
        hasAgent={!!agent}
      />

      {/* Voice selection */}
      <Card className="glass-elevated rounded-xl border-0">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Mic className="h-5 w-5" /> Voice <span className="ai-badge text-[10px] ml-1">AI</span>
          </CardTitle>
          <CardDescription>Choose the voice your AI receptionist will use — click play to preview</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {VOICE_PRESETS.map((v) => {
            const isSelected = voiceId === v.id;
            const isPlaying = playingVoiceId === v.id;
            const isLoading = loadingVoiceId === v.id;

            return (
              <div
                key={v.id}
                onClick={() => setVoiceId(v.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                {/* Play / Stop button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(v.id);
                  }}
                  disabled={isLoading}
                  className={cn(
                    "shrink-0 flex items-center justify-center h-9 w-9 rounded-full border transition-colors",
                    isPlaying
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary hover:text-primary"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPlaying ? (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </button>

                {/* Voice info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{v.name}</p>
                  <p className="text-xs text-muted-foreground">{v.description}</p>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="shrink-0 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Speed */}
      <Card className="glass rounded-xl border-0">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Gauge className="h-5 w-5" /> Speaking Speed
          </CardTitle>
          <CardDescription>Adjust how fast or slow the agent speaks (0.7–1.2x)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground w-12">Slower</span>
            <input
              type="range"
              min={0.7}
              max={1.2}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-secondary accent-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground w-12 text-right">Faster</span>
          </div>
          <p className="text-center text-sm font-medium text-prism-light">{speed.toFixed(2)}x</p>
        </CardContent>
      </Card>

      {/* Greeting */}
      <Card className="glass rounded-xl border-0">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Phone className="h-5 w-5" /> Greeting
          </CardTitle>
          <CardDescription>The first thing callers will hear</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="Hello! Thank you for calling..."
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>

      {/* Phone configuration */}
      <Card className="glass rounded-xl border-0">
        <CardHeader className="p-6">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Settings className="h-5 w-5" /> Phone Configuration
          </CardTitle>
          <CardDescription>Connect a phone number for the voice agent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Connection Type</Label>
            <Select value={phoneType} onValueChange={setPhoneType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio">Twilio Number</SelectItem>
                <SelectItem value="sip">SIP / Call Forwarding</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder={phoneType === "twilio" ? "+1234567890 (Twilio number)" : "Your business phone number"}
            />
            <p className="text-xs text-muted-foreground">
              {phoneType === "twilio"
                ? "Enter your Twilio phone number to connect directly"
                : "Enter your existing business number — forward calls to the voice agent"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Transfer Phone (for human handoff)</Label>
            <Input
              value={transferPhone}
              onChange={(e) => setTransferPhone(e.target.value)}
              placeholder="+1234567890"
            />
            <p className="text-xs text-muted-foreground">
              When a caller asks to speak with a person, they'll be transferred to this number
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {agent ? (
          <>
            <Button onClick={handleUpdate} disabled={saving} className="flex-1 bg-gradient-teal text-white rounded-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving} className="rounded-full">
              Delete Agent
            </Button>
          </>
        ) : (
          <Button onClick={handleSetup} disabled={saving} className="flex-1 bg-gradient-prism text-white rounded-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PhoneCall className="h-4 w-4 mr-2" />}
            Create Voice Agent
          </Button>
        )}
      </div>
    </div>
  );
}
