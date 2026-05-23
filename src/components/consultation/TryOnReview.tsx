import { useState } from "react";
import { X, ArrowLeftRight, RefreshCw, Loader2, Send, MessageSquare, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TryOnResult {
  styleId: string;
  styleName: string;
  styleImageUrl: string;
  tryOnUrl: string | null;
  generating: boolean;
  error: string | null;
}

interface TryOnReviewProps {
  results: TryOnResult[];
  selfieUrl: string;
  onRequestEdit: (styleId: string, instruction: string) => void;
  onRetry?: (styleId: string) => void;
  onEnhance?: (styleId: string) => void;
  editingStyleId: string | null;
  favoriteStyleId: string | null;
  onToggleFavorite: (styleId: string) => void;
}

const TryOnReview = ({ results, selfieUrl, onRequestEdit, onRetry, onEnhance, editingStyleId, favoriteStyleId, onToggleFavorite }: TryOnReviewProps) => {
  const [compareIndex, setCompareIndex] = useState(0);
  const [editInputs, setEditInputs] = useState<Record<string, string>>({});

  const completedResults = results.filter(r => r.tryOnUrl && !r.generating);
  const generatingCount = results.filter(r => r.generating).length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      {generatingCount > 0 && (
        <div className="flex items-center gap-3 p-4 glass rounded-xl border border-primary/20 shadow-lg shadow-primary/20 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <div className="space-y-0.5">
            <p className="text-sm">
              Generating {generatingCount} try-on{generatingCount > 1 ? "s" : ""}...
            </p>
            <p className="text-xs text-muted-foreground">
              This can take up to a minute for {results.length} style{results.length > 1 ? "s" : ""}. Results will appear as they're ready.
            </p>
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      {completedResults.length >= 2 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Side-by-Side Comparison</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="aspect-[3/4] glass rounded-xl overflow-hidden border-2 border-primary/20">
                <img
                  src={completedResults[compareIndex]?.tryOnUrl || ""}
                  alt="Compare left"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-medium text-center">{completedResults[compareIndex]?.styleName}</p>
            </div>
            <div className="space-y-2">
              <div className="aspect-[3/4] glass rounded-xl overflow-hidden border-2 border-primary/20">
                <img
                  src={completedResults[(compareIndex + 1) % completedResults.length]?.tryOnUrl || ""}
                  alt="Compare right"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-medium text-center">
                {completedResults[(compareIndex + 1) % completedResults.length]?.styleName}
              </p>
            </div>
          </div>
          {completedResults.length > 2 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {completedResults.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCompareIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === compareIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All results grid with edit controls */}
      <div className="space-y-4">
        <p className="text-sm font-medium">All Try-Ons</p>
        <div className="grid gap-4">
          {results.map((result) => (
            <motion.div
              key={result.styleId}
              layout
              className="glass rounded-xl overflow-hidden"
            >
              <div className="flex gap-3 p-3">
                {/* Original style reference (small) */}
                <div className="w-16 shrink-0">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border">
                    <img src={result.styleImageUrl} alt={result.styleName} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">Reference</p>
                </div>

                {/* Try-on result */}
                <div className="flex-1">
                  <div className={cn("aspect-[3/4] rounded-xl overflow-hidden border border-border bg-muted relative", result.generating && "border-primary shadow-lg shadow-primary/20")}>
                    {result.generating ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">
                          {editingStyleId === result.styleId ? "Applying changes..." : "Generating..."}
                        </p>
                      </div>
                    ) : result.tryOnUrl ? (
                      <img src={result.tryOnUrl} alt={`Try-on: ${result.styleName}`} className="w-full h-full object-cover animate-bloom" />
                    ) : result.error ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                        <p className="text-xs text-destructive text-center">{result.error}</p>
                        {onRetry && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => onRetry(result.styleId)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Style name and edit controls */}
              <div className="px-3 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{result.styleName}</p>
                  {result.tryOnUrl && !result.generating && (
                    <button
                      onClick={() => onToggleFavorite(result.styleId)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all",
                        favoriteStyleId === result.styleId
                          ? "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400"
                          : "text-muted-foreground hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/50"
                      )}
                    >
                      <Heart
                        className={cn(
                          "h-3.5 w-3.5 transition-all",
                          favoriteStyleId === result.styleId && "fill-current"
                        )}
                      />
                      {favoriteStyleId === result.styleId ? "Favorite" : "Set as favorite"}
                    </button>
                  )}
                </div>

                {result.tryOnUrl && !result.generating && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {["Make it shorter", "Add more volume", "Add highlights", "Make it curlier", "Make it straighter", "Add bangs"].map((suggestion) => (
                        <button
                          key={suggestion}
                          disabled={editingStyleId !== null}
                          onClick={() => onRequestEdit(result.styleId, suggestion)}
                          className="badge-glass px-2.5 py-1 text-[11px] rounded-full hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Or type a custom edit..."
                        value={editInputs[result.styleId] || ""}
                        onChange={(e) => setEditInputs(prev => ({ ...prev, [result.styleId]: e.target.value }))}
                        className="text-xs h-8 rounded-lg"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 h-8 rounded-full"
                        disabled={!editInputs[result.styleId]?.trim() || editingStyleId !== null}
                        onClick={() => {
                          const instruction = editInputs[result.styleId]?.trim();
                          if (instruction) {
                            onRequestEdit(result.styleId, instruction);
                            setEditInputs(prev => ({ ...prev, [result.styleId]: "" }));
                          }
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                    {(onRetry || onEnhance) && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <p className="text-[11px] text-muted-foreground flex-1">
                          Doesn't match the reference? Regenerate or enhance with Pro.
                        </p>
                        {onRetry && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 h-7 text-xs text-muted-foreground hover:text-foreground"
                            disabled={editingStyleId !== null}
                            onClick={() => onRetry(result.styleId)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Regenerate
                          </Button>
                        )}
                        {onEnhance && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 h-7 text-xs text-primary hover:text-primary"
                            disabled={editingStyleId !== null}
                            onClick={() => onEnhance(result.styleId)}
                            title="Re-run on Nano Banana Pro — slower, higher-fidelity strands and identity"
                            aria-label="Enhance with Pro model — slower, higher-fidelity result"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Enhance (Pro)
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TryOnReview;
