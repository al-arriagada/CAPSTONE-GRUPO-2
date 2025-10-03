// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { upsertAppUserFromAuthUser } from "../services/profile";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);

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
      if (!ignore) { setUser(u); setLoading(false); }

      // Si ya había sesión (p.ej. recarga), copia a app_user
      if (u) upsertAppUserFromAuthUser(u).catch(console.error);
    };

    init();

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange(async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        if (u && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
          // Primer login después de confirmar: copiamos a app_user aquí
          upsertAppUserFromAuthUser(u).catch(console.error);
        }
      });

    return () => subscription?.unsubscribe?.();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading ? children : (
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
