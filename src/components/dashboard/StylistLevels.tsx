import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, GripVertical, Loader2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface StylistLevel {
  id: string;
  name: string;
  sort_order: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
  category: string | null;
}

interface LevelPrice {
  id: string;
  service_id: string;
  level_id: string;
  price: number;
}

interface Props {
  salonId: string;
}

const StylistLevels = ({ salonId }: Props) => {
  const [levels, setLevels] = useState<StylistLevel[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [levelPrices, setLevelPrices] = useState<LevelPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<StylistLevel | null>(null);
  const [levelName, setLevelName] = useState("");
  const [pricingLevelId, setPricingLevelId] = useState<string | null>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const fetchData = async () => {
    const [levelsRes, servicesRes, pricesRes] = await Promise.all([
      supabase.from("stylist_levels").select("*").eq("salon_id", salonId).order("sort_order"),
      supabase.from("services").select("id, name, price, category").eq("salon_id", salonId).eq("is_active", true).order("name"),
      supabase.from("service_level_prices").select("*"),
    ]);
    setLevels((levelsRes.data as StylistLevel[]) || []);
    setServices((servicesRes.data as Service[]) || []);
    setLevelPrices((pricesRes.data as LevelPrice[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [salonId]);

  const openDialog = (level?: StylistLevel) => {
    setEditingLevel(level || null);
    setLevelName(level?.name || "");
    setDialogOpen(true);
  };

  const saveLevel = async () => {
    if (!levelName.trim()) return;
    if (editingLevel) {
      const { error } = await supabase.from("stylist_levels").update({ name: levelName.trim() }).eq("id", editingLevel.id);
      if (error) { toast.error("Failed to update"); return; }
      setLevels(levels.map(l => l.id === editingLevel.id ? { ...l, name: levelName.trim() } : l));
      toast.success("Level updated");
    } else {
      const maxOrder = levels.length > 0 ? Math.max(...levels.map(l => l.sort_order)) + 1 : 0;
      const { data, error } = await supabase.from("stylist_levels").insert({
        salon_id: salonId, name: levelName.trim(), sort_order: maxOrder,
      }).select().single();
      if (error) { toast.error("Failed to create"); return; }
      setLevels([...levels, data as StylistLevel]);
      toast.success("Level created");
    }
    setDialogOpen(false);
  };

  const deleteLevel = async (id: string) => {
    const { error } = await supabase.from("stylist_levels").delete().eq("id", id);
    if (error) { toast.error("Failed to delete level"); return; }
    setLevels(levels.filter(l => l.id !== id));
    setLevelPrices(levelPrices.filter(p => p.level_id !== id));
    if (pricingLevelId === id) setPricingLevelId(null);
    toast.success("Level deleted");
  };

  const openPricing = (levelId: string) => {
    setPricingLevelId(pricingLevelId === levelId ? null : levelId);
    // Populate draft prices
    const draft: Record<string, string> = {};
    services.forEach(s => {
      const existing = levelPrices.find(p => p.level_id === levelId && p.service_id === s.id);
      draft[s.id] = existing ? String(existing.price) : "";
    });
    setDraftPrices(draft);
  };

  const savePricing = async (levelId: string) => {
    setSavingPrices(true);
    const upserts: { service_id: string; level_id: string; price: number }[] = [];
    const deleteIds: string[] = [];

    for (const svc of services) {
      const val = draftPrices[svc.id];
      const existing = levelPrices.find(p => p.level_id === levelId && p.service_id === svc.id);
      if (val && parseFloat(val) > 0) {
        upserts.push({ service_id: svc.id, level_id: levelId, price: parseFloat(val) });
      } else if (existing) {
        deleteIds.push(existing.id);
      }
    }

    let hasError = false;
    if (deleteIds.length > 0) {
      const { error } = await supabase.from("service_level_prices").delete().in("id", deleteIds);
      if (error) hasError = true;
    }
    if (upserts.length > 0) {
      const { error } = await supabase.from("service_level_prices").upsert(upserts, { onConflict: "service_id,level_id" });
      if (error) hasError = true;
    }

    if (hasError) toast.error("Failed to save some prices");
    else toast.success("Prices saved");
    await fetchData();
    setSavingPrices(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Stylist Levels</h2>
          <p className="text-sm text-muted-foreground">Create seniority tiers and set per-level service prices</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} size="sm"><Plus className="h-4 w-4 mr-1" />Add Level</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingLevel ? "Edit Level" : "Add Stylist Level"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Level Name</Label>
                <Input value={levelName} onChange={e => setLevelName(e.target.value)} placeholder="e.g. Junior, Senior, Master" onKeyDown={e => e.key === "Enter" && saveLevel()} />
              </div>
              <Button onClick={saveLevel} className="w-full" disabled={!levelName.trim()}>{editingLevel ? "Update" : "Create"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {levels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GripVertical className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No stylist levels yet. Create levels like Junior, Senior, Master to set tiered pricing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {levels.map((level, idx) => (
            <Card key={level.id} className="glass rounded-xl border-border/40">
              <CardContent className="p-4 space-y-0">
                <div className="flex items-center gap-3">
                  <Badge className="text-xs badge-champagne">{idx + 1}</Badge>
                  <span className="font-medium flex-1">{level.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => openPricing(level.id)}>
                    <DollarSign className="h-4 w-4 mr-1" />Prices
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(level)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteLevel(level.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>

                {pricingLevelId === level.id && (
                  <div className="mt-4 space-y-3">
                    <Separator />
                    <p className="text-xs text-muted-foreground">Set prices for this level. Leave blank to use the default service price.</p>
                    <div className="space-y-2">
                      {services.map(svc => (
                        <div key={svc.id} className="flex items-center gap-3">
                          <span className="text-sm flex-1 truncate">{svc.name}</span>
                          <span className="text-xs text-muted-foreground w-20 text-right">Base ${svc.price}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              className="w-24 text-right h-8 text-sm"
                              placeholder={String(svc.price)}
                              value={draftPrices[svc.id] || ""}
                              onChange={e => setDraftPrices({ ...draftPrices, [svc.id]: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" onClick={() => savePricing(level.id)} disabled={savingPrices}>
                      {savingPrices ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Save Prices
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StylistLevels;
