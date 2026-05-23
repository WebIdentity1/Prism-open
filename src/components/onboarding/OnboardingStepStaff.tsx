import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  salonId: string;
  onNext: () => void;
  onBack: () => void;
}

interface InviteRow { email: string; name: string; }

const OnboardingStepStaff = ({ salonId, onNext, onBack }: Props) => {
  const [existingStaff, setExistingStaff] = useState<any[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([{ email: "", name: "" }]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase
      .from("stylist_profiles")
      .select("user_id, profiles:user_id(full_name)")
      .eq("salon_id", salonId)
      .then(({ data }) => setExistingStaff(data || []));
  }, [salonId]);

  const addRow = () => setInvites([...invites, { email: "", name: "" }]);
  const removeRow = (i: number) => setInvites(invites.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof InviteRow, value: string) => {
    const updated = [...invites];
    updated[i] = { ...updated[i], [field]: value };
    setInvites(updated);
  };

  const handleInvite = async () => {
    const valid = invites.filter((inv) => inv.email.trim());
    if (valid.length === 0) { onNext(); return; }
    setSending(true);
    for (const inv of valid) {
      await supabase.functions.invoke("invite-stylist", {
        body: { email: inv.email.trim(), name: inv.name.trim(), salon_id: salonId },
      });
    }
    toast.success(`${valid.length} invitation(s) sent`);
    setSending(false);
    onNext();
  };

  return (
    <div className="glass-elevated rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-medium">Invite Your Team</h2>
        <p className="text-sm text-muted-foreground mt-1">Send invitations to your stylists. They'll receive an email to join your salon. You can always add more later.</p>
      </div>
      <div className="space-y-6">
        {existingStaff.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{existingStaff.length} stylist(s) already on your team</p>
            {existingStaff.map((s: any) => (
              <div key={s.user_id} className="p-3 glass rounded-xl text-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-prism flex items-center justify-center text-white text-xs font-medium shrink-0">
                  {((s.profiles as any)?.full_name || "U").charAt(0)}
                </div>
                {(s.profiles as any)?.full_name || "Unnamed stylist"}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {invites.map((inv, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={inv.name} onChange={(e) => updateRow(i, "name", e.target.value)} placeholder="Jane Doe" /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={inv.email} onChange={(e) => updateRow(i, "email", e.target.value)} placeholder="jane@example.com" /></div>
              <Button variant="ghost" size="icon" onClick={() => removeRow(i)} disabled={invites.length === 1}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Add Stylist</Button>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-full">Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onNext} className="rounded-full">Skip</Button>
            <Button onClick={handleInvite} disabled={sending} className="bg-gradient-prism text-white rounded-full">
              <Mail className="h-4 w-4 mr-1" />
              {sending ? "Sending..." : "Send Invites & Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStepStaff;
