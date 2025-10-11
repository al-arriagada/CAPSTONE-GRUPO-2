// src/hooks/useUserRole.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(!!user);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user) { setRole(null); setLoading(false); return; }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .schema("petcare")
          .from("app_user")
          .select("role_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn("useUserRole error:", error);
          setRole("owner"); // fallback
          setLoading(false);
          return;
        }

        setRole(data?.role_id || "owner");
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.warn("useUserRole catch:", e);
          setRole("owner");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return { role, loading };
}
