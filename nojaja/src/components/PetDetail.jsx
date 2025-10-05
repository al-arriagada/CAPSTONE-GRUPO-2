// src/components/PetDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

export default function PetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pet, setPet] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("id");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // Catálogos dinámicos
  const [species, setSpecies] = useState([]);
  const [sexes, setSexes] = useState([]);
  const [origins, setOrigins] = useState([]);
  const [statuses, setStatuses] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    species_id: "",
    breed: "",
    sex_id: "",
    birth_date: "",
    image_url: "",
    microchip: "",
    neutered: false,
    origin_id: "",
    acquired_at: "",
    status_id: "",
    current_weight: "",
  });

  // ========================
  // Helpers nuevos (DUEÑO)
  // ========================
  async function fetchOwnerContact(userId) {
    // 1) app_user: nombre + email
    const { data: base, error: e1 } = await supabase
      .schema("petcare")
      .from("app_user")
      .select("user_id, email, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (e1) throw e1;

    // 2) user_pii: teléfono + dirección (puede no existir fila)
    const { data: pii, error: e2 } = await supabase
      .schema("petcare")
      .from("user_pii")
      .select("phone, address_line")
      .eq("user_id", userId)
      .maybeSingle();
    if (e2) throw e2;

    return {
      ...base,
      phone: pii?.phone ?? null,
      address_line: pii?.address_line ?? null,
    };
  }

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
    setError("");

    // PET
    const { data, error } = await supabase
      .schema("petcare")
      .from("pet")
      .select("*")
      .eq("pet_id", id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      setPet(data);
      setFormData({
        name: data.name || "",
        species_id: data.species_id || "",
        breed: data.breed || "",
        sex_id: data.sex_id || "",
        birth_date: data.birth_date || "",
        image_url: data.image_url || "",
        microchip: data.microchip || "",
        neutered: data.neutered || false,
        origin_id: data.origin_id || "",
        acquired_at: data.acquired_at || "",
        status_id: data.status_id || "",
        current_weight: data.current_weight?.toString() || "",
      });

      // OWNER (FIX: antes llamaba a petcare.user → 404)
      try {
        const o = await fetchOwnerContact(data.user_id);
        setOwner(o);
      } catch (e) {
        // Si no hay PII no es error fatal
        console.warn("No fue posible cargar owner/PII:", e?.message);
      }
    }
    setLoading(false);
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years === 0)
      return `${months} ${months === 1 ? "mes" : "meses"}`;
    return `${years} ${years === 1 ? "año" : "años"}${
      months > 0 ? ` y ${months} ${months === 1 ? "mes" : "meses"}` : ""
    }`;
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("El nombre es requerido");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const updateData = { name: formData.name.trim(), neutered: formData.neutered };

    if (formData.species_id) updateData.species_id = formData.species_id;
    if (formData.breed && formData.breed.trim()) updateData.breed = formData.breed.trim();
    if (formData.sex_id) updateData.sex_id = formData.sex_id;
    if (formData.birth_date) updateData.birth_date = formData.birth_date;
    if (formData.image_url && formData.image_url.trim()) updateData.image_url = formData.image_url.trim();
    if (formData.microchip && formData.microchip.trim()) updateData.microchip = formData.microchip.trim();
    if (formData.origin_id) updateData.origin_id = formData.origin_id;
    if (formData.acquired_at) updateData.acquired_at = formData.acquired_at;
    if (formData.status_id) updateData.status_id = formData.status_id;
    if (formData.current_weight && formData.current_weight !== "")
      updateData.current_weight = parseFloat(formData.current_weight);

    const { error: updateError } = await supabase
      .schema("petcare")
      .from("pet")
      .update(updateData)
      .eq("pet_id", id);

    setSaving(false);

    if (updateError) {
      setError(`Error: ${updateError.message}`);
      return;
    }

    setSuccess("Perfil actualizado exitosamente");
    await loadPet();

    setTimeout(() => {
      setIsEditing(false);
      setSuccess("");
    }, 1500);
  };

  const handleCancel = () => {
    if (pet) {
      setFormData({
        name: pet.name || "",
        species_id: pet.species_id || "",
        breed: pet.breed || "",
        sex_id: pet.sex_id || "",
        birth_date: pet.birth_date || "",
        image_url: pet.image_url || "",
        microchip: pet.microchip || "",
        neutered: pet.neutered || false,
        origin_id: pet.origin_id || "",
        acquired_at: pet.acquired_at || "",
        status_id: pet.status_id || "",
        current_weight: pet.current_weight?.toString() || "",
      });
    }
    setError("");
    setSuccess("");
    setIsEditing(false);
  };

  const handleArchive = async () => {
    setDeleting(true);
    const { error } = await supabase
      .schema("petcare")
      .from("pet")
      .update({ deleted_at: new Date().toISOString() })
      .eq("pet_id", id)
      .eq("user_id", user.id);
    setDeleting(false);
    setShowArchiveModal(false);

    if (error) {
      setError("No se pudo archivar la mascota.");
      return;
    }
    navigate("/app");
  };

  // Funciones helper
  const getSpeciesName = (id) =>
    species.find((sp) => sp.species_id === id)?.display_name || "—";
  const getSexName = (id) =>
    sexes.find((sx) => sx.sex_id === id)?.display_name || "—";
  const getOriginName = (id) =>
    origins.find((or) => or.origin_id === id)?.display_name || "—";
  const getStatusName = (id) =>
    statuses.find((st) => st.status_id === id)?.display_name || "—";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Mascota no encontrada</p>
          <Link to="/app" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = user && pet.user_id === user.id;
  const age = calculateAge(pet.birth_date);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
            >
              ← Volver al Dashboard
            </button>

            {canEdit && !isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 flex items-center gap-2"
                >
                  ✏️ Editar Perfil
                </button>
                <button
                  onClick={setShowArchiveModal}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            )}

            {isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "💾 Guardar"}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  ✖️ Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <h1 className="text-3xl font-bold">{pet.name}</h1>
            <p className="text-gray-500 text-sm mt-1">Perfil de mascota</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Mensajes */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Card principal */}
        <div className="bg-white rounded-2xl border shadow-sm p-8 mb-6">
          <div className="flex items-start gap-8">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100">
                <img
                  src={pet.image_url || "/placeholder-pet.jpg"}
                  alt={pet.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-4">{pet.name}</h2>
              <div className="flex gap-4 text-sm mb-4">
                {getSpeciesName(pet.species_id) !== "—" && (
                  <span className="px-3 py-1 bg-gray-100 rounded-full font-medium">
                    {getSpeciesName(pet.species_id)}
                  </span>
                )}
                {pet.breed && (
                  <span className="px-3 py-1 bg-gray-100 rounded-full font-medium">
                    {pet.breed}
                  </span>
                )}
              </div>

              {age && (
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <span>📅</span>
                  <span>{age}</span>
                </div>
              )}

              {pet.birth_date && (
                <p className="text-sm text-gray-500">
                  Fecha de nacimiento:{" "}
                  {new Date(pet.birth_date).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {!isEditing && (
          <>
            <div className="bg-white rounded-t-2xl border-t border-x shadow-sm">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab("id")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "id"
                      ? "border-b-2 border-black text-black"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  ID
                </button>
                <button
                  onClick={() => setActiveTab("perfil")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "perfil"
                      ? "border-b-2 border-black text-black"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Perfil
                </button>
                <button
                  onClick={() => setActiveTab("historial")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "historial"
                      ? "border-b-2 border-black text-black"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Historial médico
                </button>
                <button
                  onClick={() => setActiveTab("rutinas")}
                  className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === "rutinas"
                      ? "border-b-2 border-black text-black"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Rutinas y eventos
                </button>
              </div>
            </div>

            <div className="bg-white rounded-b-2xl border-x border-b shadow-sm p-8">
              {activeTab === "id" && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-2xl">🔲</span>
                    <h3 className="text-xl font-semibold">
                      Identificación QR de {pet.name}
                    </h3>
                  </div>

                  <p className="text-gray-600 mb-6">
                    Genera un código QR único para tu mascota. Al escanearlo,
                    mostrará información de contacto del dueño y datos básicos
                    de la mascota.
                  </p>

                  <button className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800">
                    🔲 Generar Código QR
                  </button>

                  {owner && (
                    <div className="mt-8 p-6 border rounded-2xl bg-gray-50">
                      <h4 className="font-semibold mb-4">
                        Información Visible al Escanear
                      </h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Al escanear el código QR, se mostrará la siguiente
                        información:
                      </p>

                      <div className="space-y-6">
                        <div>
                          <h5 className="font-medium mb-3">
                            💝 Información del Dueño:
                          </h5>
                          <div className="ml-6 space-y-2 text-sm">
                            <p>❤️ {owner.full_name || "Sin nombre"}</p>
                            {owner.phone && (
                              <p>
                                <span className="font-medium">Teléfono:</span>{" "}
                                {owner.phone}
                              </p>
                            )}
                            {owner.email && (
                              <p>
                                <span className="font-medium">Email:</span>{" "}
                                {owner.email}
                              </p>
                            )}
                            {owner.address_line && (
                              <p>
                                <span className="font-medium">Dirección:</span>{" "}
                                {owner.address_line}
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="font-medium mb-3">
                            Información de la Mascota:
                          </h5>
                          <div className="ml-6 space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                                <img
                                  src={pet.image_url || "/placeholder-pet.jpg"}
                                  alt={pet.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span>{pet.name}</span>
                            </div>
                            {getSpeciesName(pet.species_id) !== "—" && (
                              <p>
                                <span className="font-medium">Especie:</span>{" "}
                                {getSpeciesName(pet.species_id)}
                              </p>
                            )}
                            {pet.breed && (
                              <p>
                                <span className="font-medium">Raza:</span>{" "}
                                {pet.breed}
                              </p>
                            )}
                            {pet.microchip && (
                              <p>
                                <span className="font-medium">Microchip:</span>{" "}
                                {pet.microchip}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "perfil" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Información del Perfil
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <InfoItem
                      label="Especie"
                      value={getSpeciesName(pet.species_id)}
                    />
                    <InfoItem label="Raza" value={pet.breed || "—"} />
                    <InfoItem label="Sexo" value={getSexName(pet.sex_id)} />
                    <InfoItem
                      label="Microchip"
                      value={pet.microchip || "—"}
                    />
                    <InfoItem
                      label="Esterilizado/a"
                      value={pet.neutered ? "Sí" : "No"}
                    />
                    <InfoItem
                      label="Peso"
                      value={
                        pet.current_weight ? `${pet.current_weight} kg` : "—"
                      }
                    />
                    <InfoItem
                      label="Origen"
                      value={getOriginName(pet.origin_id)}
                    />
                    <InfoItem
                      label="Estado"
                      value={getStatusName(pet.status_id)}
                    />
                  </div>
                </div>
              )}

              {activeTab === "historial" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Historial Médico
                  </h3>
                  <p className="text-gray-500">
                    No hay registros médicos disponibles.
                  </p>
                </div>
              )}

              {activeTab === "rutinas" && (
                <div>
                  <h3 className="text-xl font-semibold mb-6">
                    Rutinas y Eventos
                  </h3>
                  <p className="text-gray-500">
                    No hay rutinas o eventos registrados.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Formulario de edición */}
        {isEditing && (
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h3 className="text-xl font-semibold mb-6">Editar Información</h3>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <EditField label="Nombre *">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField label="Especie">
                  <select
                    value={formData.species_id}
                    onChange={(e) =>
                      setFormData({ ...formData, species_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {species.map((s) => (
                      <option key={s.species_id} value={s.species_id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Raza">
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) =>
                      setFormData({ ...formData, breed: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField label="Sexo">
                  <select
                    value={formData.sex_id}
                    onChange={(e) =>
                      setFormData({ ...formData, sex_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {sexes.map((s) => (
                      <option key={s.sex_id} value={s.sex_id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Fecha de nacimiento">
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                    max={new Date().toISOString().split("T")[0]}
                  />
                </EditField>

                <EditField label="Microchip">
                  <input
                    type="text"
                    value={formData.microchip}
                    onChange={(e) =>
                      setFormData({ ...formData, microchip: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField label="Peso (kg)">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.current_weight}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_weight: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border rounded-xl"
                  />
                </EditField>

                <EditField label="Origen">
                  <select
                    value={formData.origin_id}
                    onChange={(e) =>
                      setFormData({ ...formData, origin_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {origins.map((o) => (
                      <option key={o.origin_id} value={o.origin_id}>
                        {o.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <EditField label="Estado">
                  <select
                    value={formData.status_id}
                    onChange={(e) =>
                      setFormData({ ...formData, status_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-xl bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {statuses.map((s) => (
                      <option key={s.status_id} value={s.status_id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </EditField>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.neutered}
                      onChange={(e) =>
                        setFormData({ ...formData, neutered: e.target.checked })
                      }
                      className="w-5 h-5"
                    />
                    <span className="text-sm font-medium">
                      Esterilizado/Castrado
                    </span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <EditField label="Subir otra imagen">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        // Guardar dentro de la carpeta user_id en el bucket pets
                        const fileName = `${user.id}/${file.name}`;

                        // Subir al bucket "pets"
                        const { error: uploadError } = await supabase.storage
                          .from("pets")
                          .upload(fileName, file, {
                            cacheControl: "3600",
                            upsert: true,
                          });

                        if (uploadError) {
                          console.error(
                            "Error subiendo imagen:",
                            uploadError.message
                          );
                          return;
                        }

                        // Obtener URL pública
                        const { data: publicData } = supabase.storage
                          .from("pets")
                          .getPublicUrl(fileName);

                        // Actualizar formData con la nueva URL
                        setFormData({
                          ...formData,
                          image_url: publicData.publicUrl,
                        });
                      }}
                      className="w-full px-4 py-2 border rounded-xl"
                    />
                  </EditField>
                </div>
              </div>
            </div>
          </div>
        )}
        <ConfirmDialog
          open={showArchiveModal}
          title={`Eliminar a ${pet.name}`}
          description="Esto eliminará la mascota de tus listas."
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
          danger
          requireText
          expectedText={pet.name}
          disabled={deleting}
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveModal(false)}
        />
      </div>
    </div>
    
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-gray-500 mb-1">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function EditField({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function ConfirmDialog({
  open,
  title = "Confirmar acción",
  description = "¿Estás segur@?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  requireText = false,
  expectedText = "",     // texto que el usuario debe escribir (ej: nombre de la mascota)
  disabled = false,      // opcional: deshabilitar todo si estás en loading
}) {
  const [typed, setTyped] = React.useState("");

  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const normalize = (s) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, ""); // quita tildes (á->a), requiere soporte Unicode

  const matchOK = !requireText || normalize(typed) === normalize(expectedText);
  const canConfirm = !disabled && matchOK;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{description}</p>

        {requireText && (
          <div className="mt-4">
            <label className="text-sm text-gray-700">
              Para continuar, escribe el nombre exacto:{" "}
              <span className="font-semibold">{expectedText}</span>
            </label>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) onConfirm();
              }}
              className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              placeholder={`Escribe: ${expectedText}`}
              disabled={disabled}
            />
            {typed && !matchOK && (
              <p className="text-xs text-red-600 mt-1">El texto no coincide.</p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={disabled}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-gray-800"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

