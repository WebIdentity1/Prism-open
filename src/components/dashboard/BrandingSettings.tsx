import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Trash2, Palette, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = [
  "DM Sans", "Inter", "Playfair Display", "Lora", "Montserrat", "Raleway",
  "Cormorant Garamond", "Josefin Sans", "Libre Baskerville", "Poppins",
  "Georgia", "Garamond", "Helvetica", "Arial",
];

interface BrandingSettingsProps {
  salonId: string;
  salon: any;
  onSalonUpdate: (updates: any) => void;
}

interface BrandAsset {
  id: string;
  url: string;
  label: string | null;
  type: string;
  created_at: string;
}

const BrandingSettings = ({ salonId, salon, onSalonUpdate }: BrandingSettingsProps) => {
  const [primaryColor, setPrimaryColor] = useState(salon?.brand_primary_color || "#0f766e");
  const [secondaryColor, setSecondaryColor] = useState(salon?.brand_secondary_color || "#f0fdfa");
  const [brandFont, setBrandFont] = useState(salon?.brand_font || "DM Sans");
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!salonId) return;
    supabase
      .from("brand_assets")
      .select("*")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAssets((data as BrandAsset[]) || []));
  }, [salonId]);

  const saveColors = async () => {
    setSaving(true);
    const updates = {
      brand_primary_color: primaryColor,
      brand_secondary_color: secondaryColor,
      brand_font: brandFont,
    };
    const { error } = await supabase.from("salons").update(updates as any).eq("id", salonId);
    if (error) toast.error("Failed to save branding");
    else {
      toast.success("Branding saved");
      onSalonUpdate(updates);
    }
    setSaving(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG, WebP, GIF, or SVG images are allowed`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 5 MB`);
        continue;
      }

      const ext = file.name.split(".").pop();
      const path = `${salonId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("brand-assets").upload(path, file);
      if (uploadErr) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);

      const { data: asset, error: insertErr } = await supabase
        .from("brand_assets")
        .insert({ salon_id: salonId, url: urlData.publicUrl, type: "photo", label: file.name } as any)
        .select()
        .single();

      if (!insertErr && asset) {
        setAssets((prev) => [asset as BrandAsset, ...prev]);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteAsset = async (asset: BrandAsset) => {
    // Extract storage path from URL
    const urlParts = asset.url.split("/brand-assets/");
    if (urlParts[1]) {
      await supabase.storage.from("brand-assets").remove([urlParts[1]]);
    }
    await supabase.from("brand_assets").delete().eq("id", asset.id);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    toast.success("Photo removed");
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card className="glass rounded-xl border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Palette className="h-5 w-5 text-primary" />Brand Colors & Font
          </CardTitle>
          <CardDescription>These will be used in Prism AI-generated marketing emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded-lg border border-input cursor-pointer"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-10 rounded-lg border border-input cursor-pointer"
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="flex-1 rounded-lg" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Brand Font</Label>
            <Select value={brandFont} onValueChange={setBrandFont}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>
                    <span style={{ fontFamily: f }}>{f}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview swatch */}
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Preview</p>
            <div className="flex gap-3 items-center">
              <div className="h-12 w-12 rounded-lg" style={{ backgroundColor: primaryColor }} />
              <div className="h-12 w-12 rounded-lg" style={{ backgroundColor: secondaryColor }} />
              <p className="text-sm" style={{ fontFamily: brandFont }}>
                {salon?.name || "Your Salon"} — {brandFont}
              </p>
            </div>
          </div>

          <Button onClick={saveColors} disabled={saving} className="bg-gradient-prism rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save Branding
          </Button>
        </CardContent>
      </Card>

      <Card className="glass rounded-xl border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <ImageIcon className="h-5 w-5 text-primary" />Photo Bank
          </CardTitle>
          <CardDescription>Upload salon photos for use in Prism AI-generated emails (interior, team, services, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload Photos
            </Button>
          </div>

          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No photos uploaded yet. Add salon photos so AI can include them in your marketing emails.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {assets.map((a) => (
                <div key={a.id} className="relative group rounded-lg overflow-hidden border aspect-square">
                  <img src={a.url} alt={a.label || "Salon photo"} className="w-full h-full object-cover" />
                  <button
                    onClick={() => deleteAsset(a)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandingSettings;
