import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, MessageSquare, Phone, User } from "lucide-react";

interface ClientLookupWidgetProps {
  salonId: string;
  context: Record<string, any>;
  onComplete: (message: string) => void;
}

type ClientInfo = {
  user_id: string;
  full_name: string;
  phone: string | null;
  total_visits: number;
  last_visit: string | null;
  total_spent: number;
  loyalty_points: number;
};

export function ClientLookupWidget({ salonId, context, onComplete }: ClientLookupWidgetProps) {
  const [search, setSearch] = useState(context.client_name || "");
  const [results, setResults] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);

  useEffect(() => {
    if (context.client_id) {
      loadClientById(context.client_id);
    } else if (context.client_name && context.client_name.length >= 2) {
      searchClients(context.client_name);
    }
  }, []);

  const loadClientById = async (userId: string) => {
    setLoading(true);
    const info = await getClientInfo(userId);
    if (info) setSelectedClient(info);
    setLoading(false);
  };

  const searchClients = async (q: string) => {
    if (q.length < 2) return;
    setLoading(true);

    // Salon-scoped: only clients who have appointments at this salon
    const { data: appts } = await supabase
      .from("appointments")
      .select("client_id")
      .eq("salon_id", salonId);
    const clientIds = [...new Set((appts || []).map((a) => a.client_id))];

    if (clientIds.length === 0) { setResults([]); setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone")
      .ilike("full_name", `%${q}%`)
      .in("user_id", clientIds)
      .limit(5);

    const enriched: ClientInfo[] = [];
    for (const p of data || []) {
      if (!p.full_name) continue;
      const info = await getClientInfo(p.user_id);
      if (info) enriched.push(info);
    }
    setResults(enriched);
    if (enriched.length === 1) setSelectedClient(enriched[0]);
    setLoading(false);
  };

  const getClientInfo = async (userId: string): Promise<ClientInfo | null> => {
    const [{ data: profile }, { data: appts }, { data: points }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, phone").eq("user_id", userId).single(),
      supabase.from("appointments").select("id, start_time, status, services(price)").eq("salon_id", salonId).eq("client_id", userId).order("start_time", { ascending: false }),
      supabase.from("loyalty_points").select("points").eq("salon_id", salonId).eq("client_id", userId),
    ]);

    if (!profile) return null;
    const completed = (appts || []).filter((a: any) => a.status === "completed");
    return {
      user_id: profile.user_id,
      full_name: profile.full_name || "Unknown",
      phone: profile.phone,
      total_visits: completed.length,
      last_visit: completed[0]?.start_time || null,
      total_spent: completed.reduce((s: number, a: any) => s + ((a.services as any)?.price || 0), 0),
      loyalty_points: (points || []).reduce((s: number, p: any) => s + p.points, 0),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Looking up client...
      </div>
    );
  }

  if (selectedClient) {
    const c = selectedClient;
    return (
      <div className="space-y-3 pt-2 glass rounded-xl p-3">
        <div className="p-3 rounded-lg border border-border/40 bg-background/50 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{c.full_name}</p>
              {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-1.5 rounded bg-muted">
              <p className="text-sm font-semibold">{c.total_visits}</p>
              <p className="text-xs text-muted-foreground">Visits</p>
            </div>
            <div className="p-1.5 rounded bg-muted">
              <p className="text-sm font-semibold">${c.total_spent}</p>
              <p className="text-xs text-muted-foreground">Spent</p>
            </div>
            <div className="p-1.5 rounded bg-muted">
              <p className="text-sm font-semibold">{c.loyalty_points}</p>
              <p className="text-xs text-muted-foreground">Points</p>
            </div>
          </div>

          {c.last_visit && (
            <p className="text-xs text-muted-foreground">
              Last visit: {new Date(c.last_visit).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => onComplete(`📅 Open booking for ${c.full_name}`)}>
            <Calendar className="h-3 w-3 mr-1" /> Book
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => onComplete(`💬 Open message to ${c.full_name}`)}>
            <MessageSquare className="h-3 w-3 mr-1" /> Message
          </Button>
          {c.phone && (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <a href={`tel:${c.phone}`}><Phone className="h-3 w-3" /></a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 glass rounded-xl p-3">
      <div className="flex gap-2">
        <Input
          placeholder="Search client name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs rounded-lg"
          onKeyDown={(e) => e.key === "Enter" && searchClients(search)}
        />
        <Button size="sm" className="h-8 text-xs" onClick={() => searchClients(search)} disabled={search.length < 2}>
          Search
        </Button>
      </div>

      {results.length > 1 && (
        <div className="space-y-1">
          {results.map((c) => (
            <button
              key={c.user_id}
              onClick={() => setSelectedClient(c)}
              className="w-full text-left px-3 py-2 rounded-md border border-border hover:bg-accent text-xs"
            >
              <span className="font-medium">{c.full_name}</span>
              <span className="text-muted-foreground ml-2">{c.total_visits} visits · ${c.total_spent} spent</span>
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && search.length >= 2 && !loading && (
        <p className="text-xs text-muted-foreground">No clients found.</p>
      )}
    </div>
  );
}
