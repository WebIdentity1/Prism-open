import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
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
          <h1 className="text-3xl font-light mb-2">
            {sent ? "Check your email" : "Reset your password"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {sent
              ? "We've sent a password reset link to your email address."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="space-y-6">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="h-12 w-12 text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive it? Check your spam folder or{" "}
                <button onClick={() => setSent(false)} className="text-primary hover:text-prism-light font-medium transition-colors">
                  try again
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-lg bg-white/5 border-white/10 backdrop-blur-sm"
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-prism text-white rounded-full hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <ArrowLeft className="h-3 w-3" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
