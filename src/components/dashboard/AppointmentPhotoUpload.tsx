import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  appointmentId: string;
  clientId: string;
  stylistId: string;
  salonId: string;
  onUploaded?: () => void;
}

export const AppointmentPhotoUpload = ({ appointmentId, clientId, stylistId, salonId, onUploaded }: Props) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Invalid file", { description: "Please select an image." });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${salonId}/${clientId}/${appointmentId}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("appointment-photos")
      .upload(path, file, { contentType: file.type });

    if (uploadErr) {
      toast.error("Upload failed", { description: uploadErr.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("appointment-photos").getPublicUrl(path);

    const { error: insertErr } = await supabase.from("appointment_photos").insert({
      appointment_id: appointmentId,
      client_id: clientId,
      stylist_id: stylistId,
      salon_id: salonId,
      photo_url: urlData.publicUrl,
      notes: notes || null,
    });

    setUploading(false);
    if (insertErr) {
      toast.error("Error saving photo", { description: insertErr.message });
    } else {
      toast.success("Photo saved!", { description: "Added to client's profile." });
      setOpen(false);
      setFile(null);
      setPreview(null);
      setNotes("");
      onUploaded?.();
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setNotes("");
  };

  return (
    <>
      <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(true)}>
        <Camera className="h-3 w-3 mr-1" /> Photo
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Haircut Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {preview ? (
              <div className="relative">
                <img src={preview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border border-border" />
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 bg-background/80" onClick={reset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center cursor-pointer glass hover:border-primary/40 transition-all duration-300"
                onClick={() => inputRef.current?.click()}
              >
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Tap to take or select a photo</p>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />

            <div>
              <p className="text-sm font-medium mb-1.5">Notes (optional)</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Products used, technique notes, color formula..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || uploading} className="rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                Save Photo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
