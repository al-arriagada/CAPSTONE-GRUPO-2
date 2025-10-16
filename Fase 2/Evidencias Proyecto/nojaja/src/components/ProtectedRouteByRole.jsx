// src/components/ProtectedRouteByRole.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useUserRole from "../hooks/useUserRole";
import { useEffect, useRef, useState } from "react";

export default function ProtectedRouteByRole({ allowedRoles, children }) {
  const { user, loading } = useAuth();
  const { role, loading: loadingRole } = useUserRole();

  const [expired, setExpired] = useState(false);
  const timer = useRef(null);
  useEffect(() => {
    timer.current = setTimeout(() => setExpired(true), 3000);
    return () => clearTimeout(timer.current);
  }, []);

  if (loading || (loadingRole && !expired)) {
    return <div className="min-h-screen flex items-center justify-center">Cargando…</div>;
  }
  
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  const effectiveRole = role || "owner"; // fallback


  if (!allowedRoles.includes(effectiveRole)) {
    
 
    switch (effectiveRole) {
      case 'owner':
        return <Navigate to="/app" replace />;
      case 'vet':
        return <Navigate to="/vet" replace />;
      case 'caregiver':
        return <Navigate to="/caregiver" replace />;
      default:
        
        return <Navigate to="/app" replace />;
    }
  }

  // Si el rol sí está permitido, muestra el contenido de la ruta.
  return children;
}