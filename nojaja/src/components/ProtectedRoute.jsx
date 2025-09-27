// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    // Si no está logueado, redirige al login y guarda la ruta original
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  return children
}