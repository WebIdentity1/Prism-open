import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "client" | "stylist" | "salon_admin";

async function fetchRole(userId: string): Promise<AppRole> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as AppRole) || "client";
}

export function useAuth(redirectIfUnauthenticated = true) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>("client");
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Set up listener first — single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setRole("client");
        setLoading(false);
        if (redirectIfUnauthenticated) navigate("/login");
        return;
      }

      if (session) {
        setUser(session.user);
        // Avoid awaiting inside callback to prevent deadlocks — use then()
        fetchRole(session.user.id).then((r) => {
          setRole(r);
          setLoading(false);
        });
      }
      // Ignore transient null sessions (e.g. during TOKEN_REFRESHED)
    });

    // Initial hydration — only if listener hasn't fired yet
    if (!initializedRef.current) {
      initializedRef.current = true;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setLoading(false);
          if (redirectIfUnauthenticated) navigate("/login");
          return;
        }
        setUser(session.user);
        fetchRole(session.user.id).then((r) => {
          setRole(r);
          setLoading(false);
        });
      });
    }

    return () => subscription.unsubscribe();
  }, [navigate, redirectIfUnauthenticated]);

  return { user, role, loading };
}
