import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, Loader2, RefreshCw, MessageSquare, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client_name: string;
  stylist_name: string;
}

interface GoogleReview {
  id: string;
  google_review_id: string;
  reviewer_name: string;
  reviewer_photo_url: string | null;
  rating: number;
  comment: string | null;
  reply: string | null;
  review_time: string;
}

interface StylistAvg {
  stylist_id: string;
  name: string;
  avg: number;
  count: number;
}

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "fill-champagne text-champagne" : "text-muted-foreground/30"}`} />
    ))}
  </div>
);

const Reviews = () => {
  const { user } = useAuth(false);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stylistAvgs, setStylistAvgs] = useState<StylistAvg[]>([]);
  const [googleReviews, setGoogleReviews] = useState<GoogleReview[]>([]);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [hasGbp, setHasGbp] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: salon } = await supabase.from("salons").select("id, google_bp_tokens").eq("owner_id", user.id).single();
      if (!salon) { setLoading(false); return; }
      setSalonId(salon.id);
      setHasGbp(!!(salon as any).google_bp_tokens);

      // Fetch in-app reviews
      const { data: rawReviews } = await supabase
        .from("reviews")
        .select("*")
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const allReviews = (rawReviews as any[]) || [];

      if (allReviews.length > 0) {
        const userIds = [...new Set([...allReviews.map(r => r.client_id), ...allReviews.map(r => r.stylist_id)])];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name || "Unknown"]));

        setReviews(allReviews.map(r => ({
          ...r,
          client_name: nameMap.get(r.client_id) || "Client",
          stylist_name: nameMap.get(r.stylist_id) || "Stylist",
        })));

        const byStylet = new Map<string, { total: number; count: number }>();
        allReviews.forEach(r => {
          const cur = byStylet.get(r.stylist_id) || { total: 0, count: 0 };
          cur.total += r.rating;
          cur.count += 1;
          byStylet.set(r.stylist_id, cur);
        });
        setStylistAvgs(
          Array.from(byStylet.entries()).map(([id, v]) => ({
            stylist_id: id,
            name: nameMap.get(id) || "Stylist",
            avg: Math.round((v.total / v.count) * 10) / 10,
            count: v.count,
          })).sort((a, b) => b.avg - a.avg)
        );
      }

      // Fetch Google reviews
      const { data: gReviews } = await supabase
        .from("google_reviews" as any)
        .select("*")
        .eq("salon_id", salon.id)
        .order("review_time", { ascending: false })
        .limit(100);
      setGoogleReviews((gReviews as any[]) || []);

      setLoading(false);
    };
    load();
  }, [user]);

  const handleSyncGoogle = async () => {
    if (!salonId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-bp-sync", {
        body: { salon_id: salonId, actions: ["reviews"] },
      });
      if (error) throw error;
      // Refetch google reviews
      const { data: gReviews } = await supabase
        .from("google_reviews" as any)
        .select("*")
        .eq("salon_id", salonId)
        .order("review_time", { ascending: false })
        .limit(100);
      setGoogleReviews((gReviews as any[]) || []);
      toast.success(`Synced ${data?.results?.reviews?.synced || 0} reviews from Google`);
    } catch (e: any) {
      toast.error(e.message || "Failed to sync Google reviews");
    } finally {
      setSyncing(false);
    }
  };

  const handleReply = async (googleReviewId: string) => {
    if (!salonId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const { error } = await supabase.functions.invoke("google-bp-sync", {
        body: {
          salon_id: salonId,
          actions: ["reply"],
          review_google_id: googleReviewId,
          reply_text: replyText.trim(),
        },
      });
      if (error) throw error;
      setGoogleReviews(prev =>
        prev.map(r => r.google_review_id === googleReviewId ? { ...r, reply: replyText.trim() } : r)
      );
      setReplyingTo(null);
      setReplyText("");
      toast.success("Reply sent to Google");
    } catch (e: any) {
      toast.error(e.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const googleAvg = googleReviews.length > 0
    ? Math.round((googleReviews.reduce((s, r) => s + r.rating, 0) / googleReviews.length) * 10) / 10
    : 0;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">Reviews</h1>
      <p className="text-muted-foreground mb-6">Client feedback and stylist ratings</p>

      {/* Stylist Averages */}
      {stylistAvgs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          {stylistAvgs.map((s) => (
            <Card key={s.stylist_id} className="glass rounded-xl border-0 hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150">
              <CardContent className="p-6 text-center">
                <p className="text-sm font-medium mb-1">{s.name}</p>
                <div className="flex items-center justify-center gap-1.5">
                  <Star className="h-4 w-4 fill-champagne text-champagne" />
                  <span className="text-lg font-semibold">{s.avg}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.count} review{s.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="in-app" className="space-y-4">
        <TabsList>
          <TabsTrigger value="in-app">
            In-App Reviews
            {reviews.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{reviews.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="google">
            Google Reviews
            {googleReviews.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{googleReviews.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* In-App Reviews */}
        <TabsContent value="in-app">
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <Card key={r.id} className="glass rounded-xl border-0">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Stars rating={r.rating} />
                          <Badge className="badge-champagne text-[10px]">{r.stylist_name}</Badge>
                        </div>
                        {r.comment && <p className="text-sm text-foreground mb-1">{r.comment}</p>}
                        <p className="text-xs text-muted-foreground">
                          by {r.client_name} · {format(parseISO(r.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Google Reviews */}
        <TabsContent value="google">
          {hasGbp && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {googleReviews.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="font-semibold">{googleAvg}</span>
                    <span className="text-sm text-muted-foreground">({googleReviews.length} reviews)</span>
                  </div>
                )}
              </div>
              <Button onClick={handleSyncGoogle} disabled={syncing} variant="outline" size="sm">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
                Sync from Google
              </Button>
            </div>
          )}

          {googleReviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-10 w-10 mx-auto mb-3 opacity-40" />
              {hasGbp ? (
                <div>
                  <p>No Google reviews synced yet</p>
                  <Button onClick={handleSyncGoogle} disabled={syncing} variant="outline" size="sm" className="mt-3">
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} /> Sync Now
                  </Button>
                </div>
              ) : (
                <div>
                  <p>Connect Google Business Profile in Settings → Integrations to see your Google reviews here</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {googleReviews.map((r) => (
                <Card key={r.id} className="glass rounded-xl border-0">
                  <CardContent className="p-6">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="text-sm font-medium">{r.reviewer_name}</span>
                        <Badge variant="outline" className="text-[10px]">Google</Badge>
                      </div>
                      {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(r.review_time), "MMM d, yyyy")}
                      </p>

                      {/* Reply section */}
                      {r.reply && (
                        <div className="ml-4 mt-2 p-3 rounded-lg bg-primary/5">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Your reply</p>
                          <p className="text-sm">{r.reply}</p>
                        </div>
                      )}

                      {replyingTo === r.google_review_id ? (
                        <div className="ml-4 mt-2 flex gap-2">
                          <Input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write your reply..."
                            className="text-sm rounded-lg"
                            onKeyDown={(e) => e.key === "Enter" && handleReply(r.google_review_id)}
                          />
                          <Button onClick={() => handleReply(r.google_review_id)} disabled={sendingReply || !replyText.trim()} size="sm">
                            {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          </Button>
                          <Button onClick={() => { setReplyingTo(null); setReplyText(""); }} variant="ghost" size="sm">Cancel</Button>
                        </div>
                      ) : (
                        !r.reply && hasGbp && (
                          <Button
                            onClick={() => { setReplyingTo(r.google_review_id); setReplyText(""); }}
                            variant="ghost"
                            size="sm"
                            className="ml-4 mt-1"
                          >
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Reply
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reviews;
