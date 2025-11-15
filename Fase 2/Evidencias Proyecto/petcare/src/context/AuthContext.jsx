// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { ensureProfileOnAuth } from "../services/profile";
// --- Eliminado import de registerPush y unregisterPush ---

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Guard para no repetir ensureProfile por sesión
  const lastEnsuredRef = useRef(null);
  // --- Eliminadas refs de push (didRegisterPushRef, lastUserIdRef) ---

  // --- Eliminada la función 'maybeRegisterPush' ---

  useEffect(() => {
    let cancelled = false;

    // 1) Cargar sesión actual
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("[auth] getSession:", error);
        if (!cancelled) {
          const u = data?.session?.user ?? null;
          setUser(u);
        }
      } catch (e) {
        console.warn("[auth] getSession threw:", e?.message || e);
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();

    // 2) Escuchar cambios de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        const u = session?.user ?? null;
        setUser(u);
        setLoadingSession(false); // libera UI ante cualquier evento

        if (event === "SIGNED_IN" && u) {
          // asegurar perfil una sola vez por usuario
          if (lastEnsuredRef.current !== u.id) {
            lastEnsuredRef.current = u.id;
            ensureProfileOnAuth(u).catch((e) =>
              console.warn("[auth] ensureProfileOnAuth:", e?.message || e)
            );
          }
          // --- Eliminada la llamada a maybeRegisterPush ---
        }

        if (event === "SIGNED_OUT") {
          // --- Eliminada la lógica de unregisterPush ---
          lastEnsuredRef.current = null;
        }
      }
    );

    // 3) Captura de errores globales
    const onRejection = (e) => console.error("[unhandledrejection]", e.reason || e);
    const onError = (e) => console.error("[error]", e.message || e);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);

    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    // Resetea guard
    lastEnsuredRef.current = null;
    // --- Eliminados resets de refs de push ---
  };

  // Alias de compatibilidad
  const loading = loadingSession;

  return (
    <AuthContext.Provider value={{ user, loadingSession, loading, signOut }}>
      {loadingSession ? (
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