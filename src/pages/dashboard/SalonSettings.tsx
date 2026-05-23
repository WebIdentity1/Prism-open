import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Copy, Check, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SalonSettings = () => {
  const { user } = useAuth(false);
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", email: "", phone: "", address: "", city: "", state: "", zip: "", website: "" });

  const clientLink = salon ? `${window.location.origin}/join/${salon.id}` : "";

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(clientLink);
    setCopied(true);
    toast.success("Client link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("salons").select("*").eq("owner_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setSalon(data);
        setForm({
          name: data.name || "", description: data.description || "", email: data.email || "",
          phone: data.phone || "", address: data.address || "", city: data.city || "",
          state: data.state || "", zip: data.zip || "", website: data.website || "",
        });
      }
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    if (salon) {
      const { error } = await supabase.from("salons").update(form).eq("id", salon.id);
      if (error) toast.error("Failed to save");
      else toast.success("Salon updated");
    } else {
      const { error, data } = await supabase.from("salons").insert({ ...form, owner_id: user.id }).select().single();
      if (error) toast.error("Failed to create salon");
      else { setSalon(data); toast.success("Salon created"); }
    }
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-light tracking-tight mb-1">Salon Settings</h1>
      <p className="text-muted-foreground mb-6">{salon ? "Update your salon details" : "Set up your salon"}</p>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Salon Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div className="space-y-2"><Label>ZIP</Label><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
        </div>
        <Button onClick={handleSave} disabled={saving || !form.name} className="bg-gradient-teal text-white rounded-full">{saving ? "Saving..." : salon ? "Update Salon" : "Create Salon"}</Button>

        {salon && (
          <div className="mt-6 p-6 glass rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Client Invite Link</p>
            </div>
            <p className="text-xs text-muted-foreground">Share this link on your website or social media so new clients can sign up, get a consultation, and book their first appointment.</p>
            <div className="flex items-center gap-2">
              <Input value={clientLink} readOnly className="text-xs bg-background" />
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalonSettings;
