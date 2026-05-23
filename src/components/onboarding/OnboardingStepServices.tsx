import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import CsvImporter from "./CsvImporter";

interface Props {
  salonId: string;
  onNext: () => void;
  onBack: () => void;
}

interface ServiceForm {
  name: string;
  price: string;
  duration_minutes: string;
  category: string;
}

const emptyService = (): ServiceForm => ({ name: "", price: "", duration_minutes: "60", category: "" });

const OnboardingStepServices = ({ salonId, onNext, onBack }: Props) => {
  const [services, setServices] = useState<any[]>([]);
  const [newServices, setNewServices] = useState<ServiceForm[]>([emptyService()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("services").select("*").eq("salon_id", salonId).then(({ data }) => {
      setServices(data || []);
      setLoading(false);
    });
  }, [salonId]);

  const addRow = () => setNewServices([...newServices, emptyService()]);
  const removeRow = (i: number) => setNewServices(newServices.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof ServiceForm, value: string) => {
    const updated = [...newServices];
    updated[i] = { ...updated[i], [field]: value };
    setNewServices(updated);
  };

  const handleSave = async () => {
    const toInsert = newServices
      .filter((s) => s.name.trim() && s.price)
      .map((s) => ({
        salon_id: salonId,
        name: s.name.trim(),
        price: parseFloat(s.price) || 0,
        duration_minutes: parseInt(s.duration_minutes) || 60,
        category: s.category || null,
      }));
    if (toInsert.length > 0) {
      setSaving(true);
      const { error } = await supabase.from("services").insert(toInsert);
      if (error) { toast.error("Failed to add services"); setSaving(false); return; }
      toast.success(`${toInsert.length} service(s) added`);
      setSaving(false);
    }
    onNext();
  };

  const handleCsvImport = async (rows: Record<string, string>[]) => {
    const toInsert = rows.map((r) => ({
      salon_id: salonId,
      name: r.name || r.Name || "",
      price: parseFloat(r.price || r.Price || "0"),
      duration_minutes: parseInt(r.duration || r.Duration || r.duration_minutes || "60"),
      category: r.category || r.Category || null,
    })).filter((s) => s.name);
    if (toInsert.length === 0) { toast.error("No valid services found"); return; }
    const { error } = await supabase.from("services").insert(toInsert);
    if (error) { toast.error("Import failed"); return; }
    toast.success(`${toInsert.length} services imported`);
    const { data } = await supabase.from("services").select("*").eq("salon_id", salonId);
    setServices(data || []);
    setNewServices([emptyService()]);
  };

  return (
    <div className="glass-elevated rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-medium">Services</h2>
        <p className="text-sm text-muted-foreground mt-1">Add the services your salon offers. You can import from a CSV or add them manually.</p>
      </div>
      <div className="space-y-6">
        {/* Existing services */}
        {services.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{services.length} service(s) already added</p>
            <div className="grid gap-2">
              {services.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 glass rounded-xl text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">${s.price} · {s.duration_minutes}min</span>
                </div>
              ))}
              {services.length > 5 && <p className="text-xs text-muted-foreground">+ {services.length - 5} more</p>}
            </div>
          </div>
        )}

        {/* CSV Import */}
        <CsvImporter
          label="Import Services from CSV"
          description="CSV should have columns: name, price, duration (minutes), category"
          onImport={handleCsvImport}
          templateCols={["name", "price", "duration", "category"]}
          templateName="services-template.csv"
        />

        {/* Manual add */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Or add manually</p>
          {newServices.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_80px_1fr_auto] gap-2 items-end">
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={s.name} onChange={(e) => updateRow(i, "name", e.target.value)} placeholder="Haircut" /></div>
              <div className="space-y-1"><Label className="text-xs">Price</Label><Input type="number" value={s.price} onChange={(e) => updateRow(i, "price", e.target.value)} placeholder="50" /></div>
              <div className="space-y-1"><Label className="text-xs">Mins</Label><Input type="number" value={s.duration_minutes} onChange={(e) => updateRow(i, "duration_minutes", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Category</Label><Input value={s.category} onChange={(e) => updateRow(i, "category", e.target.value)} placeholder="Cuts" /></div>
              <Button variant="ghost" size="icon" onClick={() => removeRow(i)} disabled={newServices.length === 1}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-full">Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onNext} className="rounded-full">Skip</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-prism text-white rounded-full">{saving ? "Saving..." : "Continue"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStepServices;
