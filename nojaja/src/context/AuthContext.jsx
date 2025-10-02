// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { ensureProfile } from "../services/profile";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);   // SOLO detección de sesión inicial

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
      if (!ignore) {
        setUser(u);
        setLoading(false);               // ⬅️ libera la UI inmediatamente
      }

      // corre ensureProfile SIN bloquear la UI
      if (u) {
        ensureProfile({
          id: u.id,
          full_name: u.user_metadata?.name || u.email,
        }).catch((e) => console.error("ensureProfile(init):", e));
      }
    };

    init();

    // Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        if (u && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
          ensureProfile({
            id: u.id,
            full_name: u.user_metadata?.name || u.email,
          }).catch((e) => console.error("ensureProfile(onAuth):", e));
        }
      }
    );

    return () => { ignore = true; subscription?.unsubscribe?.(); };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, signOut }}>
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
