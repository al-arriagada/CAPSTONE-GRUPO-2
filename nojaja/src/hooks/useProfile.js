import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!!user);

  useEffect(() => {
    let abort = false;
    async function load() {
      if (!user) { setProfile(null); setLoading(false); return; }
      setLoading(true);
      const { data, error } = await supabase
        .schema("petcare")
        .from("app_user")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!abort) {
        if (error) console.error("load profile:", error);
        setProfile(data ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { abort = true; };
  }, [user?.id]);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split("@")[0] : "");

  return { profile, displayName, loading };
}
