import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Scissors, Plus, Trash2, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const emptyForm = { name: "", description: "", price: "", member_price: "", duration_minutes: "60", category: "" };

const ServicesManager = () => {
  const { user } = useAuth(false);
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });

  // Forms linking
  const [salonForms, setSalonForms] = useState<any[]>([]);
  const [serviceFormLinks, setServiceFormLinks] = useState<Record<string, { form_id: string; is_required: boolean }[]>>({});
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const [formsDialogOpen, setFormsDialogOpen] = useState(false);
  const [formsEditingServiceId, setFormsEditingServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: salonData } = await supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle();
      setSalon(salonData);
      if (salonData) {
        const [servicesRes, formsRes, linksRes] = await Promise.all([
          supabase.from("services").select("*").eq("salon_id", salonData.id).order("name"),
          supabase.from("forms").select("id, title, is_active").eq("salon_id", salonData.id),
          supabase.from("service_forms").select("*"),
        ]);
        setServices(servicesRes.data || []);
        setSalonForms((formsRes.data || []).filter((f: any) => f.is_active));

        // Group links by service_id
        const links: Record<string, { form_id: string; is_required: boolean }[]> = {};
        for (const link of (linksRes.data || []) as any[]) {
          if (!links[link.service_id]) links[link.service_id] = [];
          links[link.service_id].push({ form_id: link.form_id, is_required: link.is_required });
        }
        setServiceFormLinks(links);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const openDialog = (service?: any) => {
    if (service) {
      setEditingService(service);
      setForm({
        name: service.name || "",
        description: service.description || "",
        price: String(service.price),
        member_price: service.member_price ? String(service.member_price) : "",
        duration_minutes: String(service.duration_minutes),
        category: service.category || "",
      });
    } else {
      setEditingService(null);
      setForm({ ...emptyForm });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!salon || !form.name || !form.price) return;
    const payload = {
      salon_id: salon.id,
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price),
      member_price: form.member_price ? parseFloat(form.member_price) : null,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      category: form.category || null,
    };

    if (editingService) {
      const { error } = await supabase.from("services").update(payload).eq("id", editingService.id);
      if (error) { toast.error("Failed to update service"); return; }
      setServices(services.map((s) => (s.id === editingService.id ? { ...s, ...payload } : s)));
      toast.success("Service updated");
    } else {
      const { data, error } = await supabase.from("services").insert(payload).select().single();
      if (error) { toast.error("Failed to add service"); return; }
      setServices([...services, data]);
      toast.success("Service added");
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    setServices(services.filter((s) => s.id !== id));
    toast.success("Service removed");
  };

  const openFormsDialog = (serviceId: string) => {
    setFormsEditingServiceId(serviceId);
    const current = serviceFormLinks[serviceId] || [];
    setSelectedFormIds(current.map(l => l.form_id));
    setFormsDialogOpen(true);
  };

  const saveFormLinks = async () => {
    if (!formsEditingServiceId) return;
    // Delete existing links for this service
    await supabase.from("service_forms").delete().eq("service_id", formsEditingServiceId);
    // Insert new links
    if (selectedFormIds.length > 0) {
      const inserts = selectedFormIds.map(form_id => ({
        service_id: formsEditingServiceId,
        form_id,
        is_required: true,
      }));
      await supabase.from("service_forms").insert(inserts);
    }
    // Update local state
    setServiceFormLinks(prev => ({
      ...prev,
      [formsEditingServiceId]: selectedFormIds.map(form_id => ({ form_id, is_required: true })),
    }));
    setFormsDialogOpen(false);
    toast.success("Form links updated");
  };

  const toggleFormSelection = (formId: string) => {
    setSelectedFormIds(prev =>
      prev.includes(formId) ? prev.filter(id => id !== formId) : [...prev, formId]
    );
  };

  const getLinkedFormCount = (serviceId: string) => (serviceFormLinks[serviceId] || []).length;

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight mb-1">Services</h1>
          <p className="text-muted-foreground">Manage your service menu</p>
        </div>
        {salon && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-1" />Add Service</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Price ($)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Member Price ($)</Label><Input type="number" value={form.member_price} onChange={(e) => setForm({ ...form, member_price: e.target.value })} placeholder="Optional" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Cut, Color" /></div>
                </div>
                <Button onClick={handleSave} className="w-full" disabled={!form.name || !form.price}>{editingService ? "Update" : "Add"} Service</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!salon ? (
        <div className="text-center py-16 text-muted-foreground"><p>Set up your salon first</p></div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No services added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-6 glass rounded-xl hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{s.name}</p>
                  {s.category && <span className="badge-champagne text-[10px] px-2 py-0.5 rounded-full">{s.category}</span>}
                  {getLinkedFormCount(s.id) > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <FileText className="h-3 w-3" />
                      {getLinkedFormCount(s.id)} form{getLinkedFormCount(s.id) > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-light">${s.price}</p>
                {s.member_price && <p className="text-xs text-primary">${s.member_price} member</p>}
              </div>
              <p className="text-xs text-muted-foreground">{s.duration_minutes}min</p>
              <Button variant="ghost" size="icon" onClick={() => openFormsDialog(s.id)} title="Link forms">
                <FileText className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openDialog(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Link Forms Dialog */}
      <Dialog open={formsDialogOpen} onOpenChange={setFormsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Forms to Service</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select forms that clients must complete when booking this service.
          </p>
          {salonForms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No active forms. Create forms in the Forms page first.
            </p>
          ) : (
            <div className="space-y-2 pt-2">
              {salonForms.map((f) => (
                <label
                  key={f.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedFormIds.includes(f.id)}
                    onCheckedChange={() => toggleFormSelection(f.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <Button onClick={saveFormLinks} className="w-full mt-2">
            Save Links
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesManager;
