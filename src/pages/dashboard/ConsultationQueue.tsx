import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

type StatusFilter = "submitted" | "reviewed" | "completed" | "all";

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "submitted", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const ConsultationQueue = () => {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("submitted");
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("*, profiles:client_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      setConsultations(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredConsultations = statusFilter === "all"
    ? consultations
    : consultations.filter(c => c.status === statusFilter);

  const statusColor: Record<string, string> = {
    draft: "badge-glass",
    submitted: "badge-prism",
    reviewed: "badge-teal",
    completed: "badge-champagne",
  };

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">Consultation Queue</h1>
      <p className="text-muted-foreground mb-6 font-normal">Review and respond to client consultations</p>

      {/* Status filter */}
      <div className="flex items-center gap-1.5 mb-4">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {opt.label}
            {opt.value !== "all" && (
              <span className="ml-1 opacity-70">
                {consultations.filter(c => c.status === opt.value).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filteredConsultations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No {statusFilter === "all" ? "" : statusFilter} consultations{statusFilter !== "all" ? "" : " in the queue"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConsultations.map((c) => (
            <div key={c.id} className="glass rounded-xl border-0 flex items-center gap-4 p-4 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              {c.selfie_url && (
                <img src={c.selfie_url} alt="Client" className="h-12 w-12 rounded-full object-cover border border-border" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.profiles?.full_name || "Unknown Client"}</p>
                <p className="text-xs text-muted-foreground">
                  {c.face_shape ? `${c.face_shape} face` : "No analysis"} · {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="ai-badge"><Badge variant="secondary" className={statusColor[c.status] || ""}>{c.status}</Badge></span>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(`/dashboard/consultations/${c.id}`)}><Eye className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsultationQueue;
