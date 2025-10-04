// src/components/PetForm.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { createPet, uploadPetPhoto } from "../services/pets";
import { upsertAppUserFromAuthUser } from "../services/profile";

export default function PetForm({ mode = "create" }) {
  const isEdit = mode === "edit";
  const { id } = useParams();            // pet_id cuando edit
  const { user } = useAuth();
  const navigate = useNavigate();

  // catálogos
  const [species, setSpecies] = useState([]);
  const [sexes, setSexes] = useState([]);
  const [origins, setOrigins] = useState([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // foto actual (para previsualizar en edit si existe)
  const [currentImageUrl, setCurrentImageUrl] = useState(null);

  const [form, setForm] = useState({
    name: "",
    species_id: "dog",
    breed: "",
    sex_id: "unknown",
    birth_date: "",
    microchip: "",
    neutered: false,
    origin_id: "unknown",
    acquired_at: "",
    photo: null,        // File
  });

  // Util: formatear fechas a YYYY-MM-DD (para inputs date)
  const toDateInput = (d) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (Number.isNaN(+dt)) return "";
      return dt.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  // Cargar catálogos
  useEffect(() => {
    const loadCatalogs = async () => {
      const [sp, sx, or] = await Promise.all([
        supabase.schema("petcare").from("species_catalog").select("*"),
        supabase.schema("petcare").from("sex_catalog").select("*"),
        supabase.schema("petcare").from("pet_origin_catalog").select("*"),
      ]);
      if (sp.error || sx.error || or.error) {
        console.error(sp.error || sx.error || or.error);
        return;
      }
      setSpecies(sp.data || []);
      setSexes(sx.data || []);
      setOrigins(or.data || []);
    };
    loadCatalogs();
  }, []);

  // Si es edición, cargar la mascota
  useEffect(() => {
    if (!isEdit || !id) return;
    let abort = false;

    async function loadPet() {
      const { data, error } = await supabase
        .schema("petcare")
        .from("pet")
        .select("*")
        .eq("pet_id", id)
        .maybeSingle();

      if (abort) return;

      if (error) {
        console.error(error);
        setErr("No se pudo cargar la mascota.");
        return;
      }
      if (!data) {
        setErr("Mascota no encontrada.");
        return;
      }

      setCurrentImageUrl(data.image_url || null);

      setForm({
        name: data.name || "",
        species_id: data.species_id || "dog",
        breed: data.breed || "",
        sex_id: data.sex_id || "unknown",
        birth_date: toDateInput(data.birth_date),
        microchip: data.microchip || "",
        neutered: !!data.neutered,
        origin_id: data.origin_id || "unknown",
        acquired_at: toDateInput(data.acquired_at),
        photo: null, // solo se usa cuando subes una nueva
      });
    }

    loadPet();
    return () => { abort = true; };
  }, [isEdit, id]);

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (files) setForm((f) => ({ ...f, [name]: files[0] }));
    else if (type === "checkbox") setForm((f) => ({ ...f, [name]: checked }));
    else setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setErr("");

    try {
      // Garantiza perfil (útil por RLS)
      await upsertAppUserFromAuthUser(user);

      // Sube foto si hay archivo nuevo
      let image_url = currentImageUrl || null;
      if (form.photo) {
        image_url = await uploadPetPhoto(user.id, form.photo);
      }

      // payload común
      const values = {
        name: form.name.trim(),
        species_id: form.species_id,
        breed: form.breed || null,
        sex_id: form.sex_id,
        birth_date: form.birth_date || null,
        microchip: form.microchip || null,
        neutered: !!form.neutered,
        origin_id: form.origin_id,
        acquired_at: form.acquired_at || null,
        image_url,
      };

      if (isEdit) {
        // UPDATE
        const { error } = await supabase
          .schema("petcare")
          .from("pet")
          .update(values)
          .eq("pet_id", id);
        if (error) throw error;

        navigate(`/app/pets/${id}`, { replace: true });
      } else {
        // CREATE (incluye user_id)
        const { pet_id: newId } = await createPet(user.id, values);
        // si tu createPet no retorna el id, puedes hacer un select("*") .single()
        navigate(`/app/pets/${newId}`, { replace: true });
      }
    } catch (e2) {
      console.error(e2);
      setErr(e2.message || "No se pudo guardar la mascota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-2xl space-y-4 rounded-2xl border bg-white p-6"
    >
      <h2 className="text-xl font-semibold">
        {isEdit ? "Editar Mascota" : "Registrar Mascota"}
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" required>
          <input
            name="name"
            required
            value={form.name}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          />
        </Field>

        <Field label="Especie">
          <select
            name="species_id"
            value={form.species_id}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          >
            {species.map((s) => (
              <option key={s.species_id} value={s.species_id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Raza">
          <input
            name="breed"
            value={form.breed}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          />
        </Field>

        <Field label="Sexo">
          <select
            name="sex_id"
            value={form.sex_id}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          >
            {sexes.map((x) => (
              <option key={x.sex_id} value={x.sex_id}>
                {x.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha de nacimiento">
          <input
            type="date"
            name="birth_date"
            value={form.birth_date}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          />
        </Field>

        <Field label="Microchip">
          <input
            name="microchip"
            value={form.microchip}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          />
        </Field>

        <Field label="Esterilizado/a">
          <input
            type="checkbox"
            name="neutered"
            checked={form.neutered}
            onChange={onChange}
          />
        </Field>

        <Field label="Origen">
          <select
            name="origin_id"
            value={form.origin_id}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          >
            {origins.map((o) => (
              <option key={o.origin_id} value={o.origin_id}>
                {o.display_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha de adquisición">
          <input
            type="date"
            name="acquired_at"
            value={form.acquired_at}
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2"
          />
        </Field>

        <Field label="Foto">
          <input
            type="file"
            name="photo"
            accept="image/*"
            onChange={onChange}
            className="w-full rounded-xl border px-3 py-2 file:mr-3 file:rounded-md file:border file:bg-gray-50 file:px-3 file:py-1.5"
          />
          {isEdit && currentImageUrl && (
            <div className="mt-2 text-xs text-gray-500">
              Se conservará la foto actual si no adjuntas una nueva.
            </div>
          )}
        </Field>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          disabled={saving}
          className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="space-y-1">
      <span className="block text-sm text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
