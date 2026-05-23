import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle, Upload, Lock, ExternalLink, Copy, Check, Sparkles, X, Plus, CalendarSync, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const HAIR_TYPES = ["Straight", "Wavy", "Curly", "Coily"];
const HAIR_LENGTHS = ["Short", "Medium", "Long", "Extra Long"];
const HAIR_TEXTURES = ["Fine", "Medium", "Thick"];

const Profile = () => {
  const { user, role } = useAuth(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hair profile (clients only)
  const [hairType, setHairType] = useState("");
  const [hairLength, setHairLength] = useState("");
  const [hairTexture, setHairTexture] = useState("");

  // Stylist portfolio fields
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [calendarFeedToken, setCalendarFeedToken] = useState<string | null>(null);
  const [calendarLinkCopied, setCalendarLinkCopied] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const isStylist = role === "stylist" || role === "salon_admin";
  const portfolioUrl = user ? `${window.location.origin}/stylist/${user.id}` : "";
  const calendarFeedUrl = calendarFeedToken
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${calendarFeedToken}`
    : "";

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url);
      }
    });

    if (role === "client") {
      supabase.from("client_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setHairType(data.hair_type || "");
          setHairLength(data.hair_length || "");
          setHairTexture(data.hair_texture || "");
        }
      });
    }

    if (isStylist) {
      supabase.from("stylist_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setBio(data.bio || "");
          setSpecialties(data.specialties || []);
          setYearsExperience(data.years_experience?.toString() || "");
          setCalendarFeedToken((data as any).calendar_feed_token || null);
        }
      });
    }
  }, [user, role]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const filePath = `${user.id}/avatar.${file.name.split('.').pop()}`;
    setUploading(true);

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);
    setAvatarUrl(publicUrl);
    setUploading(false);
    toast.success("Avatar updated");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);

    if (role === "client") {
      await supabase.from("client_profiles").upsert({
        user_id: user.id,
        hair_type: hairType || null,
        hair_length: hairLength || null,
        hair_texture: hairTexture || null,
      }, { onConflict: "user_id" });
    }

    if (isStylist) {
      await supabase.from("stylist_profiles").update({
        bio: bio || null,
        specialties: specialties.length > 0 ? specialties : null,
        years_experience: yearsExperience ? parseInt(yearsExperience) : null,
      }).eq("user_id", user.id);
    }

    setSaving(false);
    if (error) toast.error("Failed to save");
    else toast.success("Profile updated");
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password changed");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleCopyPortfolioLink = async () => {
    await navigator.clipboard.writeText(portfolioUrl);
    setLinkCopied(true);
    toast.success("Portfolio link copied!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCopyCalendarLink = async () => {
    await navigator.clipboard.writeText(calendarFeedUrl);
    setCalendarLinkCopied(true);
    toast.success("Calendar feed URL copied!");
    setTimeout(() => setCalendarLinkCopied(false), 2000);
  };

  const handleRegenerateToken = async () => {
    if (!user) return;
    setRegeneratingToken(true);
    const newToken = crypto.randomUUID();
    const { error } = await supabase
      .from("stylist_profiles")
      .update({ calendar_feed_token: newToken } as any)
      .eq("user_id", user.id);
    setRegeneratingToken(false);
    if (error) {
      toast.error("Failed to regenerate token");
    } else {
      setCalendarFeedToken(newToken);
      toast.success("Calendar feed token regenerated. Update the URL in your calendar app.");
    }
  };

  const addSpecialty = () => {
    const trimmed = newSpecialty.trim();
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties([...specialties, trimmed]);
      setNewSpecialty("");
    }
  };

  const removeSpecialty = (s: string) => {
    setSpecialties(specialties.filter((x) => x !== s));
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-light tracking-tight mb-1">My Profile</h1>
      <p className="text-muted-foreground mb-6 font-normal">Manage your account details</p>

      <div className="glass-elevated rounded-xl p-7 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-full bg-accent flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-primary/30 ring-offset-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <UserCircle className="h-8 w-8 text-primary" />
            )}
          </div>
          <div>
            <p className="font-medium">{fullName || user?.email}</p>
            <p className="text-sm text-muted-foreground mb-1">{user?.email}</p>
            <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
              <Upload className="h-3 w-3" />
              {uploading ? "Uploading..." : "Change avatar"}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Basic info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
          </div>
        </div>

        {/* Hair profile (clients) */}
        {role === "client" && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-medium mb-3">Hair Profile</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Hair Type</Label>
                  <Select value={hairType} onValueChange={setHairType}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {HAIR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Length</Label>
                  <Select value={hairLength} onValueChange={setHairLength}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {HAIR_LENGTHS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texture</Label>
                  <Select value={hairTexture} onValueChange={setHairTexture}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {HAIR_TEXTURES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Stylist Portfolio */}
        {isStylist && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium">
                  <Sparkles className="h-4 w-4 inline mr-1.5 text-primary" />
                  Public Portfolio
                </h2>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/stylist/${user?.id}`} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Preview
                  </Link>
                </Button>
              </div>

              {/* Portfolio Link */}
              <div className="space-y-1.5 mb-4">
                <Label className="text-xs">Portfolio Link</Label>
                <div className="flex gap-2">
                  <Input value={portfolioUrl} readOnly className="text-xs bg-muted" />
                  <Button variant="outline" size="icon" onClick={handleCopyPortfolioLink} className="shrink-0">
                    {linkCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Share this link with clients so they can view your work and book directly.</p>
              </div>

              {/* Bio */}
              <div className="space-y-1.5 mb-4">
                <Label className="text-xs">Bio</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell clients about your style, approach, and what makes you unique..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Years experience */}
              <div className="space-y-1.5 mb-4">
                <Label className="text-xs">Years of Experience</Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-32"
                />
              </div>

              {/* Specialties */}
              <div className="space-y-1.5">
                <Label className="text-xs">Specialties</Label>
                {specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {specialties.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs pr-1">
                        {s}
                        <button onClick={() => removeSpecialty(s)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newSpecialty}
                    onChange={(e) => setNewSpecialty(e.target.value)}
                    placeholder="e.g. Balayage, Curly cuts..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSpecialty())}
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={addSpecialty} disabled={!newSpecialty.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Calendar Sync (stylists) */}
        {isStylist && calendarFeedToken && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
                <CalendarSync className="h-4 w-4 text-primary" />
                Calendar Sync
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Subscribe to this feed in Google Calendar, Apple Calendar, Outlook, or any calendar app to see your Prism appointments.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Calendar Feed URL</Label>
                  <div className="flex gap-2">
                    <Input value={calendarFeedUrl} readOnly className="text-xs bg-muted font-mono" />
                    <Button variant="outline" size="icon" onClick={handleCopyCalendarLink} className="shrink-0">
                      {calendarLinkCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-medium">How to subscribe:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong>Google Calendar:</strong> Settings → Add calendar → From URL → paste the link</li>
                    <li><strong>Apple Calendar:</strong> File → New Calendar Subscription → paste the link</li>
                    <li><strong>Outlook:</strong> Add calendar → Subscribe from web → paste the link</li>
                  </ul>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Calendar apps refresh automatically (usually every few hours). New appointments will appear on your calendar without any action.
                  </p>
                </div>

                <Button variant="ghost" size="sm" onClick={handleRegenerateToken} disabled={regeneratingToken} className="text-xs">
                  <RefreshCw className={`h-3 w-3 mr-1.5 ${regeneratingToken ? "animate-spin" : ""}`} />
                  Regenerate Feed URL
                </Button>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  Regenerating will invalidate the current URL. You'll need to re-subscribe in your calendar app.
                </p>
              </div>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={saving} className="bg-gradient-prism text-white rounded-full">{saving ? "Saving..." : "Save Changes"}</Button>

        {/* Password */}
        <Separator />
        <div>
          <h2 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4" /> Change Password
          </h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button variant="outline" onClick={handlePasswordChange} disabled={changingPassword || !newPassword}>
              {changingPassword ? "Changing..." : "Update Password"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
