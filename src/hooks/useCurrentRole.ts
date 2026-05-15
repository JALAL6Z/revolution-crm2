import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/access";

export function useCurrentRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      if (authLoading) return;
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setRole((data?.role as AppRole | null) ?? "admin");
        setLoading(false);
      }
    }

    loadRole();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  return { role, loading };
}
