import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const destination = returnTo || "/dashboard";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && active) {
        navigate(destination, { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && active) {
        navigate(destination, { replace: true });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate, returnTo]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role: "salon_admin" },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email to confirm your account!");
      navigate(returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md glass-elevated rounded-2xl p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-prism rounded-lg rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-white/30 rounded-sm rotate-0" />
            </div>
            <span className="text-gradient-brand font-medium text-xl tracking-tight">Prism</span>
          </Link>
          <h1 className="text-3xl font-light mb-2">Create your salon account</h1>
          <p className="text-muted-foreground text-sm">
            Set up your salon on Prism. Stylists and clients are added later from your dashboard.
          </p>
        </div>

        <div className="space-y-6">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Your Name</Label>
              <Input id="name" placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} required className="rounded-lg bg-white/5 border-white/10 backdrop-blur-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-lg bg-white/5 border-white/10 backdrop-blur-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="rounded-lg bg-white/5 border-white/10 backdrop-blur-sm" />
            </div>
            <Button type="submit" className="w-full bg-gradient-prism text-white rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"}
              className="text-primary hover:text-prism-light font-medium transition-colors"
            >
              Log in
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Stylist or client? You'll receive an invite from your salon.
          </p>
          <p className="text-center text-[11px] text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link to="/terms" className="hover:text-foreground underline-offset-4 hover:underline">Terms</Link>
            {" "}and{" "}
            <Link to="/privacy" className="hover:text-foreground underline-offset-4 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
