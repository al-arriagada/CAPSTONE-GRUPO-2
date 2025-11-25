// src/hooks/useProfile.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from '../context/AuthContext'; // <-- 1. Importamos useAuth

export default function useProfile() { // <-- 2. YA NO recibe 'user' como prop

  // 3. Obtenemos el usuario y el estado de carga DESDE EL CONTEXTO
  const { user, loadingSession } = useAuth();

  const [profile, setProfile] = useState(null);
  // 4. El loading AHORA DEPENDE del loadingSession
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;

    async function load() {

      // 5. AÑADIMOS LA LÓGICA DE ESPERA
      if (loadingSession) {
        return; // No hacer nada si el auth sigue cargando
      }
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Si llegamos aquí, loadingSession=false y user=existe
      setLoading(true);

      const { data, error } = await supabase
        .schema("petcare")
        .from("app_user")
        .select("full_name, email, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!abort) {
        if (error) console.error("load profile:", error);
        setProfile(data ?? null);
        setLoading(false);
      }
    }

    load();

    return () => {
      abort = true;
    };

    // 6. Añadimos 'loadingSession' a las dependencias
  }, [user?.id, loadingSession]);

  // Esta lógica de 'displayName' sigue funcionando
  // porque 'user' lo obtenemos del context
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email ? user.email.split("@")[0] : "");

  const avatarUrl = profile?.avatar_url ?? null;

  return { profile, displayName, avatarUrl, loading };
}