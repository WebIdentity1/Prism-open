import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Loader2, X, Calendar, DollarSign, ClipboardList, Star, Scissors, Camera, StickyNote, Plus, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeSegment, SEGMENTS, type ClientSegment } from "@/lib/segmentation";
import { toast } from "sonner";

interface ClientRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  hair_type: string | null;
  hair_length: string | null;
  hair_texture: string | null;
  allergies: string[] | null;
  appointment_count: number;
  total_spend: number;
  last_visit: string | null;
  first_visit: string | null;
  segment: ClientSegment;
  primary_stylist_id: string | null;
  primary_stylist_name: string | null;
}

interface ClientNote {
  id: string;
  note: string;
  created_at: string;
  author_name?: string;
}

interface ClientAppt {
  id: string;
  start_time: string;
  status: string;
  service_name: string | null;
  price: number;
  stylist_name: string | null;
  notes: string | null;
}

interface ClientConsultation {
  id: string;
  created_at: string;
  status: string;
  face_shape: string | null;
  stylist_notes: string | null;
  client_notes: string | null;
}

interface ClientReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ClientPhoto {
  id: string;
  photo_url: string;
  notes: string | null;
  created_at: string;
}

const statusColor: Record<string, string> = {
  booked: "bg-primary/10 text-primary",
  confirmed: "bg-accent text-accent-foreground",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
  submitted: "bg-primary/10 text-primary",
  reviewed: "bg-accent text-accent-foreground",
  draft: "bg-muted text-muted-foreground",
};

