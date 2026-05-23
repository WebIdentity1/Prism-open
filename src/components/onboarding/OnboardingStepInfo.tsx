import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface Props {
  salon: any;
  user: User;
  onNext: () => void;
  onSalonCreated: (salon: any) => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return {
    value: `${hour.toString().padStart(2, "0")}:${minute}`,
    label: `${displayHour}:${minute} ${period}`,
  };
});

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DEFAULT_HOURS: WeekHours = {
  Sunday: { open: "10:00", close: "17:00", closed: true },
  Monday: { open: "09:00", close: "19:00", closed: false },
  Tuesday: { open: "09:00", close: "19:00", closed: false },
  Wednesday: { open: "09:00", close: "19:00", closed: false },
  Thursday: { open: "09:00", close: "19:00", closed: false },
  Friday: { open: "09:00", close: "19:00", closed: false },
  Saturday: { open: "09:00", close: "17:00", closed: false },
};

const OnboardingStepInfo = ({ salon, user, onNext, onSalonCreated }: Props) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: salon?.name || "",
    description: salon?.description || "",
    email: salon?.email || user.email || "",
    phone: salon?.phone || "",
    address: salon?.address || "",
    city: salon?.city || "",
    state: salon?.state || "",
    zip: salon?.zip || "",
    website: salon?.website || "",
  });
  const [hours, setHours] = useState<WeekHours>(() => {
    if (salon?.hours && typeof salon.hours === "object") {
      return { ...DEFAULT_HOURS, ...salon.hours };
    }
    return DEFAULT_HOURS;
  });

  const updateDayHours = (day: string, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Salon name is required"); return; }
    setSaving(true);
    const payload = { ...form, hours, onboarding_status: "services" };
    if (salon) {
      const { error } = await supabase.from("salons").update(payload).eq("id", salon.id);
      if (error) { toast.error("Failed to save"); setSaving(false); return; }
    } else {
      const { error, data } = await supabase
        .from("salons")
        .insert({ ...payload, owner_id: user.id })
        .select()
        .single();
      if (error) { toast.error("Failed to create salon"); setSaving(false); return; }
      onSalonCreated(data);
    }
    setSaving(false);
    onNext();
  };

  return (
    <div className="glass-elevated rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-medium">Salon Information</h2>
        <p className="text-sm text-muted-foreground mt-1">Tell us about your salon so clients can find you.</p>
      </div>
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Salon Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. The Style Studio" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="A brief description of your salon..." />
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

        {/* Business Hours */}
        <div className="space-y-3 pt-2">
          <Label className="text-base font-medium">Business Hours</Label>
          <div className="border rounded-lg divide-y">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center gap-3 px-4 py-3">
                <div className="w-24 font-medium text-sm">{day}</div>
                <Switch
                  checked={!hours[day].closed}
                  onCheckedChange={(open) => updateDayHours(day, "closed", !open)}
                />
                {hours[day].closed ? (
                  <span className="text-muted-foreground text-sm">Closed</span>
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <Select value={hours[day].open} onValueChange={(v) => updateDayHours(day, "open", v)}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">to</span>
                    <Select value={hours[day].close} onValueChange={(v) => updateDayHours(day, "close", v)}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="bg-gradient-prism text-white rounded-full">
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStepInfo;
