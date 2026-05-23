import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Phone, Clock, ArrowLeft, ChevronDown, ChevronUp, User } from "lucide-react";
import { Link } from "react-router-dom";

type CallLog = {
  id: string;
  caller_phone: string | null;
  caller_name: string | null;
  duration_seconds: number | null;
  transcript: any;
  actions_taken: any[];
  status: string;
  created_at: string;
};

export default function VoiceCallLogs() {
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      const { data } = await supabase
        .from("voice_call_logs" as any)
        .select("*")
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setLogs((data || []) as unknown as CallLog[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });

  const statusColor = (s: string) => {
    switch (s) {
      case "completed": return "badge-teal";
      case "transferred": return "badge-prism";
      case "failed": return "badge-rose";
      default: return "badge-champagne";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dashboard/voice-agent">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-light tracking-tight">Voice Call Logs</h1>
          <p className="text-sm text-muted-foreground">
            {logs.length} call{logs.length !== 1 ? "s" : ""} recorded
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p>No calls recorded yet.</p>
            <p className="text-xs mt-1">Calls will appear here once your voice agent starts taking them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            return (
              <Card key={log.id} className="glass rounded-xl border-0 overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {log.caller_name ? (
                            <User className="h-4 w-4 text-primary" />
                          ) : (
                            <Phone className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {log.caller_name || log.caller_phone || "Unknown Caller"}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatDate(log.created_at)}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDuration(log.duration_seconds)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(log.status)}`}>
                          {log.status}
                        </span>
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </button>

                {expanded && (
                  <div className="border-t border-border px-6 py-4 space-y-4 bg-muted/30">
                    {/* Actions taken */}
                    {log.actions_taken && log.actions_taken.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Actions Taken</p>
                        <div className="space-y-1">
                          {log.actions_taken.map((action: any, i: number) => (
                            <div key={i} className="text-xs px-2 py-1 rounded bg-background border border-border">
                              <span className="font-mono text-primary">{action.tool}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transcript */}
                    {log.transcript && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Transcript</p>
                        <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
                          {Array.isArray(log.transcript) ? (
                            log.transcript.map((entry: any, i: number) => (
                              <div key={i} className={`px-3 py-2 rounded ${
                                entry.role === "agent"
                                  ? "bg-primary/10 ml-4"
                                  : "bg-background border border-border mr-4"
                              }`}>
                                <p className="font-medium text-muted-foreground mb-0.5 text-[10px] uppercase">
                                  {entry.role === "agent" ? "Agent" : "Caller"}
                                </p>
                                <p>{entry.text || entry.message || entry.content}</p>
                              </div>
                            ))
                          ) : (
                            <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded border border-border">
                              {typeof log.transcript === "string"
                                ? log.transcript
                                : JSON.stringify(log.transcript, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}

                    {!log.transcript && (
                      <p className="text-xs text-muted-foreground italic">No transcript available</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
