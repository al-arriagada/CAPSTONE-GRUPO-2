// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)

  useEffect(() => {
    // ✅ Solución: Obtener el resultado completo primero
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error al obtener sesión:', error)
        setUser(null)
      } else {
        setUser(data.session?.user ?? null)
      }
    }

    getSession() // Llama a la función

    // ✅ Suscribirse a cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}