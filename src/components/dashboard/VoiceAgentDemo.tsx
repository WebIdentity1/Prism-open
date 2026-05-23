import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, PhoneOff, X, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
}

type Status = "idle" | "connecting" | "connected";
type Mode = "listening" | "speaking";

interface VoiceAgentDemoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasAgent: boolean;
}

/* ─── Helpers ─── */
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function int16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/* ─── Component ─── */
export function VoiceAgentDemo({
  open,
  onOpenChange,
  hasAgent,
}: VoiceAgentDemoProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [mode, setMode] = useState<Mode>("listening");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [inputLevel, setInputLevel] = useState(0);

  // Refs for audio / WS lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef(0);
  const conversationReadyRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  /* ─── Audio playback ─── */
  const enqueueAudio = useCallback((base64: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const raw = base64ToArrayBuffer(base64);
    const int16 = new Int16Array(raw);
    const float32 = int16ToFloat32(int16);

    const buffer = ctx.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    source.onended = () => {
      const idx = activeSourcesRef.current.indexOf(source);
      if (idx >= 0) activeSourcesRef.current.splice(idx, 1);
    };
    activeSourcesRef.current.push(source);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.05, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }, []);

  const stopPlayback = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  }, []);

  /* ─── Cleanup ─── */
  const cleanup = useCallback(() => {
    conversationReadyRef.current = false;

    // Microphone
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    // Capture context
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        /* ok */
      }
    }
    processorRef.current = null;
    captureCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;

    // Playback
    stopPlayback();
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;

    // WebSocket
    if (
      wsRef.current &&
      wsRef.current.readyState !== WebSocket.CLOSED &&
      wsRef.current.readyState !== WebSocket.CLOSING
    ) {
      wsRef.current.close();
    }
    wsRef.current = null;
  }, [stopPlayback]);

  /* ─── Start ─── */
  const startConversation = useCallback(async () => {
    if (!hasAgent) return;
    try {
      setStatus("connecting");
      setTranscript([]);
      setMode("listening");

      // 1. Microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Signed URL from edge function
      const { data, error } = await supabase.functions.invoke(
        "voice-agent-demo"
      );
      if (error || !data?.signed_url) {
        throw new Error(
          data?.error || "Failed to get conversation URL"
        );
      }

      // 3. Capture AudioContext (target 16 kHz)
      let captureCtx: AudioContext;
      try {
        captureCtx = new AudioContext({ sampleRate: 16000 });
      } catch {
        captureCtx = new AudioContext();
      }
      captureCtxRef.current = captureCtx;

      const needsResample = captureCtx.sampleRate !== 16000;
      const resampleRatio = 16000 / captureCtx.sampleRate;

      const micSource = captureCtx.createMediaStreamSource(stream);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Silent sink — ScriptProcessor must be connected to work
      const silentGain = captureCtx.createGain();
      silentGain.gain.value = 0;
      micSource.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(captureCtx.destination);

      // 4. Playback context
      let playbackCtx: AudioContext;
      try {
        playbackCtx = new AudioContext({ sampleRate: 16000 });
      } catch {
        playbackCtx = new AudioContext();
      }
      playbackCtxRef.current = playbackCtx;
      nextPlayTimeRef.current = 0;

      // 5. WebSocket
      const ws = new WebSocket(data.signed_url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case "conversation_initiation_metadata":
              conversationReadyRef.current = true;
              setStatus("connected");
              break;

            case "audio":
              if (msg.audio_event?.audio_base_64) {
                enqueueAudio(msg.audio_event.audio_base_64);
              }
              setMode("speaking");
              break;

            case "agent_response":
              if (msg.agent_response_event?.agent_response) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    role: "agent",
                    text: msg.agent_response_event.agent_response,
                  },
                ]);
              }
              break;

            case "user_transcript":
              if (msg.user_transcription_event?.user_transcript) {
                setTranscript((prev) => [
                  ...prev,
                  {
                    role: "user",
                    text: msg.user_transcription_event.user_transcript,
                  },
                ]);
              }
              setMode("listening");
              break;

            case "interruption":
              stopPlayback();
              setMode("listening");
              break;

            case "ping":
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: "pong",
                    event_id: msg.ping_event?.event_id,
                  })
                );
              }
              break;
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };

      ws.onerror = () => {
        toast.error("Voice connection error");
      };

      ws.onclose = () => {
        setStatus("idle");
        setMode("listening");
        setInputLevel(0);
        cleanup();
      };

      // 6. Start sending audio once conversation is ready
      processor.onaudioprocess = (e) => {
        if (
          !conversationReadyRef.current ||
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN
        )
          return;

        const input = e.inputBuffer.getChannelData(0);

        // RMS for visualization
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        setInputLevel(Math.sqrt(sum / input.length));

        // Resample if needed
        let samples: Float32Array;
        if (needsResample) {
          const newLen = Math.round(input.length * resampleRatio);
          samples = new Float32Array(newLen);
          for (let i = 0; i < newLen; i++) {
            const srcIdx = i / resampleRatio;
            const floor = Math.floor(srcIdx);
            const ceil = Math.min(floor + 1, input.length - 1);
            const frac = srcIdx - floor;
            samples[i] = input[floor] * (1 - frac) + input[ceil] * frac;
          }
        } else {
          samples = new Float32Array(input);
        }

        const pcm = float32ToInt16(samples);
        const base64 = arrayBufferToBase64(pcm.buffer);
        wsRef.current.send(JSON.stringify({ user_audio_chunk: base64 }));
      };
    } catch (err: any) {
      console.error("Failed to start voice demo:", err);
      if (err.name === "NotAllowedError") {
        toast.error(
          "Microphone access denied. Please allow microphone access in your browser."
        );
      } else {
        toast.error(err.message || "Failed to start voice demo");
      }
      setStatus("idle");
      cleanup();
    }
  }, [hasAgent, cleanup, enqueueAudio, stopPlayback]);

  /* ─── End ─── */
  const endConversation = useCallback(() => {
    cleanup();
    setStatus("idle");
    setMode("listening");
    setInputLevel(0);
  }, [cleanup]);

  /* ─── Dialog close ─── */
  const handleClose = useCallback(() => {
    endConversation();
    setTranscript([]);
    onOpenChange(false);
  }, [endConversation, onOpenChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // End conversation when dialog closes
  useEffect(() => {
    if (!open && status !== "idle") {
      endConversation();
    }
  }, [open, status, endConversation]);

  const isActive = status === "connected";
  const isConnecting = status === "connecting";
  const isSpeaking = mode === "speaking" && isActive;
  const isListening = mode === "listening" && isActive;

  // Scale orb slightly with input level when listening
  const orbScale = isListening ? 1 + Math.min(inputLevel * 4, 0.15) : 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass-elevated rounded-[24px] border-0 p-0 overflow-hidden gap-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Voice Agent Demo</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-2">
            <div className="ai-pulse" />
            <span
              className="text-xs font-medium text-champagne uppercase tracking-wider"

            >
              Voice Demo
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full h-8 w-8 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Orb area */}
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="relative flex items-center justify-center w-52 h-52">
            {/* Animated rings */}
            {isActive && (
              <>
                <div
                  className={cn(
                    "absolute inset-0 rounded-full border-2 voice-ring",
                    isSpeaking
                      ? "border-glass-teal/40"
                      : "border-prism/30"
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-0 rounded-full border voice-ring voice-ring-delay-1",
                    isSpeaking
                      ? "border-glass-teal/25"
                      : "border-prism/15"
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-0 rounded-full border voice-ring voice-ring-delay-2",
                    isSpeaking
                      ? "border-glass-teal/15"
                      : "border-prism/10"
                  )}
                />
              </>
            )}

            {/* Connecting ring */}
            {isConnecting && (
              <div className="absolute inset-4 rounded-full border-2 border-prism/30 animate-ping" />
            )}

            {/* Ambient glow */}
            <div
              className={cn(
                "absolute w-32 h-32 rounded-full blur-[40px] transition-all duration-700",
                isActive && isSpeaking && "bg-glass-teal/20",
                isActive && !isSpeaking && "bg-prism/15",
                isConnecting && "bg-prism/10 animate-pulse",
                !isActive && !isConnecting && "bg-prism/5"
              )}
            />

            {/* Central orb button */}
            <button
              onClick={isActive ? endConversation : startConversation}
              disabled={isConnecting || !hasAgent}
              style={{ transform: `scale(${orbScale})` }}
              className={cn(
                "relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
                isActive &&
                  isSpeaking &&
                  "bg-gradient-to-br from-glass-teal to-glass-teal-light voice-orb-speaking",
                isActive &&
                  !isSpeaking &&
                  "bg-gradient-to-br from-prism to-prism-light shadow-[0_0_30px_rgba(123,97,255,0.3)]",
                isConnecting &&
                  "bg-gradient-to-br from-prism/70 to-prism-light/70",
                !isActive &&
                  !isConnecting &&
                  "bg-gradient-to-br from-prism to-prism-light voice-orb-idle hover:shadow-[0_0_25px_rgba(123,97,255,0.3)]",
                "disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              )}
            >
              {isConnecting ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : isActive ? (
                <PhoneOff className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </button>
          </div>

          {/* Status text */}
          <div className="mt-4 text-center">
            <p
              className={cn(
                "text-sm font-medium transition-colors duration-300",
                isSpeaking && "text-glass-teal",
                isListening && "text-prism-light",
                isConnecting && "text-muted-foreground",
                !isActive && !isConnecting && "text-muted-foreground"
              )}
            >
              {!hasAgent
                ? "Set up a voice agent first"
                : isConnecting
                  ? "Connecting..."
                  : isSpeaking
                    ? "Agent is speaking..."
                    : isActive
                      ? "Listening..."
                      : "Tap to start a conversation"}
            </p>
            {!isActive && !isConnecting && hasAgent && (
              <p className="text-xs text-muted-foreground/50 mt-1">
                Microphone access required
              </p>
            )}
          </div>
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="border-t border-border/30">
            <div className="flex items-center gap-2 px-5 pt-3 pb-1">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                Transcript
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto px-5 pb-4 space-y-2.5">
              {transcript.map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    entry.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      entry.role === "user"
                        ? "bg-prism/15 text-foreground rounded-br-md"
                        : "glass rounded-bl-md text-foreground"
                    )}
                  >
                    {entry.text}
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {/* End button when active */}
        {isActive && (
          <div className="px-5 pb-5 flex justify-center">
            <Button
              onClick={endConversation}
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full text-xs h-8"
            >
              End Conversation
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
