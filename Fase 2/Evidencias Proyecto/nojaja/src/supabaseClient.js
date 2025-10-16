// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL o Key no definidas en .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    schema: 'petcare',
  },
  auth: {
    persistSession: true,           // guarda sesión en localStorage
    autoRefreshToken: true,         // renueva el JWT automáticamente
    detectSessionInUrl: true,       // necesario si usas magic links o reset password
  },
})