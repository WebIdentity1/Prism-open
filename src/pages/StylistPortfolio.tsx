import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Scissors, Star, Calendar, MapPin, Clock, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

interface StylistData {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[] | null;
  yearsExperience: number | null;
  salonId: string | null;
  salonName: string | null;
  salonCity: string | null;
  salonState: string | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  clientName: string;
}

interface WorkPhoto {
  id: string;
  photo_url: string;
  notes: string | null;
  created_at: string;
}

const Stars = ({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) => {
  const cls = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${cls} ${i <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
};

const StylistPortfolio = () => {
  const { stylistId } = useParams<{ stylistId: string }>();
  const [stylist, setStylist] = useState<StylistData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [photos, setPhotos] = useState<WorkPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    if (!stylistId) return;

    const load = async () => {
      // Fetch profile + stylist profile in parallel
      const [profileRes, stylistProfileRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").eq("user_id", stylistId).single(),
        supabase.from("stylist_profiles").select("bio, specialties, years_experience, salon_id").eq("user_id", stylistId).single(),
      ]);

      if (!profileRes.data) {
        setLoading(false);
        return;
      }

      const profile = profileRes.data;
      const sp = stylistProfileRes.data;

      let salonName: string | null = null;
      let salonCity: string | null = null;
      let salonState: string | null = null;

      if (sp?.salon_id) {
        const { data: salon } = await supabase.from("salons").select("name, city, state").eq("id", sp.salon_id).single();
        salonName = salon?.name ?? null;
        salonCity = salon?.city ?? null;
        salonState = salon?.state ?? null;
      }

      setStylist({
        userId: profile.user_id,
        fullName: profile.full_name || "Stylist",
        avatarUrl: profile.avatar_url,
        bio: sp?.bio ?? null,
        specialties: sp?.specialties ?? null,
        yearsExperience: sp?.years_experience ?? null,
        salonId: sp?.salon_id ?? null,
        salonName,
        salonCity,
        salonState,
      });

      // Fetch reviews and photos in parallel
      const [reviewsRes, photosRes] = await Promise.all([
        supabase.from("reviews").select("id, rating, comment, created_at, client_id").eq("stylist_id", stylistId).order("created_at", { ascending: false }).limit(20),
        supabase.from("appointment_photos").select("id, photo_url, notes, created_at").eq("stylist_id", stylistId).order("created_at", { ascending: false }).limit(12),
      ]);

      // Resolve client names for reviews
      const rawReviews = reviewsRes.data || [];
      if (rawReviews.length > 0) {
        const clientIds = [...new Set(rawReviews.map((r: any) => r.client_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds);
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name || "Client"]));

        const mapped = rawReviews.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          clientName: nameMap.get(r.client_id) || "Client",
        }));
        setReviews(mapped);

        const total = mapped.reduce((s: number, r: Review) => s + r.rating, 0);
        setAvgRating(Math.round((total / mapped.length) * 10) / 10);
      }

      setPhotos((photosRes.data as WorkPhoto[]) || []);
      setLoading(false);
    };

    load();
  }, [stylistId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Skeleton className="h-32 w-32 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (!stylist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Stylist not found</h1>
          <p className="text-muted-foreground mb-6">This profile doesn't exist or has been removed.</p>
          <Button asChild variant="outline">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const bookingUrl = stylist.salonId
    ? `/join/${stylist.salonId}?stylist=${stylist.userId}`
    : "/signup";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <Scissors className="h-5 w-5 text-primary" />
            <span className="font-light">Prism</span>
          </Link>
          <Button asChild>
            <Link to={bookingUrl}>
              <Calendar className="h-4 w-4 mr-2" /> Book Appointment
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10">
        {/* Profile Hero */}
        <div className="text-center mb-10">
          <div className="w-28 h-28 rounded-full mx-auto mb-4 overflow-hidden bg-accent border-4 border-primary/20 glass-elevated">
            {stylist.avatarUrl ? (
              <img src={stylist.avatarUrl} alt={stylist.fullName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-semibold text-accent-foreground">
                {stylist.fullName.charAt(0)}
              </div>
            )}
          </div>

          <h1 className="text-3xl mb-1">
            {stylist.fullName}
          </h1>

          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground mb-3">
            {stylist.salonName && (
              <span className="flex items-center gap-1">
                <Scissors className="h-3.5 w-3.5" /> {stylist.salonName}
              </span>
            )}
            {(stylist.salonCity || stylist.salonState) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {[stylist.salonCity, stylist.salonState].filter(Boolean).join(", ")}
              </span>
            )}
            {stylist.yearsExperience != null && stylist.yearsExperience > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {stylist.yearsExperience}+ years
              </span>
            )}
          </div>

          {reviews.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Stars rating={Math.round(avgRating)} size="md" />
              <span className="text-sm font-medium">{avgRating}</span>
              <span className="text-sm text-muted-foreground">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          )}

          {stylist.specialties && stylist.specialties.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {stylist.specialties.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" /> {s}
                </Badge>
              ))}
            </div>
          )}

          {stylist.bio && (
            <p className="max-w-lg mx-auto text-muted-foreground leading-relaxed">{stylist.bio}</p>
          )}
        </div>

        <Separator className="mb-10" />

        {/* Work Gallery */}
        {photos.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Work Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <Card key={photo.id} className="glass rounded-xl overflow-hidden group hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
                  <AspectRatio ratio={3 / 4}>
                    <img
                      src={photo.photo_url}
                      alt={photo.notes || "Hairstyle"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </AspectRatio>
                  {photo.notes && (
                    <CardContent className="p-2">
                      <p className="text-xs text-muted-foreground truncate">{photo.notes}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4">Client Reviews</h2>
            <div className="space-y-3">
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Stars rating={r.rating} />
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(r.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {r.comment && <p className="text-sm text-foreground mb-1">{r.comment}</p>}
                    <p className="text-xs text-muted-foreground">— {r.clientName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="text-center py-8">
          <h2 className="text-2xl mb-2">Ready to book?</h2>
          <p className="text-muted-foreground mb-4">Schedule your appointment with {stylist.fullName}</p>
          <Button asChild size="lg" className="bg-gradient-champagne text-obsidian rounded-full">
            <Link to={bookingUrl}>
              <Calendar className="h-4 w-4 mr-2" /> Book Appointment
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default StylistPortfolio;
