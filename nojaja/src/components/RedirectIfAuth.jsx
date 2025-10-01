import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;               // o un spinner
  if (user) return <Navigate to="/app" replace />;
  return children;
}