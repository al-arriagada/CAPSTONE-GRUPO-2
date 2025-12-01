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


// Listar mascotas compartidas con el usuario actual (vet)
export async function listPetsSharedWithMe(userId) {
  // Requiere tabla pet_member con RLS para member_user_id = auth.uid()
  const { data, error } = await supabase
    .schema("petcare")
    .from("pet_member")
    .select(`
      member_role_id,
      permissions,
      pet:pet_id (
        pet_id, name, species_id, breed, image_url, status_id
      )
    `)
    .eq("member_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(r => ({ ...r.pet, member_role_id: r.member_role_id, permissions: r.permissions }));
}

// ========================================
// PET TRANSFER FUNCTIONS
// ========================================

/**
 * Initiate a pet transfer to a new owner
 * @param {string} petId - Pet to transfer
 * @param {string} newOwnerEmail - Email of new owner
 * @param {string} reason - Reason for transfer
 * @param {string} documentId - Optional supporting document
 * @returns {Promise<object>} Transfer history record
 */
export async function initiatePetTransfer(petId, newOwnerEmail, reason, documentId = null) {
  // 1. Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("No autenticado");

  // 2. Verify current ownership and get pet status
  const { data: pet, error: petError } = await supabase
    .schema("petcare")
    .from("pet")
    .select("user_id, status_id")
    .eq("pet_id", petId)
    .single();

  if (petError) throw petError;
  if (!pet) throw new Error("Mascota no encontrada");
  if (pet.user_id !== user.id) throw new Error("No eres el dueño de esta mascota");

  // 3. Find new owner by email
  const { data: newOwner, error: ownerError } = await supabase
    .schema("petcare")
    .from("app_user")
    .select("user_id, full_name")
    .eq("email", newOwnerEmail.trim().toLowerCase())
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!newOwner) throw new Error("Usuario no encontrado con ese email");
  if (newOwner.user_id === user.id) throw new Error("No puedes transferir a ti mismo");

  // 4. Generate confirmation token
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

  // 5. Create transfer record (pending state)
  const { data: transfer, error: transferError } = await supabase
    .schema("petcare")
    .from("pet_ownership_history")
    .insert({
      pet_id: petId,
      previous_owner_id: user.id,
      new_owner_id: newOwner.user_id,
      previous_status_id: pet.status_id || 'active', // Use current status or default
      new_status_id: pet.status_id || 'active', // Status remains the same
      reason: reason,
      document_id: documentId,
      confirmed_by_previous: true, // Current owner is initiating
      confirmation_token: token,
      token_expires_at: expiresAt.toISOString(),
      transfer_date: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (transferError) throw transferError;

  return transfer;
}

/**
 * Confirm a pet transfer (new owner accepts)
 * @param {string} token - Confirmation token
 * @returns {Promise<object>} Confirmation result
 */
export async function confirmPetTransfer(token) {
  const { data, error } = await supabase
    .schema("petcare")
    .rpc("confirm_pet_transfer", { p_token: token });

  if (error) {
    throw new Error(error.message || "No se pudo confirmar la transferencia");
  }

  return data;
}

/**
 * Get transfer history for a pet
 * @param {string} petId
 * @returns {Promise<Array>} Transfer history records
 */
export async function getPetTransferHistory(petId) {
  const { data, error } = await supabase
    .schema("petcare")
    .from("pet_ownership_history")
    .select(`
      *,
      previous_owner:app_user!pet_ownership_history_previous_owner_id_fkey(user_id, full_name, email),
      new_owner:app_user!pet_ownership_history_new_owner_id_fkey(user_id, full_name, email)
    `)
    .eq("pet_id", petId)
    .order("transfer_date", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get pending transfers for current user (as new owner)
 * @returns {Promise<Array>} Pending transfer records
 */
export async function getMyPendingTransfers() {
  const { data, error } = await supabase
    .schema("petcare")
    .rpc("get_my_pending_transfers");

  if (error) {
    throw error;
  }

  // Transform RPC result to match expected format
  return (data || []).map(row => ({
    history_id: row.history_id,
    pet_id: row.pet_id,
    transfer_date: row.transfer_date,
    reason: row.reason,
    confirmation_token: row.confirmation_token,
    previous_owner_id: row.previous_owner_id,
    pet: {
      pet_id: row.pet_id,
      name: row.pet_name,
      breed: row.pet_breed,
      image_url: row.pet_image_url,
      species_id: row.pet_species_id
    },
    previous_owner: {
      user_id: row.previous_owner_id,
      full_name: row.previous_owner_name,
      email: row.previous_owner_email
    }
  }));
}

