// src/components/ProtectedRouteByRole.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useUserRole from "../hooks/useUserRole";
import { useEffect, useRef, useState } from "react";

export default function ProtectedRouteByRole({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const { role, loading: loadingRole } = useUserRole();

  // ⬇️ Timeout de seguridad de 3s para no quedar pegado
  const [expired, setExpired] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = setTimeout(() => setExpired(true), 3000);
    return () => clearTimeout(timer.current);
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  }
  if (!user) return <Navigate to="/signin" replace />;

  const stillLoading = loadingRole && !expired;
  if (stillLoading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  }

  const effectiveRole = role || "owner"; // fallback
  if (!allowedRoles.includes(effectiveRole)) {
    return <Navigate to={effectiveRole === "vet" ? "/vet" : "/app"} replace />;
  }

  return children;
}
