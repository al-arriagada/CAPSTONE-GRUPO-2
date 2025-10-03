import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { createPet, uploadPetPhoto } from "../services/pets";
import { upsertAppUserFromAuthUser } from "../services/profile";


export default function PetForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [species, setSpecies] = useState([]);
  const [sexes, setSexes] = useState([]);
  const [origins, setOrigins] = useState([]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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
    photo: null,
  });

  useEffect(() => {
    const load = async () => {
      const [sp, sx, or] = await Promise.all([
        supabase.schema("petcare").from("species_catalog").select("*"),
        supabase.schema("petcare").from("sex_catalog").select("*"),
        supabase.schema("petcare").from("pet_origin_catalog").select("*"),
      ]);
      if (sp.error || sx.error || or.error) {
        console.error(sp.error || sx.error || or.error);
        return;
      }
      setSpecies(sp.data); setSexes(sx.data); setOrigins(or.data);
    };
    load();
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (files) setForm(f => ({ ...f, [name]: files[0] }));
    else if (type === "checkbox") setForm(f => ({ ...f, [name]: checked }));
    else setForm(f => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setErr("");

    try {
      // Garantiza perfil (por RLS de pet)
      await upsertAppUserFromAuthUser(user);

      // Sube foto si hay
      let image_url = null;
      if (form.photo) image_url = await uploadPetPhoto(user.id, form.photo);

      // Inserta mascota
      await createPet(user.id, {
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
      });

      navigate("/app", { replace: true });
    } catch (e2) {
      console.error(e2);
      setErr(e2.message || "No se pudo registrar la mascota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4 rounded-2xl border bg-white p-6">
      <h2 className="text-xl font-semibold">Registrar Mascota</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre" required>
          <input name="name" required value={form.name} onChange={onChange}
                 className="w-full rounded-xl border px-3 py-2" />
        </Field>

        <Field label="Especie">
          <select name="species_id" value={form.species_id} onChange={onChange}
                  className="w-full rounded-xl border px-3 py-2">
            {species.map(s => <option key={s.species_id} value={s.species_id}>{s.display_name}</option>)}
          </select>
        </Field>

        <Field label="Raza">
          <input name="breed" value={form.breed} onChange={onChange}
                 className="w-full rounded-xl border px-3 py-2" />
        </Field>

        <Field label="Sexo">
          <select name="sex_id" value={form.sex_id} onChange={onChange}
                  className="w-full rounded-xl border px-3 py-2">
            {sexes.map(x => <option key={x.sex_id} value={x.sex_id}>{x.display_name}</option>)}
          </select>
        </Field>

        <Field label="Fecha de nacimiento">
          <input type="date" name="birth_date" value={form.birth_date} onChange={onChange}
                 className="w-full rounded-xl border px-3 py-2" />
        </Field>

        <Field label="Microchip">
          <input name="microchip" value={form.microchip} onChange={onChange}
                 className="w-full rounded-xl border px-3 py-2" />
        </Field>

        <Field label="Esterilizado/a">
          <input type="checkbox" name="neutered" checked={form.neutered} onChange={onChange} />
        </Field>

        <Field label="Origen">
          <select name="origin_id" value={form.origin_id} onChange={onChange}
                  className="w-full rounded-xl border px-3 py-2">
            {origins.map(o => <option key={o.origin_id} value={o.origin_id}>{o.display_name}</option>)}
          </select>
        </Field>

        <Field label="Fecha de adquisición">
          <input type="date" name="acquired_at" value={form.acquired_at} onChange={onChange}
                 className="w-full rounded-xl border px-3 py-2" />
        </Field>

        <Field label="Foto">
          <input type="file" name="photo" accept="image/*" onChange={onChange}
                 className="w-full rounded-xl border px-3 py-2 file:mr-3 file:rounded-md file:border file:bg-gray-50 file:px-3 file:py-1.5" />
        </Field>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => history.back()}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">Cancelar</button>
        <button disabled={saving}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50">
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
