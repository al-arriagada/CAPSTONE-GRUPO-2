// src/services/profile.js
import { supabase } from "../supabaseClient";

// ---- Normalizadores útiles ----
export function onlyDigits(str = "") {
  return (str || "").replace(/\D+/g, "");
}

/** Normaliza RUT a "XXXXXXXX-D" (sin puntos, DV en mayúscula) */
export function normalizeRut(rut = "") {
  const clean = (rut || "").replace(/[^0-9kK]/g, "");
  if (clean.length < 2) return { compact: "", formatted: "" };
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  const compact = `${body}-${dv}`;
  return { compact, formatted: compact };
}

/** De cualquier formato → E.164 chileno (+569XXXXXXXX) o null si incompleto */
export function normalizePhoneToE164CL(value = "") {
  const d = onlyDigits(value);
  let local = d;
  if (d.startsWith("569")) local = d.slice(3);
  else if (d.startsWith("56")) {
    local = d.slice(2);
    if (local.startsWith("9")) local = local.slice(1);
  } else if (d.startsWith("9")) local = d.slice(1);
  local = (local || "").slice(0, 8);
  return local.length === 8 ? `+569${local}` : null;
}

/**
 * Upsert de perfil usando auth.user + overrides (si necesitas usarlo manualmente).
 * NO lo llames desde AuthContext al iniciar sesión (ver ensureProfileOnAuth abajo).
 */
export async function upsertAppUserFromAuthUser(user, overrides = {}) {
  if (!user?.id) throw new Error("No hay usuario autenticado para crear/actualizar perfil.");
  const meta = user.user_metadata || {};

  const { compact: rutCompact } = normalizeRut(overrides.rut ?? meta.rut ?? "");
  const phoneE164 = normalizePhoneToE164CL(overrides.phone ?? meta.phone ?? "");

  const appUserRow = {
    user_id: user.id,
    full_name: overrides.full_name ?? meta.full_name ?? meta.name ?? null,
    email: overrides.email ?? user.email ?? null,
    rut: rutCompact || null,
    birth_date: overrides.birth_date ?? meta.birth_date ?? null,
    gender: overrides.gender ?? meta.gender ?? null,
    comuna_id: overrides.comuna_id ?? meta.comuna_id ?? null,
    updated_at: new Date().toISOString(),
  };
  Object.keys(appUserRow).forEach((k) => appUserRow[k] === undefined && delete appUserRow[k]);

  const { data: appUser, error } = await supabase
    .schema("petcare")
    .from("app_user")
    .upsert(appUserRow, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("rut")) throw new Error("El RUT ya está registrado en otra cuenta.");
      if (msg.includes("email")) throw new Error("El correo ya está registrado en otra cuenta.");
      throw new Error("Ya existe un perfil con datos únicos en conflicto.");
    }
    throw error;
  }

  const pii = {
    user_id: user.id,
    address_line: (overrides.address_line ?? meta.address_line ?? null) || null,
    phone: phoneE164, // guardamos en E.164 o null
    updated_at: new Date().toISOString(),
  };

  const { error: piiError } = await supabase
    .schema("petcare")
    .from("user_pii")
    .upsert(pii, { onConflict: "user_id" });

  if (piiError) console.warn("upsert user_pii error:", piiError);

  return appUser;
}

/**
 * ⚠️ Usar en AuthContext al detectar sesión:
 * Crea app_user (y opcional user_pii) SOLO si no existen. NO sobreescribe.
 */
export async function ensureProfileOnAuth(authUser) {
  if (!authUser?.id) return;

  // ¿ya existe?
  const { data: exists, error: selErr } = await supabase
    .schema("petcare")
    .from("app_user")
    .select("user_id")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (selErr) {
    console.warn("ensureProfileOnAuth select:", selErr?.message || selErr);
    return;
  }
  if (exists) return; // no tocar si ya existe

  const meta = authUser.user_metadata || {};
  const { compact: rutCompact } = normalizeRut(meta.rut ?? "");

  // armamos fila base; solo incluimos claves cuando vienen
  const base = {
    user_id: authUser.id,
    email: authUser.email ?? null,
    full_name: meta.full_name ?? meta.name ?? null,
    gender: meta.gender ?? null,
  };
  if (meta.birth_date) base.birth_date = meta.birth_date;           // si la columna existe
  if (rutCompact) base.rut = rutCompact;
  if (meta.comuna_id) base.comuna_id = Number(meta.comuna_id);      // <- comuna
  // si definiste role_id en tu tabla, también puedes intentar guardarlo:
  if (meta.role_id) base.role_id = meta.role_id;

  // inserta UNA vez; si falta alguna columna (42703), reintenta sin esa(s)
  let { error } = await supabase.schema("petcare").from("app_user").insert(base);

  if (error) {
    if (error.code === "42703") {
      const cleaned = { ...base };
      delete cleaned.role_id;
      delete cleaned.birth_date;
      const r2 = await supabase.schema("petcare").from("app_user").insert(cleaned);
      if (r2.error && r2.error.code !== "23505") {
        console.warn("ensureProfileOnAuth insert (retry):", r2.error.message || r2.error);
        return;
      }
    } else if (error.code !== "23505") {
      console.warn("ensureProfileOnAuth insert:", error.message || error);
      return;
    }
  }

  // user_pii: teléfono y dirección (si vienen)
  const phoneE164 = normalizePhoneToE164CL(meta.phone ?? "");
  const pii = { user_id: authUser.id };
  if (phoneE164) pii.phone = phoneE164;
  if (meta.address_line) pii.address_line = meta.address_line;      // <- dirección

  if (pii.phone || pii.address_line) {
    const { error: piiErr } = await supabase
      .schema("petcare")
      .from("user_pii")
      .upsert(pii, { onConflict: "user_id" });
    if (piiErr) console.warn("ensureProfileOnAuth upsert user_pii:", piiErr.message || piiErr);
  }
}

