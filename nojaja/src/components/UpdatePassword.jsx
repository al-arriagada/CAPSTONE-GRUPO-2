import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function UpdatePassword() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
    }
  }

  return (
    <div>
      <h2>Actualizar Contraseña</h2>
      {message && <div style={{ color: 'green' }}>{message}</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={handleUpdate}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nueva contraseña"
        />
        <button type="submit">Actualizar</button>
      </form>
    </div>
  )
}