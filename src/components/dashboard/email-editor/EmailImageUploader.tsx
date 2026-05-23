import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface EmailImageUploaderProps {
  salonId: string;
  onUpload: (url: string) => void;
}

export function EmailImageUploader({ salonId, onUpload }: EmailImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `${salonId}/email-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, file);

      if (uploadErr) {
        toast.error("Failed to upload image");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("brand-assets")
        .getPublicUrl(path);

      onUpload(urlData.publicUrl);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="glass rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Upload className="h-4 w-4 mr-1" />
        )}
        {uploading ? "Uploading..." : "Upload Image"}
      </Button>
    </>
  );
}
