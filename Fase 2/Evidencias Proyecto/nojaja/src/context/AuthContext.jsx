// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { ensureProfileOnAuth } from "../services/profile";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Evita re-asegurar el mismo user en un mismo ciclo
  const lastEnsuredRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("getSession:", error);
        if (!ignore) { setUser(null); setLoading(false); }
        return;
      }

      const u = session?.user ?? null;
      if (!ignore) setUser(u);

      // Solo crea el perfil si NO existe (no sobreescribe)
      if (u && lastEnsuredRef.current !== u.id) {
        lastEnsuredRef.current = u.id;
        ensureProfileOnAuth(u).catch((e) =>
          console.warn("ensureProfileOnAuth(init):", e?.message || e)
        );
      }

      if (!ignore) setLoading(false);
    };

    init();

    // Suscripción de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        // ✅ Solo al iniciar sesión; NO en TOKEN_REFRESHED/USER_UPDATED
        if (event === "SIGNED_IN" && u && lastEnsuredRef.current !== u.id) {
          lastEnsuredRef.current = u.id;
          ensureProfileOnAuth(u).catch((e) =>
            console.warn("ensureProfileOnAuth(SIGNED_IN):", e?.message || e)
          );
        }

        // Al cerrar sesión, limpia el guard
        if (!u) lastEnsuredRef.current = null;
      }
    );

    return () => {
      ignore = true;
      subscription?.unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    lastEnsuredRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading ? (
        children
      ) : (
        <div className="min-h-screen flex items-center justify-center">Cargando...</div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
