// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { ensureProfileOnAuth } from "../services/profile";
import { registerPush, unregisterPush } from "../notifications/registerPush.ts"; // ⬅️ nuevo

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Evita re-ejecutar ensureProfile y registro de push
  const lastEnsuredRef = useRef(null);
  const didRegisterPushRef = useRef(false);
  const lastUserIdRef = useRef(null);

  // helper: registra push una sola vez por sesión
  const maybeRegisterPush = async (u) => {
    if (!u) return;
    lastUserIdRef.current = u.id;
    if (!didRegisterPushRef.current) {
      try { await registerPush(u.id); } catch (e) { console.warn("registerPush:", e); }
      didRegisterPushRef.current = true;
    }
  };

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
          const u = data?.session?.user ?? null;
          setUser(u);
          // si ya estaba logueado al cargar, registra push una vez
          if (u) { maybeRegisterPush(u); }
        }
      } finally {
        if (!cancelled) setLoading(false); // siempre liberar
      }
    })();

    // 2) Escuchar cambios de auth — tampoco bloquea
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        const u = session?.user ?? null;
        setUser(u);
        setLoading(false); // siempre liberar UI ante cualquier evento

        if (event === "SIGNED_IN" && u) {
          // Asegurar perfil SOLO al iniciar sesión (una vez por usuario)
          if (lastEnsuredRef.current !== u.id) {
            lastEnsuredRef.current = u.id;
            ensureProfileOnAuth(u).catch((e) =>
              console.warn("ensureProfileOnAuth:", e?.message || e)
            );
          }
          // Registrar push (una sola vez por sesión)
          await maybeRegisterPush(u);
        }

        if (event === "SIGNED_OUT") {
          // Limpia guardas y desregistra token
          if (lastUserIdRef.current) {
            try { await unregisterPush(lastUserIdRef.current); } catch {}
          }
          didRegisterPushRef.current = false;
          lastEnsuredRef.current = null;
          lastUserIdRef.current = null;
        }
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
    didRegisterPushRef.current = false;
    // unregisterPush también se ejecutará por el listener de SIGNED_OUT
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
