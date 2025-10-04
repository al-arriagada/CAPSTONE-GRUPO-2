import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

export default function PetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Catálogos dinámicos
  const [species, setSpecies] = useState([]);
  const [sexes, setSexes] = useState([]);
  const [origins, setOrigins] = useState([]);
  const [statuses, setStatuses] = useState([]);

  const [formData, setFormData] = useState({
    name: '', species_id: '', breed: '', sex_id: '', birth_date: '',
    image_url: '', microchip: '', neutered: false, origin_id: '',
    acquired_at: '', status_id: '', current_weight: ''
  });

  // Cargar catálogos al iniciar
  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    const [sp, sx, or, st] = await Promise.all([
      supabase.schema("petcare").from("species_catalog").select("*"),
      supabase.schema("petcare").from("sex_catalog").select("*"),
      supabase.schema("petcare").from("pet_origin_catalog").select("*"),
      supabase.schema("petcare").from("pet_status_catalog").select("*"),
    ]);

    if (sp.data) setSpecies(sp.data);
    if (sx.data) setSexes(sx.data);
    if (or.data) setOrigins(or.data);
    if (st.data) setStatuses(st.data);
  };

  useEffect(() => {
    loadPet();
  }, [id]);

  const loadPet = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema("petcare")
      .from("pet")
      .select("*")
      .eq("pet_id", id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    if (data) {
      setPet(data);
      setFormData({
        name: data.name || '',
        species_id: data.species_id || '',
        breed: data.breed || '',
        sex_id: data.sex_id || '',
        birth_date: data.birth_date || '',
        image_url: data.image_url || '',
        microchip: data.microchip || '',
        neutered: data.neutered || false,
        origin_id: data.origin_id || '',
        acquired_at: data.acquired_at || '',
        status_id: data.status_id || '',
        weight_kg: data.current_weight?.toString() || ''
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const updateData = {
      name: formData.name.trim(),
      neutered: formData.neutered
    };

    if (formData.species_id) updateData.species_id = formData.species_id;
    if (formData.breed && formData.breed.trim()) updateData.breed = formData.breed.trim();
    if (formData.sex_id) updateData.sex_id = formData.sex_id;
    if (formData.birth_date) updateData.birth_date = formData.birth_date;
    if (formData.image_url && formData.image_url.trim()) updateData.image_url = formData.image_url.trim();
    if (formData.microchip && formData.microchip.trim()) updateData.microchip = formData.microchip.trim();
    if (formData.origin_id) updateData.origin_id = formData.origin_id;
    if (formData.acquired_at) updateData.acquired_at = formData.acquired_at;
    if (formData.status_id) updateData.status_id = formData.status_id;
    if (formData.current_weight && formData.current_weight !== '') updateData.current_weight = parseFloat(formData.current_weight);

    const { error: updateError } = await supabase
      .schema("petcare")
      .from("pet")
      .update(updateData)
      .eq("pet_id", id);

    setSaving(false);

    if (updateError) {
      console.error('Error completo:', updateError);
      setError(`Error: ${updateError.message}`);
      return;
    }

    setSuccess('Perfil actualizado exitosamente');
    await loadPet();
    
    setTimeout(() => {
      setIsEditing(false);
      setSuccess('');
    }, 1500);
  };

  const handleCancel = () => {
    if (pet) {
      setFormData({
        name: pet.name || '',
        species_id: pet.species_id || '',
        breed: pet.breed || '',
        sex_id: pet.sex_id || '',
        birth_date: pet.birth_date || '',
        image_url: pet.image_url || '',
        microchip: pet.microchip || '',
        neutered: pet.neutered || false,
        origin_id: pet.origin_id || '',
        acquired_at: pet.acquired_at || '',
        status_id: pet.status_id || '',
        weight_kg: pet.current_weight?.toString() || ''
      });
    }
    setError('');
    setSuccess('');
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta mascota? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    const { error } = await supabase
      .schema("petcare")
      .from("pet")
      .delete()
      .eq("pet_id", id);
    setDeleting(false);
    if (error) {
      alert("No se pudo eliminar.");
      return;
    }
    navigate("/app");
  };

  // Funciones helper para mostrar nombres
  const getSpeciesName = (id) => {
    const s = species.find(sp => sp.species_id === id);
    return s ? s.display_name : "—";
  };

  const getSexName = (id) => {
    const s = sexes.find(sx => sx.sex_id === id);
    return s ? s.display_name : "—";
  };

  const getOriginName = (id) => {
    const o = origins.find(or => or.origin_id === id);
    return o ? o.display_name : "—";
  };

  const getStatusName = (id) => {
    const s = statuses.find(st => st.status_id === id);
    return s ? s.display_name : "—";
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-gray-600">Mascota no encontrada.</p>
        <Link className="text-black underline" to="/app">Volver</Link>
      </div>
    );
  }

  const canEdit = user && pet.user_id === user.id;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center mb-4">
        <h1 className="text-2xl font-semibold">{pet.name}</h1>
        <div className="flex gap-2">
          {canEdit && !isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-black px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </>
          )}
          
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={handleCancel}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
            </>
          )}
          
          <Link to="/app" className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-600 text-sm">{success}</p>
        </div>
      )}

      {/* Imagen */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-gray-100">
        <img
          src={(isEditing ? formData.image_url : pet.image_url) || "/placeholder-pet.jpg"}
          alt={pet.name}
          className="h-[320px] w-full object-cover"
        />
      </div>

      {isEditing && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL de imagen
          </label>
          <input
            type="url"
            value={formData.image_url}
            onChange={(e) => setFormData({...formData, image_url: e.target.value})}
            className="w-full px-3 py-2 border rounded-xl"
            placeholder="https://..."
          />
        </div>
      )}

      {/* Info */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Info label="Nombre">
          {isEditing ? (
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1"
            />
          ) : (
            pet.name
          )}
        </Info>

        <Info label="Especie">
          {isEditing ? (
            <select
              value={formData.species_id}
              onChange={(e) => setFormData({...formData, species_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1 bg-white"
            >
              <option value="">Seleccionar...</option>
              {species.map((s) => (
                <option key={s.species_id} value={s.species_id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          ) : (
            getSpeciesName(pet.species_id)
          )}
        </Info>

        <Info label="Sexo">
          {isEditing ? (
            <select
              value={formData.sex_id}
              onChange={(e) => setFormData({...formData, sex_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1 bg-white"
            >
              <option value="">Seleccionar...</option>
              {sexes.map((s) => (
                <option key={s.sex_id} value={s.sex_id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          ) : (
            getSexName(pet.sex_id)
          )}
        </Info>

        <Info label="Raza">
          {isEditing ? (
            <input
              type="text"
              value={formData.breed}
              onChange={(e) => setFormData({...formData, breed: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1"
            />
          ) : (
            pet.breed || "—"
          )}
        </Info>

        <Info label="Origen">
          {isEditing ? (
            <select
              value={formData.origin_id}
              onChange={(e) => setFormData({...formData, origin_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1 bg-white"
            >
              <option value="">Seleccionar...</option>
              {origins.map((o) => (
                <option key={o.origin_id} value={o.origin_id}>
                  {o.display_name}
                </option>
              ))}
            </select>
          ) : (
            getOriginName(pet.origin_id)
          )}
        </Info>

        <Info label="Microchip">
          {isEditing ? (
            <input
              type="text"
              value={formData.microchip}
              onChange={(e) => setFormData({...formData, microchip: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1"
            />
          ) : (
            pet.microchip || "—"
          )}
        </Info>

        <Info label="Esterilizado/a">
          {isEditing ? (
            <label className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                checked={formData.neutered}
                onChange={(e) => setFormData({...formData, neutered: e.target.checked})}
                className="w-4 h-4"
              />
              <span className="text-sm">Sí</span>
            </label>
          ) : (
            pet.neutered ? "Sí" : "No"
          )}
        </Info>

        <Info label="Nacimiento">
          {isEditing ? (
            <input
              type="date"
              value={formData.birth_date}
              onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1"
              max={new Date().toISOString().split('T')[0]}
            />
          ) : (
            pet.birth_date ? new Date(pet.birth_date).toLocaleDateString() : "—"
          )}
        </Info>

        <Info label="Estado">
          {isEditing ? (
            <select
              value={formData.status_id}
              onChange={(e) => setFormData({...formData, status_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1 bg-white"
            >
              <option value="">Seleccionar...</option>
              {statuses.map((s) => (
                <option key={s.status_id} value={s.status_id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          ) : (
            getStatusName(pet.status_id)
          )}
        </Info>

        <Info label="Peso (kg)">
          {isEditing ? (
            <input
              type="number"
              step="0.1"
              value={formData.current_weight}
              onChange={(e) => setFormData({...formData, current_weight: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg mt-1"
            />
          ) : (
            pet.current_weight ? `${pet.current_weight} kg` : "—"
          )}
        </Info>
      </div>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}