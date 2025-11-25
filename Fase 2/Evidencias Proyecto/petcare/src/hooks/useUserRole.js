// src/hooks/useUserRole.js
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function useUserRole() {
  // --- CAMBIO 1: Obtener 'loadingSession' ---
  const { user, loadingSession } = useAuth();

  const [role, setRole] = useState(null);

  // --- CAMBIO 2: El loading inicial SIEMPRE es true ---
  // (Hasta que la lógica de espera decida lo contrario)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {

      // --- CAMBIO 3: AÑADIR LA LÓGICA DE ESPERA ---
      // 1. Si AuthContext sigue cargando, no hacer nada.
      if (loadingSession) {
        return;
      }

      // 2. Si AuthContext terminó pero no hay usuario
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // 3. Si hay usuario, procedemos a cargar el rol
      // (Tu lógica original estaba bien desde aquí)
      setLoading(true);

      try {
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
        } else {
          setRole(data?.role_id || "owner");
        }

      } catch (e) {
        if (cancelled) return;
        console.warn("useUserRole catch:", e);
        setRole("owner");

      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };

    // --- CAMBIO 4: Añadir 'loadingSession' a las dependencias ---
  }, [user?.id, loadingSession]);

  return { role, loading };
}