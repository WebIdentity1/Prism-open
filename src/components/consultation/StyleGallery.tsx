import { useState } from "react";
import { Heart, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StyleItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string;
  gender: string | null;
  compatible_face_shapes: string[];
  compatible_hair_types: string[];
  compatible_hair_thicknesses: string[];
  hair_length: string | null;
  tags: string[] | null;
}

interface StyleGalleryProps {
  styles: StyleItem[];
  faceShape: string | null;
  userHairLength: string | null;
  userHairType: string | null;
  userHairThickness: string | null;
  selectedStyleIds: Set<string>;
  onToggleSelect: (styleId: string) => void;
  maxSelections: number;
  loading?: boolean;
}

// Which style lengths are achievable given the user's current hair length
const achievableLengths: Record<string, string[]> = {
  short: ["short"],
  medium: ["short", "medium"],
  long: ["short", "medium", "long"],
};

// Thickness adjacency: fine <-> medium <-> thick
// 1 step = adjacent (partial credit), 2 steps = hard filter
const thicknessAdjacency: Record<string, string[]> = {
  fine: ["medium"],
  medium: ["fine", "thick"],
  thick: ["medium"],
};

const allCategories = [
  "all", "bob", "pixie", "layers", "fade", "classic", "bangs", "waves",
  "braids", "natural", "curls", "undercut", "pompadour", "crop", "buzz",
  "slick", "edgy", "updo",
];

const StyleGallery = ({ styles, faceShape, userHairLength, userHairType, userHairThickness, selectedStyleIds, onToggleSelect, maxSelections, loading }: StyleGalleryProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [showRecommended, setShowRecommended] = useState(true);

  const allowedLengths = userHairLength ? achievableLengths[userHairLength] || ["short", "medium", "long"] : null;

  // Hair type compatibility check — if the style has compatible_hair_types and user's hair type is known,
  // filter out styles that don't list the user's hair type
  const isHairTypeCompatible = (style: StyleItem): boolean => {
    if (!userHairType) return true; // no detection yet — show all
    if (!style.compatible_hair_types || style.compatible_hair_types.length === 0) return true; // no restrictions
    return style.compatible_hair_types.includes(userHairType);
  };

  // Thickness compatibility — hard-filter only extreme mismatches (2 steps apart)
  const isThicknessCompatible = (style: StyleItem): boolean => {
    if (!userHairThickness) return true; // no detection yet — show all
    if (!style.compatible_hair_thicknesses || style.compatible_hair_thicknesses.length === 0) return true; // no restrictions
    // Pass if style lists user's exact thickness
    if (style.compatible_hair_thicknesses.includes(userHairThickness)) return true;
    // Pass if style lists an adjacent thickness
    const adjacent = thicknessAdjacency[userHairThickness] || [];
    return style.compatible_hair_thicknesses.some((t) => adjacent.includes(t));
  };

  // Pre-compute which styles pass length + recommended + hair type + thickness filters (ignoring category)
  const baseFiltered = styles.filter((s) => {
    if (allowedLengths && s.hair_length && !allowedLengths.includes(s.hair_length)) return false;
    if (!isHairTypeCompatible(s)) return false;
    if (!isThicknessCompatible(s)) return false;
    if (showRecommended && faceShape && !s.compatible_face_shapes.includes(faceShape)) return false;
    return true;
  });

  const availableCats = new Set(baseFiltered.map((s) => s.category));
  const categories = allCategories.filter((cat) => cat === "all" || availableCats.has(cat));

  const filtered = styles.filter((s) => {
    if (activeCategory !== "all" && s.category !== activeCategory) return false;
    if (allowedLengths && s.hair_length && !allowedLengths.includes(s.hair_length)) return false;
    if (!isHairTypeCompatible(s)) return false;
    if (!isThicknessCompatible(s)) return false;
    if (showRecommended && faceShape && !s.compatible_face_shapes.includes(faceShape)) return false;
    return true;
  });

  // Multi-factor relevance score — physical compatibility weighted highest
  const getRelevanceScore = (style: StyleItem): number => {
    let score = 0;

    // Hair type match (strongest physical signal — worth 4 points)
    if (userHairType && style.compatible_hair_types?.length > 0) {
      if (style.compatible_hair_types.includes(userHairType)) {
        score += 4;
      }
    }

    // Hair thickness match (physical signal — worth 4 points exact, 2 adjacent)
    if (userHairThickness && style.compatible_hair_thicknesses?.length > 0) {
      if (style.compatible_hair_thicknesses.includes(userHairThickness)) {
        score += 4;
      } else {
        const adjacent = thicknessAdjacency[userHairThickness] || [];
        if (style.compatible_hair_thicknesses.some((t) => adjacent.includes(t))) {
          score += 2;
        }
      }
    }

    // Face shape match (aesthetic signal — worth 2 points)
    if (faceShape && style.compatible_face_shapes.includes(faceShape)) {
      score += 2;
    }

    // Hair length match — exact match bonus (convenience — worth 1 point)
    if (userHairLength && style.hair_length) {
      if (style.hair_length === userHairLength) {
        score += 1;
      }
    }

    return score;
  };

  const sorted = [...filtered].sort((a, b) => {
    if (!showRecommended) return 0;
    return getRelevanceScore(b) - getRelevanceScore(a);
  });

  const atMax = selectedStyleIds.size >= maxSelections;

  return (
    <div className="space-y-4">
      {/* Selection counter */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          <span className="text-primary">{selectedStyleIds.size}</span>
          <span className="text-muted-foreground">/{maxSelections} selected</span>
        </p>
        <div className="flex gap-1">
          {Array.from({ length: maxSelections }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                i < selectedStyleIds.size ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {faceShape && (
          <Button
            variant={showRecommended ? "default" : "outline"}
            size="sm"
            className={cn("shrink-0 gap-1.5 rounded-full", showRecommended && "bg-gradient-prism text-white")}
            onClick={() => setShowRecommended(!showRecommended)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            For You
          </Button>
        )}
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "secondary" : "ghost"}
            size="sm"
            className={cn("shrink-0 capitalize text-xs rounded-full", activeCategory === cat && "glass")}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((style, i) => {
            const isRecommended = faceShape && style.compatible_face_shapes.includes(faceShape);
            const isSelected = selectedStyleIds.has(style.id);
            const isDisabled = atMax && !isSelected;

            return (
              <motion.div
                key={style.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "group relative glass rounded-xl overflow-hidden border-2 transition-all duration-300 cursor-pointer hover:bg-[var(--glass-bg-elevated)]",
                  isSelected
                    ? "glass-elevated border-primary/30 shadow-lg shadow-primary/10"
                    : "border-transparent hover:shadow-lg hover:shadow-primary/5",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => !isDisabled && onToggleSelect(style.id)}
              >
                <div className="aspect-[3/4] relative">
                  <img
                    src={style.image_url}
                    alt={style.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {/* Selected check */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gradient-prism text-white flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Recommended badge */}
                  {isRecommended && showRecommended && !isSelected && (
                    <div className="ai-badge absolute top-2 left-2 flex items-center gap-1 px-2 py-1 text-[10px] font-medium">
                      <span className="ai-pulse" />
                      <Sparkles className="h-3 w-3" />
                      Great for you
                    </div>
                  )}

                  {/* Selection number */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">
                      {Array.from(selectedStyleIds).indexOf(style.id) + 1}
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-white text-sm font-medium">{style.name}</p>
                    <p className="text-white/70 text-xs capitalize">{style.category}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No styles found for this category.</p>
        </div>
      )}
    </div>
  );
};

export default StyleGallery;
