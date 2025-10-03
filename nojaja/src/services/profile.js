// src/services/profile.js
import { supabase } from "../supabaseClient";

// Asegura que exista una fila en petcare.app_user para el auth.uid() actual
export async function ensureProfile({ id, email }) {
  // lee si existe
  const { data: row, error: readErr } = await supabase
    .schema("petcare")
    .from("app_user")
    .select("user_id")
    .eq("user_id", id)
    .maybeSingle();

  if (readErr) throw readErr;
  if (row) return row;

  // crea si no existe
  const { data, error } = await supabase
    .schema("petcare")
    .from("app_user")
    .insert([{ user_id: id, email }])
    .select("user_id")
    .single();

  if (error) throw error;
  return data;
}
