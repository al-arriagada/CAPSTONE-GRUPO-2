// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { ensureProfileOnAuth } from "../services/profile";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastEnsuredRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    // ⬇️ Failsafe: si algo se traba, suelta el loading en 2s
    const failsafe = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 2000);

    // 1) Cargar sesión actual — NO bloquear la UI
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("getSession:", error);
        if (!cancelled) {
          setUser(data?.session?.user ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false); // siempre liberar
      }
    })();

    // 2) Escuchar cambios de auth — tampoco bloquea
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;

        const u = session?.user ?? null;
        setUser(u);
        setLoading(false); // siempre liberar UI ante cualquier evento

        // Asegurar perfil SOLO al iniciar sesión (una vez por usuario)
        if (event === "SIGNED_IN" && u && lastEnsuredRef.current !== u.id) {
          lastEnsuredRef.current = u.id;
          ensureProfileOnAuth(u).catch((e) =>
            console.warn("ensureProfileOnAuth:", e?.message || e)
          );
        }

        // Al cerrar sesión, limpia el guard
        if (!u) lastEnsuredRef.current = null;
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
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
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">Cargando...</div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
