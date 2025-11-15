// src/components/RedirectAuthHome.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useUserRole from "../hooks/useUserRole";

export default function RedirectAuthHome({ children }) {
  const { user } = useAuth();
  const { role, loading } = useUserRole();

  if (!user) return children;
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  return <Navigate to={role === "vet" ? "/vet" : "/app"} replace />;
}
