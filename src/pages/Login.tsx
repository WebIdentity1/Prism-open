import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { User, Palette, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isDemoLoginEnabled } from "@/lib/demo-login";

const DEMO_ACCOUNTS = [
  { email: "demo-client@prism.app", password: "demo1234", label: "Client", icon: User, description: "Browse styles & try-on", gradient: "bg-gradient-prism text-white" },
  { email: "demo-stylist@prism.app", password: "demo1234", label: "Stylist", icon: Palette, description: "Manage consultations", gradient: "bg-gradient-teal text-obsidian" },
  { email: "demo-admin@prism.app", password: "demo1234", label: "Salon Owner", icon: Building2, description: "Full admin access", gradient: "bg-gradient-champagne text-obsidian" },
];

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [demoSeeded, setDemoSeeded] = useState(false);
  const demoLoginEnabled = isDemoLoginEnabled();

  useEffect(() => {
    if (!demoLoginEnabled) return;

    const seedDemoUsers = async () => {
      try {
        await supabase.functions.invoke("seed-demo-data");
      } catch (error) {
        console.warn("Demo seed skipped", error);
      }
      setDemoSeeded(true);
    };
    seedDemoUsers();
  }, [demoLoginEnabled]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate(returnTo || "/dashboard");
    }
  };

  const handleDemoLogin = async (account: typeof DEMO_ACCOUNTS[0]) => {
    setDemoLoading(account.email);
    const { error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    setDemoLoading(null);
    if (error) {
      toast.error("Demo login failed. Try again in a moment.");
    } else {
      toast.success(`Signed in as ${account.label}`);
      navigate(returnTo || "/dashboard");
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md glass-elevated rounded-2xl p-8">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-prism rounded-lg rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-white/30 rounded-sm rotate-0" />
            </div>
            <span className="text-gradient-brand font-medium text-xl tracking-tight">Prism</span>
          </Link>
          <h1 className="text-3xl font-light mb-2">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your account to continue</p>
        </div>

        <div className="space-y-6">
          {demoLoginEnabled && (
            <>
              <div className="space-y-3">
                <p className="text-xs font-medium text-champagne uppercase tracking-wide text-center">Quick Demo Login</p>
                <div className="grid grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map((account) => {
                    const Icon = account.icon;
                    return (
                      <button
                        key={account.email}
                        onClick={() => handleDemoLogin(account)}
                        disabled={demoLoading !== null || !demoSeeded}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-full ${account.gradient} hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none shadow-sm`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{account.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent backdrop-blur-sm px-3 text-champagne">or sign in</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-lg bg-white/5 border-white/10 backdrop-blur-sm" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:text-prism-light transition-colors">Forgot password?</Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="rounded-lg bg-white/5 border-white/10 backdrop-blur-sm" />
            </div>
            <Button type="submit" className="w-full bg-gradient-prism text-white rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"}
              className="text-primary hover:text-prism-light font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