const ClientList = () => {
  const { user, role } = useAuth(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);

  // Detail panel state
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [clientAppts, setClientAppts] = useState<ClientAppt[]>([]);
  const [clientConsults, setClientConsults] = useState<ClientConsultation[]>([]);
  const [clientReviews, setClientReviews] = useState<ClientReview[]>([]);
  const [clientPhotos, setClientPhotos] = useState<ClientPhoto[]>([]);
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [clientSearch, setClientSearch] = useState("");
  const [salonStylists, setSalonStylists] = useState<{ user_id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchClients = async () => {
      let salId: string | null = null;

      if (role === "salon_admin") {
        const { data: salon } = await supabase.from("salons").select("id").eq("owner_id", user.id).maybeSingle();
        if (!salon) { setLoading(false); return; }
        salId = salon.id;
        setSalonId(salon.id);
      }

      // For stylists, also fetch assigned clients (not just appointment-based)
      let assignedClientIds: string[] = [];
      if (role === "stylist") {
        const { data: assignments } = await supabase
          .from("client_staff_assignments")
          .select("client_id")
          .eq("stylist_id", user.id);
        assignedClientIds = (assignments || []).map((a: any) => a.client_id);
      }

      const apptQuery = role === "salon_admin" && salId
        ? supabase.from("appointments").select("client_id, start_time, services:service_id(price)").eq("salon_id", salId)
        : supabase.from("appointments").select("client_id, start_time, services:service_id(price)").eq("stylist_id", user.id);

      const { data: appts } = await apptQuery;
      const apptClientIds = [...new Set((appts || []).map((a: any) => a.client_id))];
      // Merge appointment clients + assigned clients (for stylists)
      const uniqueIds = [...new Set([...apptClientIds, ...assignedClientIds])];
      if (uniqueIds.length === 0) { setClients([]); setLoading(false); return; }

      const [profilesRes, cpRes, assignmentsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, avatar_url").in("user_id", uniqueIds),
        supabase.from("client_profiles").select("user_id, hair_type, hair_length, hair_texture, allergies").in("user_id", uniqueIds),
        salId
          ? supabase.from("client_staff_assignments").select("client_id, stylist_id").eq("salon_id", salId).in("client_id", uniqueIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Build assignment map
      const assignmentMap = new Map<string, string>(
        ((assignmentsRes as any).data || []).map((a: any) => [a.client_id, a.stylist_id])
      );

      // Fetch stylist names for assignments
      const assignedStylistIds = [...new Set(
        ((assignmentsRes as any).data || []).map((a: any) => a.stylist_id)
      )];
      let stylistNameMap = new Map<string, string>();
      if (assignedStylistIds.length > 0) {
        const { data: stylistProfiles } = await supabase
          .from("profiles").select("user_id, full_name").in("user_id", assignedStylistIds);
        stylistNameMap = new Map((stylistProfiles || []).map((p: any) => [p.user_id, p.full_name]));
      }

      // Fetch salon stylists for admin reassignment dropdown
      if (salId) {
        const { data: spData } = await supabase
          .from("stylist_profiles").select("user_id").eq("salon_id", salId);
        if (spData && spData.length > 0) {
          const stylistUserIds = spData.map((s: any) => s.user_id);
          const { data: spProfiles } = await supabase
            .from("profiles").select("user_id, full_name").in("user_id", stylistUserIds);
          setSalonStylists((spProfiles || []).map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || "Unknown" })));
        }
      }

      const cpMap = new Map((cpRes.data || []).map((cp: any) => [cp.user_id, cp]));
      const countMap = new Map<string, number>();
      const spendMap = new Map<string, number>();
      const lastVisitMap = new Map<string, string>();
      const firstVisitMap = new Map<string, string>();
      (appts || []).forEach((a: any) => {
        countMap.set(a.client_id, (countMap.get(a.client_id) || 0) + 1);
        spendMap.set(a.client_id, (spendMap.get(a.client_id) || 0) + (a.services?.price || 0));
        const cur = lastVisitMap.get(a.client_id);
        if (!cur || a.start_time > cur) lastVisitMap.set(a.client_id, a.start_time);
        const first = firstVisitMap.get(a.client_id);
        if (!first || a.start_time < first) firstVisitMap.set(a.client_id, a.start_time);
      });

      setClients(
        (profilesRes.data || []).map((p: any) => {
          const count = countMap.get(p.user_id) || 0;
          const spend = spendMap.get(p.user_id) || 0;
          const lastVisit = lastVisitMap.get(p.user_id) || null;
          const firstVisit = firstVisitMap.get(p.user_id) || null;
          const stylistId = assignmentMap.get(p.user_id) || null;
          return {
            user_id: p.user_id,
            full_name: p.full_name || "Unknown",
            phone: p.phone,
            avatar_url: p.avatar_url,
            hair_type: cpMap.get(p.user_id)?.hair_type || null,
            hair_length: cpMap.get(p.user_id)?.hair_length || null,
            hair_texture: cpMap.get(p.user_id)?.hair_texture || null,
            allergies: cpMap.get(p.user_id)?.allergies || null,
            appointment_count: count,
            total_spend: spend,
            last_visit: lastVisit,
            first_visit: firstVisit,
            segment: computeSegment(count, spend, lastVisit, firstVisit),
            primary_stylist_id: stylistId,
            primary_stylist_name: stylistId ? (stylistNameMap.get(stylistId) || null) : null,
          };
        }).sort((a: ClientRow, b: ClientRow) => b.appointment_count - a.appointment_count)
      );
      setLoading(false);
    };
    fetchClients();
  }, [user, role]);

  const openDetail = async (client: ClientRow) => {
    setSelectedClient(client);
    setDetailLoading(true);

    const filterCol = role === "salon_admin" && salonId ? "salon_id" : "stylist_id";
    const filterVal = role === "salon_admin" && salonId ? salonId : user!.id;

    const notesQuery = salonId
      ? supabase.from("client_notes").select("id, note, created_at, author_id").eq("client_id", client.user_id).eq("salon_id", salonId).order("created_at", { ascending: false }).limit(20)
      : null;

    const [apptRes, consultRes, reviewRes, photosRes, notesRes] = await Promise.all([
      supabase.from("appointments")
        .select("id, start_time, status, notes, services:service_id(name, price), stylist_profile:profiles!appointments_stylist_id_profiles_fkey(full_name)")
        .eq("client_id", client.user_id).eq(filterCol, filterVal)
        .order("start_time", { ascending: false }).limit(20),
      supabase.from("consultations")
        .select("id, created_at, status, face_shape, stylist_notes, client_notes")
        .eq("client_id", client.user_id)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("reviews")
        .select("id, rating, comment, created_at")
        .eq("client_id", client.user_id)
        .order("created_at", { ascending: false }).limit(10),
      supabase.from("appointment_photos")
        .select("id, photo_url, notes, created_at")
        .eq("client_id", client.user_id)
        .order("created_at", { ascending: false }).limit(20),
      notesQuery || Promise.resolve({ data: [] }),
    ]);

    setClientAppts((apptRes.data || []).map((a: any) => ({
      id: a.id,
      start_time: a.start_time,
      status: a.status,
      service_name: a.services?.name || null,
      price: a.services?.price || 0,
      stylist_name: a.stylist_profile?.full_name || null,
      notes: a.notes,
    })));
    setClientConsults((consultRes.data || []) as ClientConsultation[]);
    setClientReviews((reviewRes.data || []) as ClientReview[]);
    setClientPhotos((photosRes.data || []) as ClientPhoto[]);
    setClientNotes(((notesRes as any).data || []) as ClientNote[]);
    setNewNote("");
    setDetailLoading(false);
  };

  const addNote = async () => {
    if (!selectedClient || !salonId || !newNote.trim()) return;
    const { data, error } = await supabase.from("client_notes").insert({
      client_id: selectedClient.user_id,
      author_id: user!.id,
      salon_id: salonId,
      note: newNote.trim(),
    }).select().single();
    if (error) { toast.error("Failed to add note"); return; }
    setClientNotes([data as ClientNote, ...clientNotes]);
    setNewNote("");
    toast.success("Note added");
  };

  const deleteNote = async (noteId: string) => {
    await supabase.from("client_notes").delete().eq("id", noteId);
    setClientNotes(clientNotes.filter(n => n.id !== noteId));
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const filteredClients = clients.filter(c => {
    if (segmentFilter !== "all" && c.segment !== segmentFilter) return false;
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      return (c.full_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
    }
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl tracking-tight mb-1">Clients</h1>
      <p className="text-muted-foreground mb-6">
        {role === "salon_admin" ? "Clients who have booked at your salon" : "Your client profiles and hair details"}
      </p>

      {/* Search & segment filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            {Object.entries(SEGMENTS).map(([key, s]) => (
              <SelectItem key={key} value={key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No clients {clientSearch.trim() ? "matching your search" : segmentFilter !== "all" ? "in this segment" : "yet"}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((c) => {
            const seg = SEGMENTS[c.segment];
            return (
              <div
                key={c.user_id}
                className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                onClick={() => openDetail(c)}
              >
                <div className="flex items-center gap-3 mb-2">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-sm font-medium text-primary">
                      {c.full_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.full_name}</p>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    {c.primary_stylist_name && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Scissors className="h-2.5 w-2.5" />
                        {c.primary_stylist_name}
                      </p>
                    )}
                    {c.primary_stylist_id && !salonStylists.some(s => s.user_id === c.primary_stylist_id) && salonStylists.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] mt-0.5">Stylist left</Badge>
                    )}
                  </div>
                  <Badge className={`text-[10px] ${seg.color} border-0`}>{seg.label}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {c.appointment_count}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${c.total_spend}</span>
                  {c.hair_type && <Badge variant="secondary" className="text-[10px]">{c.hair_type}</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedClient.avatar_url ? (
                    <img src={selectedClient.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-sm font-medium text-primary">
                      {selectedClient.full_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p>{selectedClient.full_name}</p>
                      <Badge className={`text-[10px] ${SEGMENTS[selectedClient.segment].color} border-0`}>
                        {SEGMENTS[selectedClient.segment].label}
                      </Badge>
                    </div>
                    {selectedClient.phone && <p className="text-xs text-muted-foreground font-normal">{selectedClient.phone}</p>}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Primary Stylist Assignment (admin only) */}
              {role === "salon_admin" && salonId && (
                <div className="flex items-center gap-2 mt-1 mb-2">
                  <Scissors className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <label className="text-xs text-muted-foreground shrink-0">Primary Stylist:</label>
                  <Select
                    value={selectedClient.primary_stylist_id || "unassigned"}
                    onValueChange={async (newStylistId) => {
                      if (newStylistId === "unassigned") return;
                      const { error } = await supabase
                        .from("client_staff_assignments")
                        .upsert({
                          client_id: selectedClient.user_id,
                          stylist_id: newStylistId,
                          salon_id: salonId,
                          assigned_by: user!.id,
                        } as any, { onConflict: "client_id,salon_id" });
                      if (error) {
                        toast.error("Failed to reassign client");
                        return;
                      }
                      const newName = salonStylists.find(s => s.user_id === newStylistId)?.full_name || null;
                      setSelectedClient({ ...selectedClient, primary_stylist_id: newStylistId, primary_stylist_name: newName });
                      setClients(prev => prev.map(c =>
                        c.user_id === selectedClient.user_id
                          ? { ...c, primary_stylist_id: newStylistId, primary_stylist_name: newName }
                          : c
                      ));
                      toast.success("Client reassigned");
                    }}
                  >
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" disabled>Unassigned</SelectItem>
                      {salonStylists.map(s => (
                        <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 my-4">
                <Card><CardContent className="p-3 text-center">
                  <p className="text-lg font-semibold">{selectedClient.appointment_count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Visits</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-lg font-semibold">${selectedClient.total_spend}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Spend</p>
                </CardContent></Card>
                <Card><CardContent className="p-3 text-center">
                  <p className="text-lg font-semibold capitalize">{selectedClient.hair_type || "—"}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hair Type</p>
                </CardContent></Card>
              </div>

              {/* Hair Profile */}
              {(selectedClient.hair_length || selectedClient.hair_texture || (selectedClient.allergies && selectedClient.allergies.length > 0)) && (
                <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Hair Profile</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selectedClient.hair_length && <Badge variant="secondary">Length: {selectedClient.hair_length}</Badge>}
                    {selectedClient.hair_texture && <Badge variant="secondary">Texture: {selectedClient.hair_texture}</Badge>}
                    {selectedClient.hair_type && <Badge variant="secondary">Type: {selectedClient.hair_type}</Badge>}
                    {selectedClient.allergies?.map((a) => <Badge key={a} variant="destructive" className="text-[10px]">⚠ {a}</Badge>)}
                  </div>
                </div>
              )}

              {detailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <Tabs defaultValue="photos">
                  <TabsList className="w-full">
                    <TabsTrigger value="photos" className="flex-1">Photos</TabsTrigger>
                    <TabsTrigger value="appointments" className="flex-1">Visits</TabsTrigger>
                    <TabsTrigger value="notes" className="flex-1">Notes</TabsTrigger>
                    <TabsTrigger value="consultations" className="flex-1">Consults</TabsTrigger>
                    <TabsTrigger value="reviews" className="flex-1">Reviews</TabsTrigger>
                  </TabsList>

                  <TabsContent value="photos" className="mt-3">
                    {clientPhotos.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No photos yet</p>
                        <p className="text-xs">Photos will appear here after completing appointments</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                        {clientPhotos.map((p) => (
                          <div key={p.id} className="rounded-lg border border-border overflow-hidden">
                            <img src={p.photo_url} alt="Haircut" className="w-full h-36 object-cover" />
                            <div className="p-2">
                              <p className="text-[10px] text-muted-foreground">{format(parseISO(p.created_at), "MMM d, yyyy")}</p>
                              {p.notes && <p className="text-xs mt-0.5">{p.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="appointments" className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {clientAppts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No appointments</p>
                    ) : clientAppts.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{a.service_name || "Service"}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(a.start_time), "MMM d, yyyy 'at' h:mm a")}
                            {a.stylist_name ? ` · ${a.stylist_name}` : ""}
                          </p>
                          {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{a.notes}"</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-medium">${a.price}</span>
                          <Badge variant="secondary" className={`text-[10px] ${statusColor[a.status] || ""}`}>{a.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="notes" className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    <div className="flex gap-2">
                      <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add internal note..." rows={2} className="flex-1 text-sm" />
                      <Button size="sm" onClick={addNote} disabled={!newNote.trim()} className="self-end">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {clientNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
                    ) : clientNotes.map((n) => (
                      <div key={n.id} className="flex items-start gap-2 p-3 rounded-lg border border-border">
                        <StickyNote className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{n.note}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{format(parseISO(n.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteNote(n.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="consultations" className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {clientConsults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No consultations</p>
                    ) : clientConsults.map((c) => (
                      <div key={c.id} className="p-3 rounded-lg border border-border space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{c.face_shape ? `Face: ${c.face_shape}` : "Consultation"}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{format(parseISO(c.created_at), "MMM d, yyyy")}</span>
                            <Badge variant="secondary" className={`text-[10px] ${statusColor[c.status] || ""}`}>{c.status}</Badge>
                          </div>
                        </div>
                        {c.client_notes && <p className="text-xs text-muted-foreground">Client: {c.client_notes}</p>}
                        {c.stylist_notes && <p className="text-xs text-muted-foreground">Stylist: {c.stylist_notes}</p>}
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="reviews" className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {clientReviews.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No reviews</p>
                    ) : clientReviews.map((r) => (
                      <div key={r.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star key={i} className={`h-3 w-3 ${i <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "MMM d, yyyy")}</span>
                        </div>
                        {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientList;
