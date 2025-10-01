import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        setError('Error al obtener la sesión.')
        return
      }
      if (!session) {
        setError('No se encontró sesión de recuperación.')
      }
    }

    checkSession()
  }, [])

  const handleUpdate = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Contraseña actualizada con éxito.')
      setError('')
      // Redirige al signin después de 2 segundos
      setTimeout(() => {
        navigate('/signin')
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white shadow-md rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
          Actualizar Contraseña
        </h2>

        {message && (
          <div className="mb-3 px-4 py-2 text-center text-white bg-green-600 rounded-md">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-3 px-4 py-2 text-center text-white bg-red-600 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition duration-200"
          >
            Actualizar
          </button>
        </form>
      </div>
    </div>
  )
}