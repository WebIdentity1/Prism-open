import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Pencil, Copy, ExternalLink, GripVertical, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface FormField {
  id: string;
  type: "text" | "textarea" | "select" | "checkbox" | "radio" | "number" | "date" | "email" | "phone";
  label: string;
  required: boolean;
  options?: string[]; // for select/radio/checkbox
  placeholder?: string;
}

interface SalonForm {
  id: string;
  salon_id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  is_active: boolean;
  is_public: boolean;
  created_at: string;
}

const FIELD_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Multiple Choice" },
  { value: "checkbox", label: "Checkboxes" },
];

const generateId = () => Math.random().toString(36).substring(2, 10);

const FormsManager = () => {
  const { user } = useAuth(false);
  const [salon, setSalon] = useState<any>(null);
  const [forms, setForms] = useState<SalonForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SalonForm | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form builder state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  // Submissions viewer
  const [viewingForm, setViewingForm] = useState<SalonForm | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: salonData } = await supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle();
      setSalon(salonData);
      if (salonData) {
        const { data } = await supabase.from("forms").select("*").eq("salon_id", salonData.id).order("created_at", { ascending: false });
        setForms((data || []).map((f: any) => ({ ...f, fields: f.fields as unknown as FormField[] })));
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const openBuilder = (form?: SalonForm) => {
    if (form) {
      setEditing(form);
      setTitle(form.title);
      setDescription(form.description || "");
      setFields(form.fields);
      setIsActive(form.is_active);
      setIsPublic(form.is_public);
    } else {
      setEditing(null);
      setTitle("");
      setDescription("");
      setFields([]);
      setIsActive(true);
      setIsPublic(true);
    }
    setDialogOpen(true);
  };

  const addField = () => {
    setFields([...fields, { id: generateId(), type: "text", label: "", required: false }]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    if (!salon || !title.trim() || fields.length === 0) {
      toast.error("Add a title and at least one field");
      return;
    }
    // Validate all fields have labels
    if (fields.some(f => !f.label.trim())) {
      toast.error("All fields must have a label");
      return;
    }

    const payload = {
      salon_id: salon.id,
      title: title.trim(),
      description: description.trim() || null,
      fields: fields as any,
      is_active: isActive,
      is_public: isPublic,
    };

    if (editing) {
      const { error } = await supabase.from("forms").update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update form"); return; }
      setForms(forms.map(f => f.id === editing.id ? { ...f, ...payload } as SalonForm : f));
      toast.success("Form updated");
    } else {
      const { data, error } = await supabase.from("forms").insert(payload).select().single();
      if (error) { toast.error("Failed to create form"); return; }
      setForms([{ ...data, fields: data.fields as unknown as FormField[] } as SalonForm, ...forms]);
      toast.success("Form created");
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("forms").delete().eq("id", id);
    setForms(forms.filter(f => f.id !== id));
    toast.success("Form deleted");
  };

  const copyLink = (formId: string) => {
    const url = `${window.location.origin}/form/${formId}`;
    navigator.clipboard.writeText(url);
    toast.success("Form link copied to clipboard");
  };

  const viewSubmissions = async (form: SalonForm) => {
    setViewingForm(form);
    const { data } = await supabase
      .from("form_submissions")
      .select("*")
      .eq("form_id", form.id)
      .order("submitted_at", { ascending: false });

    // Enrich with client names
    const subs = data || [];
    const clientIds = [...new Set(subs.filter(s => s.client_id).map(s => s.client_id))];
    let profileMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds);
      profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name || "Unknown"]));
    }
    setSubmissions(subs.map(s => ({ ...s, client_name: s.client_id ? profileMap.get(s.client_id) || "Unknown" : "Anonymous" })));
    setSubmissionsOpen(true);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight mb-1">Forms</h1>
          <p className="text-muted-foreground">Create intake forms, questionnaires, and waivers for your clients</p>
        </div>
        {salon && (
          <Button onClick={() => openBuilder()}>
            <Plus className="h-4 w-4 mr-1" /> New Form
          </Button>
        )}
      </div>

      {!salon ? (
        <div className="text-center py-16 text-muted-foreground"><p>Set up your salon first</p></div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-2">No forms created yet</p>
          <Button variant="outline" onClick={() => openBuilder()}>
            <Plus className="h-4 w-4 mr-1" /> Create Your First Form
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{form.title}</p>
                    <Badge className={`text-[10px] ${form.is_active ? "badge-teal" : "badge-glass"}`}>
                      {form.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.fields.length} field{form.fields.length !== 1 ? "s" : ""}
                    {form.description ? ` · ${form.description}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => viewSubmissions(form)} title="View submissions">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => copyLink(form.id)} title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openBuilder(form)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(form.id)} title="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Builder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Form" : "Create New Form"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Form Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New Client Intake Form" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description shown to clients..." rows={2} />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label className="text-sm">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                <Label className="text-sm">Publicly accessible</Label>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">Fields</Label>
                <Button variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-3 w-3 mr-1" /> Add Field
                </Button>
              </div>
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Click "Add Field" to start building.</p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <Card key={field.id} className="border-border">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="Field label"
                            className="flex-1"
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeField(field.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-3 pl-10">
                          <Select value={field.type} onValueChange={(v) => updateField(field.id, { type: v as FormField["type"] })}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map(ft => (
                                <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1.5">
                            <Switch checked={field.required} onCheckedChange={(v) => updateField(field.id, { required: v })} />
                            <span className="text-xs text-muted-foreground">Required</span>
                          </div>
                        </div>
                        {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                          <div className="pl-10 space-y-1">
                            <Label className="text-xs">Options (one per line)</Label>
                            <Textarea
                              value={(field.options || []).join("\n")}
                              onChange={(e) => updateField(field.id, { options: e.target.value.split("\n").filter(Boolean) })}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                              rows={3}
                              className="text-sm"
                            />
                          </div>
                        )}
                        {(field.type === "text" || field.type === "textarea" || field.type === "email" || field.type === "phone" || field.type === "number") && (
                          <div className="pl-10">
                            <Input
                              value={field.placeholder || ""}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              placeholder="Placeholder text (optional)"
                              className="text-sm"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full" disabled={!title.trim() || fields.length === 0}>
              {editing ? "Update Form" : "Create Form"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submissions Viewer Dialog */}
      <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submissions: {viewingForm?.title}</DialogTitle>
          </DialogHeader>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No submissions yet</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <Card key={sub.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{sub.client_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sub.submitted_at).toLocaleDateString()} {new Date(sub.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {viewingForm?.fields.map((field) => {
                        const value = (sub.responses as any)?.[field.id];
                        if (!value && value !== 0) return null;
                        return (
                          <div key={field.id} className="flex gap-2 text-sm">
                            <span className="text-muted-foreground shrink-0">{field.label}:</span>
                            <span className="font-medium">{Array.isArray(value) ? value.join(", ") : String(value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormsManager;
