// src/components/Home.jsx
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'

export default function Home() {
  const { user } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="pt-20 min-h-screen flex flex-col items-center justify-center bg-gray-100"> {/* Agregamos pt-20 */}
      <h1 className="text-3xl font-bold text-gray-800 mb-4">
        {user ? `¡Hola, ${user.email}!` : 'Bienvenido a la página principal'}
      </h1>
      <p className="text-lg text-gray-600">
        {user
          ? 'Estás logueado y puedes ver esta página.'
          : 'Por favor, inicia sesión o regístrate para acceder a más contenido.'}
      </p>

      {user && (
        <>
          <a
            href="/dashboard"
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Ir al panel
          </a>
          <button
            onClick={handleSignOut}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Cerrar sesión
          </button>
        </>
      )}

      {!user && (
        <div className="mt-6 flex gap-4">
          <a
            href="/signin"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Iniciar sesión
          </a>
          <a
            href="/signup"
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            Registrarse
          </a>
        </div>
      )}
    </div>
  )
}