import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;       // o un loader
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}
