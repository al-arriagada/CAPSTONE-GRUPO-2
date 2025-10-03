// src/services/profile.js
import { supabase } from "../supabaseClient";

export async function upsertAppUserFromAuthUser(u) {
  // toma todo de auth: id/email + metadatos que mandes en el signup
const raw = (u.user_metadata && u.user_metadata.birth_date) || null;
const birth_date =
  raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;

const payload = {
  user_id: u.id,
  email: u.email,
  full_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email,
  birth_date,           // 👈 ya validado
  rut: u.user_metadata?.rut || null,
  updated_at: new Date().toISOString(),
};

  // si no enviaste algunos campos, igual guarda lo que haya
  const { data, error } = await supabase
    .schema("petcare")
    .from("app_user")
    .upsert([payload], { onConflict: "user_id" })
    .select("user_id")
    .single();

  if (error) throw error;
  return data;
}
