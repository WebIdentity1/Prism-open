import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scissors, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface SalonInfo {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  address: string | null;
}

const JoinSalon = () => {
  const { salonId } = useParams<{ salonId: string }>();
  const navigate = useNavigate();
  const [salon, setSalon] = useState<SalonInfo | null>(null);
  const [loadingSalon, setLoadingSalon] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Signup form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load salon info
  useEffect(() => {
    if (!salonId) return;
    supabase
      .from("salons")
      .select("id, name, description, logo_url, city, address")
      .eq("id", salonId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error("Salon not found");
          navigate("/");
        } else {
          setSalon(data);
        }
        setLoadingSalon(false);
      });
  }, [salonId, navigate]);

  // Check auth state
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // If logged in, check for existing consultations and redirect
  useEffect(() => {
    if (!user || !salonId || checkingAuth) return;

    const checkExistingConsultations = async () => {
      const { data } = await supabase
        .from("consultations")
        .select("id")
        .eq("client_id", user.id)
        .eq("salon_id", salonId)
        .in("status", ["submitted", "reviewed"])
        .limit(1);

      if (data && data.length > 0) {
        // Already has a consultation — go straight to booking
        navigate(`/dashboard/book?salon=${salonId}`);
      } else {
        // No consultation yet — start one
        navigate(`/consultation?salon=${salonId}`);
      }
    };

    checkExistingConsultations();
  }, [user, salonId, checkingAuth, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/join/${salonId}`,
        data: { full_name: fullName, role: "client" },
      },
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    }
  };

  if (loadingSalon || checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!salon) return null;

  // If user is logged in, the useEffect above will redirect — show loading
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Preparing your experience...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="glass-elevated rounded-3xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          {salon.logo_url ? (
            <img src={salon.logo_url} alt={salon.name} className="h-16 w-16 rounded-full object-cover mx-auto mb-3" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-prism flex items-center justify-center mx-auto mb-3">
              <Scissors className="h-7 w-7 text-white" />
            </div>
          )}
          <h2 className="text-2xl font-light">
            Welcome to {salon.name}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {salon.description || "Create an account to book your first appointment"}
          </p>
          {salon.city && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span>{salon.address ? `${salon.address}, ` : ""}{salon.city}</span>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-accent/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Sign up to get a personalized style consultation and book your first appointment
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-lg" />
            </div>
            <Button type="submit" className="w-full bg-gradient-prism text-white rounded-full" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account...</>
              ) : (
                "Get Started"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to={`/login?returnTo=/join/${salonId}`} className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinSalon;
