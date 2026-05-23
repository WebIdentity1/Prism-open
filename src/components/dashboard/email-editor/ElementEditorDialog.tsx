import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Type, ImageIcon, Link as LinkIcon } from "lucide-react";
import type { ElementSelection } from "./types";
import { EmailImageUploader } from "./EmailImageUploader";

interface ElementEditorDialogProps {
  selection: ElementSelection;
  salonId: string;
  onApplyText: (elementPath: string, newText: string, styles?: Record<string, string>) => void;
  onApplyImage: (elementPath: string, newSrc: string, newAlt?: string) => void;
  onApplyLink: (elementPath: string, newHref: string, newText?: string, styles?: Record<string, string>) => void;
  onClose: () => void;
}

export function ElementEditorDialog({
  selection,
  salonId,
  onApplyText,
  onApplyImage,
  onApplyLink,
  onClose,
}: ElementEditorDialogProps) {
  const [text, setText] = useState(selection.currentValue);
  const [color, setColor] = useState(selection.styles.color || "#000000");
  const [bgColor, setBgColor] = useState(selection.styles.backgroundColor || "");
  const [imageSrc, setImageSrc] = useState(selection.currentValue);
  const [altText, setAltText] = useState("");
  const [href, setHref] = useState(selection.currentHref || "");

  // Reset values when selection changes
  useEffect(() => {
    setText(selection.currentValue);
    setColor(selection.styles.color || "#000000");
    setBgColor(selection.styles.backgroundColor || "");
    setImageSrc(selection.currentValue);
    setAltText("");
    setHref(selection.currentHref || "");
  }, [selection]);

  // Normalize rgb() to hex for color inputs
  const toHex = (val: string): string => {
    if (!val || val === "transparent" || val === "rgba(0, 0, 0, 0)") return "";
    if (val.startsWith("#")) return val;
    const match = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return val;
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(+match[1])}${hex(+match[2])}${hex(+match[3])}`;
  };

  const colorHex = toHex(color);
  const bgColorHex = toHex(bgColor);

  const handleApply = () => {
    if (selection.elementType === "text") {
      const styles: Record<string, string> = {};
      if (color !== selection.styles.color) styles.color = color;
      if (bgColor && bgColor !== selection.styles.backgroundColor) styles["background-color"] = bgColor;
      onApplyText(
        selection.elementPath,
        text,
        Object.keys(styles).length > 0 ? styles : undefined
      );
    } else if (selection.elementType === "image") {
      onApplyImage(selection.elementPath, imageSrc, altText || undefined);
    } else if (selection.elementType === "link") {
      const styles: Record<string, string> = {};
      if (color !== selection.styles.color) styles.color = color;
      if (bgColor && bgColor !== selection.styles.backgroundColor) styles["background-color"] = bgColor;
      onApplyLink(
        selection.elementPath,
        href,
        text !== selection.currentValue ? text : undefined,
        Object.keys(styles).length > 0 ? styles : undefined
      );
    }
    onClose();
  };

  const typeIcon = {
    text: <Type className="h-4 w-4" />,
    image: <ImageIcon className="h-4 w-4" />,
    link: <LinkIcon className="h-4 w-4" />,
  };

  const typeLabel = {
    text: "Edit Text",
    image: "Edit Image",
    link: "Edit Link",
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md glass-elevated rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {typeIcon[selection.elementType]}
            {typeLabel[selection.elementType]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* TEXT EDITOR */}
          {selection.elementType === "text" && (
            <>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorHex || "#000000"}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-9 w-9 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={colorHex || ""}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Background</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColorHex || "#ffffff"}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-9 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={bgColorHex || ""}
                      onChange={(e) => setBgColor(e.target.value)}
                      placeholder="transparent"
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* IMAGE EDITOR */}
          {selection.elementType === "image" && (
            <>
              {imageSrc && (
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <img
                    src={imageSrc}
                    alt="Current"
                    className="w-full max-h-40 object-contain"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Replace Image</Label>
                <div className="flex items-center gap-2">
                  <EmailImageUploader
                    salonId={salonId}
                    onUpload={(url) => setImageSrc(url)}
                  />
                  <span className="text-xs text-muted-foreground">or paste URL below</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={imageSrc}
                  onChange={(e) => setImageSrc(e.target.value)}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Alt Text</Label>
                <Input
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image..."
                  className="text-sm"
                />
              </div>
            </>
          )}

          {/* LINK / BUTTON EDITOR */}
          {selection.elementType === "link" && (
            <>
              <div className="space-y-2">
                <Label>Link Text</Label>
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder="https://..."
                  className="text-sm"
                />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorHex || "#000000"}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-9 w-9 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={colorHex || ""}
                      onChange={(e) => setColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Background</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColorHex || "#ffffff"}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-9 w-9 rounded border border-input cursor-pointer"
                    />
                    <Input
                      value={bgColorHex || ""}
                      onChange={(e) => setBgColor(e.target.value)}
                      placeholder="transparent"
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
