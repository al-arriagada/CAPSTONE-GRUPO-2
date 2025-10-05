// src/services/profile.js
import { supabase } from "../supabaseClient";

// ---- Normalizadores útiles ----
export function onlyDigits(str = "") {
  return (str || "").replace(/\D+/g, "");
}

/** 
 * Normaliza un RUT chileno:
 * - Saca puntos
 * - DV en mayúscula
 * - Formato "XXXXXXXX-D" (con guion)
 * Retorna { compact, formatted } (ambos iguales aquí, deja preparado por si quieres formato con puntos)
 */
export function normalizeRut(rut = "") {
  const clean = (rut || "").replace(/[^0-9kK]/g, "");
  if (clean.length < 2) return { compact: "", formatted: "" };
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  const compact = `${body}-${dv}`;
  return { compact, formatted: compact };
}

/**
 * Upsert del perfil en app_user + user_pii usando datos de auth.user y/o overrides del formulario.
 * - user: objeto devuelto por supabase.auth.getUser() / onAuthStateChange
 * - overrides: { full_name, rut, birth_date, gender, comuna_id, address_line, phone, email }
 */
export async function upsertAppUserFromAuthUser(user, overrides = {}) {
  if (!user?.id) {
    throw new Error("No hay usuario autenticado para crear perfil.");
  }

  // fuente: overrides -> metadata -> auth fields
  const meta = user.user_metadata || {};
  const full_name =
    overrides.full_name ??
    meta.full_name ??
    meta.name ??
    null;

  const email =
    overrides.email ??
    user.email ??
    null;

  const birth_date =
    overrides.birth_date ??
    meta.birth_date ??
    null; // YYYY-MM-DD

  const gender =
    overrides.gender ??
    meta.gender ??
    null; // ej. male | female | other

  const comuna_id =
    overrides.comuna_id ??
    meta.comuna_id ??
    null;

  const { compact: rutCompact } = normalizeRut(
    overrides.rut ?? meta.rut ?? ""
  );

  const appUserRow = {
    user_id: user.id,
    full_name,
    email,        // si tu tabla app_user tiene columna email (CITEXT)
    rut: rutCompact || null,  // si tienes columna RUT en app_user; si la tienes única, capturamos duplicados
    birth_date: birth_date || null, // si tu app_user tiene birth_date (en tu screenshot sí)
    gender: gender || null,
    comuna_id: comuna_id || null,
    updated_at: new Date().toISOString(),
  };

  // Quita claves con undefined (evita problemas con PostgREST al hacer upsert parcial)
  Object.keys(appUserRow).forEach((k) => {
    if (appUserRow[k] === undefined) delete appUserRow[k];
  });

  // 1) upsert app_user
  let appUser;
  {
    const { data, error } = await supabase
      .schema("petcare")
      .from("app_user")
      .upsert(appUserRow, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      // Duplicado (Rut o email únicos)
      if (error.code === "23505") {
        // Según el nombre de tu constraint puedes personalizar el mensaje
        if (String(error.message).toLowerCase().includes("rut")) {
          throw new Error("El RUT ya está registrado en otra cuenta.");
        }
        if (String(error.message).toLowerCase().includes("email")) {
          throw new Error("El correo ya está registrado en otra cuenta.");
        }
        throw new Error("Ya existe un perfil con esos datos únicos.");
      }
      throw error;
    }
    appUser = data;
  }

  // 2) upsert user_pii (dirección / teléfono)
  const pii = {
    user_id: user.id,
    address_line: (overrides.address_line ?? meta.address_line ?? null) || null,
    phone: (overrides.phone ?? meta.phone ?? null)
      ? onlyDigits(overrides.phone ?? meta.phone)
      : null,
    updated_at: new Date().toISOString(),
  };

  // Si no tienes fila previa, upsert crea; si existe, actualiza
  const { error: piiError } = await supabase
    .schema("petcare")
    .from("user_pii")
    .upsert(pii, { onConflict: "user_id" });

  if (piiError) {
    // No es crítico para bloquear al usuario, pero conviene reportar
    console.warn("upsert user_pii error:", piiError);
  }

  return appUser;
}

/**
 * Helper para usar en AuthContext al detectar sesión:
 * Asegura que exista un perfil mínimo con full_name/email.
 */
export async function ensureProfileOnAuth(user) {
  try {
    await upsertAppUserFromAuthUser(user);
  } catch (e) {
    // Si falla por duplicados de rut/email y no tienes esos campos en metadata, no bloquees la app
    console.warn("ensureProfileOnAuth:", e?.message || e);
  }
}
