// src/services/pets.js
import { supabase } from "../supabaseClient";

/** Sube foto al bucket "pets" y devuelve URL pública */
export async function uploadPetPhoto(userId, file) {
  if (!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("pets").upload(path, file, {
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  return supabase.storage.from("pets").getPublicUrl(path).data.publicUrl;
}

/** Crea una mascota (petcare.pet) y devuelve la fila creada */
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

/**
 * Lista las mascotas del usuario
 * @param {string} userId
 * @param {object} opts
 * @param {boolean} opts.includeArchived  Incluir archivadas (deleted_at != null)
 * @param {string}  opts.search           Filtro por nombre (ilike)
 */
export async function listMyPets(
  userId,
  { includeArchived = false, search = "" } = {}
) {
  let q = supabase
    .schema("petcare")
    .from("pet")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!includeArchived) q = q.is("deleted_at", null);
  if (search) q = q.ilike("name", `%${search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Obtiene una mascota por id
 * @param {string} petId
 * @param {object} opts
 * @param {boolean} opts.includeArchived  Permitir obtener archivadas
 */
export async function getPetById(petId, { includeArchived = false } = {}) {
  let q = supabase
    .schema("petcare")
    .from("pet")
    .select("*")
    .eq("pet_id", petId)
    .maybeSingle();

  if (!includeArchived) {
    q = supabase
      .schema("petcare")
      .from("pet")
      .select("*")
      .eq("pet_id", petId)
      .is("deleted_at", null)
      .maybeSingle();
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || null;
}

/** Soft delete (archivar) */
export async function archivePet(petId, userId) {
  const { error } = await supabase
    .schema("petcare")
    .from("pet")
    .update({ deleted_at: new Date().toISOString() })
    .eq("pet_id", petId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Restaurar desde papelera (quita deleted_at) */
export async function restorePet(petId, userId) {
  const { error } = await supabase
    .schema("petcare")
    .from("pet")
    .update({ deleted_at: null })
    .eq("pet_id", petId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** (Opcional) Eliminación definitiva */
export async function hardDeletePet(petId, userId) {
  const { error } = await supabase
    .schema("petcare")
    .from("pet")
    .delete()
    .eq("pet_id", petId)
    .eq("user_id", userId);
  if (error) throw error;
}
