import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Phone, Globe, Clock, Star, Scissors, Loader2, Calendar, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SalonData {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  hours: any;
}

interface ServiceData {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  category: string | null;
  description: string | null;
}

interface StylistData {
  user_id: string;
  full_name: string | null;
  specialties: string[] | null;
  bio: string | null;
  years_experience: number | null;
  avatar_url: string | null;
}

interface ReviewData {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name: string | null;
  stylist_name: string | null;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const SalonDetail = () => {
  const { salonId } = useParams<{ salonId: string }>();
  const [salon, setSalon] = useState<SalonData | null>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [stylists, setStylists] = useState<StylistData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!salonId) return;
    const load = async () => {
      const [salonRes, servicesRes, stylistsRes, reviewsRes] = await Promise.all([
        supabase.from("salons").select("id, name, description, address, city, state, zip, phone, email, website, logo_url, hours").eq("id", salonId).single(),
        supabase.from("services").select("id, name, price, duration_minutes, category, description").eq("salon_id", salonId).eq("is_active", true).order("category"),
        supabase.from("stylist_profiles").select("user_id, specialties, bio, years_experience").eq("salon_id", salonId),
        supabase.from("reviews").select("id, rating, comment, created_at, client_id, stylist_id").eq("salon_id", salonId).order("created_at", { ascending: false }).limit(20),
      ]);

      setSalon(salonRes.data as SalonData | null);
      setServices((servicesRes.data || []) as ServiceData[]);

      // Fetch stylist profile names
      const stylistData = (stylistsRes.data || []) as any[];
      if (stylistData.length > 0) {
        const userIds = stylistData.map(s => s.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setStylists(stylistData.map(s => ({
          ...s,
          full_name: profileMap.get(s.user_id)?.full_name || "Stylist",
          avatar_url: profileMap.get(s.user_id)?.avatar_url || null,
        })));
      }

      // Process reviews with names
      const revData = (reviewsRes.data || []) as any[];
      if (revData.length > 0) {
        const clientIds = [...new Set(revData.map(r => r.client_id))];
        const stylistIds = [...new Set(revData.map(r => r.stylist_id))];
        const [clientProfiles, stylistProfiles] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds),
          supabase.from("profiles").select("user_id, full_name").in("user_id", stylistIds),
        ]);
        const cMap = new Map((clientProfiles.data || []).map((p: any) => [p.user_id, p.full_name]));
        const sMap = new Map((stylistProfiles.data || []).map((p: any) => [p.user_id, p.full_name]));

        setReviews(revData.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          client_name: cMap.get(r.client_id) || "Client",
          stylist_name: sMap.get(r.stylist_id) || "Stylist",
        })));

        const total = revData.reduce((s: number, r: any) => s + r.rating, 0);
        setAvgRating(Math.round((total / revData.length) * 10) / 10);
      }

      setLoading(false);
    };
    load();
  }, [salonId]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!salon) return <div className="text-center py-24 text-muted-foreground"><p>Salon not found</p><Button variant="outline" asChild className="mt-4"><Link to="/salons">← Back to Salons</Link></Button></div>;

  const hours = salon.hours as Record<string, { open: string; close: string; closed: boolean }> | null;
  const categories = [...new Set(services.map(s => s.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="glass-elevated rounded-xl p-6 flex items-start gap-6 mb-8">
          {salon.logo_url ? (
            <img src={salon.logo_url} alt={salon.name} className="h-20 w-20 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-gradient-prism flex items-center justify-center shrink-0">
              <Scissors className="h-8 w-8 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{salon.name}</h1>
            {(salon.city || salon.state) && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-4 w-4" /> {[salon.address, salon.city, salon.state, salon.zip].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2">
              {avgRating && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" /> {avgRating} ({reviews.length} reviews)
                </Badge>
              )}
              {salon.phone && (
                <a href={`tel:${salon.phone}`} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
                  <Phone className="h-3.5 w-3.5" /> {salon.phone}
                </a>
              )}
              {salon.website && (
                <a href={salon.website} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
            </div>
            {salon.description && <p className="text-sm text-muted-foreground mt-3">{salon.description}</p>}
          </div>
          <Button asChild size="lg" className="bg-gradient-champagne text-obsidian rounded-full">
            <Link to={`/dashboard/book?salon_id=${salon.id}`}>
              <Calendar className="h-4 w-4 mr-2" /> Book Now
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="services">
          <TabsList>
            <TabsTrigger value="services">Services ({services.length})</TabsTrigger>
            <TabsTrigger value="team">Team ({stylists.length})</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="mt-6">
            {services.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No services listed yet</p>
            ) : (
              <div className="space-y-6">
                {categories.length > 0 ? categories.map(cat => (
                  <div key={cat}>
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">{cat}</h3>
                    <div className="space-y-2">
                      {services.filter(s => s.category === cat).map(svc => (
                        <div key={svc.id} className="flex items-center justify-between p-3 glass rounded-xl">
                          <div>
                            <p className="font-medium text-sm">{svc.name}</p>
                            <p className="text-xs text-muted-foreground">{svc.duration_minutes} min{svc.description ? ` · ${svc.description}` : ""}</p>
                          </div>
                          <span className="font-semibold text-sm">${svc.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="space-y-2">
                    {services.map(svc => (
                      <div key={svc.id} className="flex items-center justify-between p-3 glass rounded-xl">
                        <div>
                          <p className="font-medium text-sm">{svc.name}</p>
                          <p className="text-xs text-muted-foreground">{svc.duration_minutes} min</p>
                        </div>
                        <span className="font-semibold text-sm">${svc.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            {stylists.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No team members listed yet</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {stylists.map(st => (
                  <Card key={st.user_id}>
                    <CardContent className="p-4 flex items-start gap-4">
                      {st.avatar_url ? (
                        <img src={st.avatar_url} alt={st.full_name || ""} className="h-12 w-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{st.full_name}</p>
                        {st.years_experience != null && st.years_experience > 0 && (
                          <p className="text-xs text-muted-foreground">{st.years_experience} years experience</p>
                        )}
                        {st.bio && <p className="text-sm text-muted-foreground mt-1">{st.bio}</p>}
                        {st.specialties && st.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {st.specialties.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="mt-6">
            {reviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} className={`h-4 w-4 ${i <= r.rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {r.client_name} · with {r.stylist_name} · {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="hours" className="mt-6">
            {!hours ? (
              <p className="text-center text-muted-foreground py-8">Hours not set</p>
            ) : (
              <Card>
                <CardContent className="p-4 space-y-2">
                  {DAY_NAMES.map(day => {
                    const dayData = hours[day];
                    if (!dayData) return (
                      <div key={day} className="flex justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm font-medium">{day}</span>
                        <span className="text-sm text-muted-foreground">—</span>
                      </div>
                    );
                    return (
                      <div key={day} className="flex justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm font-medium">{day}</span>
                        <span className="text-sm text-muted-foreground">
                          {dayData.closed ? "Closed" : `${dayData.open} – ${dayData.close}`}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-10">
          <Button variant="outline" asChild>
            <Link to="/salons">← Back to Salons</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalonDetail;
