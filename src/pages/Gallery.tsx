import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Scissors, Search, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StyleItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string;
  gender: string | null;
  hair_length: string | null;
  tags: string[] | null;
}

const categories = [
  "all", "bob", "pixie", "layers", "fade", "classic", "bangs", "waves",
  "braids", "natural", "curls", "undercut", "pompadour", "crop", "buzz",
  "slick", "edgy", "updo",
];

const genderFilters = ["all", "female", "male", "unisex"];

const Gallery = () => {
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeGender, setActiveGender] = useState("all");

  useEffect(() => {
    supabase
      .from("style_gallery")
      .select("id, name, description, category, image_url, gender, hair_length, tags")
      .eq("is_active", true)
      .then(({ data }) => {
        setStyles(data || []);
        setLoading(false);
      });
  }, []);

  const filtered = styles.filter((s) => {
    if (activeCategory !== "all" && s.category !== activeCategory) return false;
    if (activeGender !== "all" && s.gender !== activeGender) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visibleCategories = categories.filter(
    (c) => c === "all" || styles.some((s) => s.category === c && (activeGender === "all" || s.gender === activeGender))
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <Scissors className="h-5 w-5 text-primary" />
            <span className="font-light">Prism</span>
          </Link>
          <div className="flex-1" />
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-3xl tracking-tight">Style Gallery</h1>
        </div>
        <p className="text-muted-foreground mb-6 ml-7">Browse our curated collection of hairstyles</p>

        {/* Filters */}
        <div className="space-y-4 mb-8">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search styles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>

          {/* Gender filter */}
          <div className="flex gap-2">
            {genderFilters.map((g) => (
              <button
                key={g}
                onClick={() => setActiveGender(g)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors",
                  activeGender === g
                    ? "glass bg-gradient-prism text-white"
                    : "glass text-muted-foreground hover:text-foreground"
                )}
              >
                {g === "all" ? "All Genders" : g}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors",
                  activeCategory === c
                    ? "glass bg-gradient-prism text-white"
                    : "glass text-muted-foreground hover:text-foreground"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No styles found matching your filters.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((style, i) => (
              <motion.div
                key={style.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.4 }}
                className="group relative aspect-[3/4] glass rounded-xl overflow-hidden hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 cursor-pointer"
              >
                <img
                  src={style.image_url}
                  alt={style.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <p className="text-white text-sm font-medium leading-tight">{style.name}</p>
                  <p className="text-white/60 text-xs capitalize">{style.category}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-12">
          Want personalized recommendations?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">Sign up for a free consultation</Link>
        </p>
      </div>
    </div>
  );
};

export default Gallery;
