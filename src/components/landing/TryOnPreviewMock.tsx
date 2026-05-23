import { ArrowRight } from "lucide-react";

export function TryOnPreviewMock() {
  return (
    <div className="bg-obsidian/80 rounded-xl p-3 flex items-center gap-3 justify-center">
      <div className="w-16 h-20 rounded-lg bg-white/5 flex items-center justify-center">
        <span className="text-[9px] text-muted-foreground text-center leading-tight">
          Client
          <br />
          selfie
        </span>
      </div>
      <ArrowRight className="h-4 w-4 text-primary shrink-0" />
      <div className="w-16 h-20 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
        <span className="text-[9px] text-champagne text-center leading-tight">
          AI
          <br />
          result
        </span>
      </div>
    </div>
  );
}
