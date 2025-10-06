// src/components/Dashboard.jsx
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export default function Dashboard() {
  const { user } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="pt-20 min-h-screen flex flex-col items-center justify-center bg-gray-100"> {/* Agregamos pt-20 para dar espacio al navbar */}
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Panel de Usuario</h1>
        <p className="text-gray-600 mb-2">¡Hola, <strong>{user?.email}</strong>!</p>
        <p className="text-gray-600 mb-6">Estás en una página protegida.</p>
        <button
          onClick={handleSignOut}
          className="w-full py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}