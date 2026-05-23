import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { MapPin, Search, Loader2, Star, Scissors } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SalonListing {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  logo_url: string | null;
  phone: string | null;
}

const Salons = () => {
  const [salons, setSalons] = useState<SalonListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratings, setRatings] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [serviceCounts, setServiceCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("salons")
        .select("id, name, description, city, state, address, logo_url, phone")
        .eq("onboarding_status", "complete");
      const salonList = (data || []) as SalonListing[];
      setSalons(salonList);

      if (salonList.length > 0) {
        const salonIds = salonList.map(s => s.id);
        const [reviewsRes, servicesRes] = await Promise.all([
          supabase.from("reviews").select("salon_id, rating").in("salon_id", salonIds),
          supabase.from("services").select("salon_id").in("salon_id", salonIds).eq("is_active", true),
        ]);

        const rMap = new Map<string, { total: number; count: number }>();
        (reviewsRes.data || []).forEach((r: any) => {
          const existing = rMap.get(r.salon_id) || { total: 0, count: 0 };
          rMap.set(r.salon_id, { total: existing.total + r.rating, count: existing.count + 1 });
        });
        const ratingMap = new Map<string, { avg: number; count: number }>();
        rMap.forEach((v, k) => ratingMap.set(k, { avg: Math.round((v.total / v.count) * 10) / 10, count: v.count }));
        setRatings(ratingMap);

        const sMap = new Map<string, number>();
        (servicesRes.data || []).forEach((s: any) => sMap.set(s.salon_id, (sMap.get(s.salon_id) || 0) + 1));
        setServiceCounts(sMap);
      }

      setLoading(false);
    };
    load();
  }, []);

  const filtered = salons.filter(s => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.city || "").toLowerCase().includes(q) || (s.state || "").toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Find Your Salon
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Browse salons, explore services, and book your next appointment
          </p>
        </div>

        <div className="relative max-w-md mx-auto mb-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-lg"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Scissors className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No salons found</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((salon) => {
              const rating = ratings.get(salon.id);
              const svcCount = serviceCounts.get(salon.id) || 0;
              return (
                <Link key={salon.id} to={`/salon/${salon.id}`}>
                  <Card className="glass rounded-xl hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 h-full border-transparent">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {salon.logo_url ? (
                          <img src={salon.logo_url} alt={salon.name} className="h-14 w-14 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-gradient-prism flex items-center justify-center shrink-0">
                            <Scissors className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h2 className="font-semibold text-lg truncate">{salon.name}</h2>
                          {(salon.city || salon.state) && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {[salon.city, salon.state].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {salon.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{salon.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {rating && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Star className="h-3 w-3 fill-primary text-primary" /> {rating.avg} ({rating.count})
                              </Badge>
                            )}
                            {svcCount > 0 && (
                              <span className="text-xs text-muted-foreground">{svcCount} services</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <div className="text-center mt-10">
          <Button variant="outline" asChild>
            <Link to="/">← Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Salons;
