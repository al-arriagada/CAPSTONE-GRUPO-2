import { supabase } from "../supabaseClient";

// Subir foto (bucket: pets). Devuelve URL pública.
export async function uploadPetPhoto(userId, file) {
  if (!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("pets").upload(path, file, {
    upsert: false, cacheControl: "3600",
  });
  if (error) throw error;
  return supabase.storage.from("pets").getPublicUrl(path).data.publicUrl;
}

// Crear mascota en petcare.pet
export async function createPet(userId, payload) {
  const { data, error } = await supabase
    .schema("petcare")
    .from("pet")
    .insert([{ user_id: userId, ...payload }])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Listar mis mascotas
export async function listMyPets(userId) {
  const { data, error } = await supabase
    .schema("petcare")
    .from("pet")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
