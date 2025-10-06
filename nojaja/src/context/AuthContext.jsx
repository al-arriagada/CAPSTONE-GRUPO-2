// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { ensureProfileOnAuth } from "../services/profile";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const lastEnsuredRef = useRef(null);

  // Función para actualizar el avatar desde cualquier componente
  const updateUserAvatar = (avatarPath) => {
    console.log("🔄 updateUserAvatar llamado con:", avatarPath);
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    const { data } = supabase.storage.from("owners").getPublicUrl(avatarPath);
    const fullUrl = `${data?.publicUrl}?t=${Date.now()}`;
    console.log("✅ Nueva URL de avatar:", fullUrl);
    setAvatarUrl(fullUrl);
  };

  // Cargar avatar desde la base de datos
  const loadUserAvatar = async (userId) => {
    try {
      const { data: appUser } = await supabase
        .from("app_user")
        .select("avatar_url")
        .eq("user_id", userId)
        .single();

      if (appUser?.avatar_url) {
        updateUserAvatar(appUser.avatar_url);
      } else {
        setAvatarUrl(null);
      }
    } catch (err) {
      console.error("Error loading avatar:", err);
      setAvatarUrl(null);
    }
  };

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("getSession:", error);
        if (!ignore) {
          setUser(null);
          setAvatarUrl(null);
          setLoading(false);
        }
        return;
      }

      const u = session?.user ?? null;
      if (!ignore) {
        setUser(u);
      }

      // Asegura perfil en la carga inicial si hay usuario
      if (u && lastEnsuredRef.current !== u.id) {
        lastEnsuredRef.current = u.id;
        ensureProfileOnAuth(u).catch((e) =>
          console.warn("ensureProfileOnAuth(init):", e?.message || e)
        );
        // Cargar avatar del usuario
        loadUserAvatar(u.id);
      }

      if (!ignore) setLoading(false);
    };

    init();

    // Suscripción a cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);

        // Asegura perfil en eventos relevantes
        const shouldEnsure =
          u &&
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED");

        if (shouldEnsure && lastEnsuredRef.current !== u.id) {
          lastEnsuredRef.current = u.id;
          ensureProfileOnAuth(u).catch((e) =>
            console.warn("ensureProfileOnAuth(event):", e?.message || e)
          );
          // Cargar avatar en eventos de autenticación
          loadUserAvatar(u.id);
        }

        // Al cerrar sesión, resetea el guard y avatar
        if (!u) {
          lastEnsuredRef.current = null;
          setAvatarUrl(null);
        }
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
    setAvatarUrl(null);
    lastEnsuredRef.current = null;
  };

  // ✅ ASEGÚRATE DE EXPORTAR updateUserAvatar
  const value = {
    user,
    loading,
    signOut,
    avatarUrl,
    updateUserAvatar, // ✅ Incluir en el value
  };

  return (
    <AuthContext.Provider value={value}>
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