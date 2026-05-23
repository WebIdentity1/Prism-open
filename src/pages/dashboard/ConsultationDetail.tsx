import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Save, CheckCircle2, Eye, Calendar, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ConsultationData {
  id: string;
  client_id: string;
  selfie_url: string | null;
  face_shape: string | null;
  face_shape_confidence: number | null;
  face_analysis_notes: string | null;
  client_notes: string | null;
  stylist_notes: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

interface StyleBoardItem {
  id: string;
  try_on_result_url: string | null;
  notes: string | null;
  is_selected: boolean | null;
  style_gallery: { name: string; image_url: string } | null;
}

const statusFlow = ["submitted", "reviewed", "completed"] as const;
const statusColor: Record<string, string> = {
  draft: "badge-glass",
  submitted: "badge-prism",
  reviewed: "badge-teal",
  completed: "badge-champagne",
};

const ConsultationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth(false);
  const [consultation, setConsultation] = useState<ConsultationData | null>(null);
  const [styleItems, setStyleItems] = useState<StyleBoardItem[]>([]);
  const [stylistNotes, setStylistNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [{ data: consult }, { data: items }] = await Promise.all([
        supabase
          .from("consultations")
          .select("*, profiles:client_id(full_name)")
          .eq("id", id)
          .single(),
        supabase
          .from("style_board_items")
          .select("*, style_gallery:style_id(name, image_url)")
          .eq("consultation_id", id)
          .order("is_selected", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (consult) {
        setConsultation(consult as any);
        setStylistNotes(consult.stylist_notes || "");
      }
      setStyleItems((items as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("consultations")
      .update({ stylist_notes: stylistNotes })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notes saved");
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id) return;
    const updates: any = { status: newStatus };
    if (newStatus === "reviewed" && user) updates.stylist_id = user.id;
    const { error } = await supabase.from("consultations").update(updates).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setConsultation((prev) => prev ? { ...prev, status: newStatus, ...(updates.stylist_id ? { stylist_id: updates.stylist_id } : {}) } : prev);
      toast.success(`Status updated to ${newStatus}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Consultation not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/dashboard/consultations")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Queue
        </Button>
      </div>
    );
  }

  const currentIdx = statusFlow.indexOf(consultation.status as any);
  const nextStatus = currentIdx >= 0 && currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => navigate("/dashboard/consultations")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Queue
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tight">
            {(consultation.profiles as any)?.full_name || "Unknown Client"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date(consultation.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={statusColor[consultation.status] || ""}>
            {consultation.status}
          </Badge>
          {nextStatus && (
            <Button size="sm" onClick={() => handleStatusUpdate(nextStatus)} className="bg-gradient-prism text-white rounded-full">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark {nextStatus}
            </Button>
          )}
        </div>
      </div>

      {/* Selfie + Face Analysis */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {consultation.selfie_url && (
          <div className="glass rounded-xl border-0 overflow-hidden">
            <img src={consultation.selfie_url} alt="Client selfie" className="w-full aspect-[3/4] object-cover" />
          </div>
        )}
        <div className="space-y-4">
          <div className="glass-elevated rounded-xl border-0 p-5 ring-1 ring-primary/10">
            <h3 className="font-medium mb-3 text-sm flex items-center gap-2"><span className="ai-badge">AI</span> Face Analysis</h3>
            {consultation.face_shape ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Face Shape</span>
                  <span className="font-medium capitalize">{consultation.face_shape.replace("_", " ")}</span>
                </div>
                {consultation.face_shape_confidence != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confidence</span>
                    <span className="font-medium">{Math.round(consultation.face_shape_confidence * 100)}%</span>
                  </div>
                )}
                {consultation.face_analysis_notes && (
                  <p className="text-sm text-muted-foreground pt-2 border-t border-border">{consultation.face_analysis_notes}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No analysis available</p>
            )}
          </div>

          {consultation.client_notes && (
            <div className="glass rounded-xl border-0 p-5">
              <h3 className="font-medium mb-2 text-sm">Client Notes</h3>
              <p className="text-sm text-muted-foreground">{consultation.client_notes}</p>
            </div>
          )}

          <div className="glass rounded-xl border-0 p-5">
            <h3 className="font-medium mb-2 text-sm">Stylist Notes</h3>
            <Textarea
              placeholder="Add your notes about this consultation..."
              value={stylistNotes}
              onChange={(e) => setStylistNotes(e.target.value)}
              rows={4}
              className="mb-3"
            />
            <Button size="sm" onClick={handleSaveNotes} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Try-on Results / Style Board Items */}
      {styleItems.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4">
            Selected Styles & Try-Ons ({styleItems.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {styleItems.map((item) => (
              <div key={item.id} className="glass rounded-xl border-0 overflow-hidden hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
                {(item.try_on_result_url || item.style_gallery?.image_url) && (
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={item.try_on_result_url || item.style_gallery?.image_url || ""}
                      alt={item.style_gallery?.name || "Style"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.style_gallery?.name || "Custom Style"}</p>
                    {item.is_selected && (
                      <Badge className="bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400 border-0 text-[10px]">
                        <Heart className="h-3 w-3 mr-0.5 fill-current" /> Favorite
                      </Badge>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                  {item.try_on_result_url && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      <Eye className="h-3 w-3 mr-1" /> Try-on result
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationDetail;
