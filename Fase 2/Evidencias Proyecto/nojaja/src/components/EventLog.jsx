import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function EventLog({ petId }) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    user_id: "",
    pet_id: "",
    e_type_id: "",
    period_yyyymm: "",
    comuna_id: "",
    weight_kg: "",
    duration_min: "",
    distance_m: "",
    dose_mg: "",
    vaccine_batch: "",
    vaccine_dose_number: "",
    vaccine_expiration_date: "",
    details: "",
    vet_clinic_name: "",
    vet_clinic_address: "",
    vet_clinic_phone: "",
  });

  useEffect(() => {
    loadEventTypes();
    if (petId) {
      loadEvents();
    } else {
      setEvents([]);
      setLoading(false);
    }
  }, [petId]);

  const loadEventTypes = async () => {
    const { data, error } = await supabase
      .schema("petcare")
      .from("event_type_catalog")
      .select("event_type_id, display_name")
      .order("display_name");

    if (error) {
      console.error("Error cargando tipos de evento:", error);
    } else {
      setEventTypes(data || []);
      if (data && data.length > 0) {
        setFormData((prev) => ({ ...prev, e_type_id: data[0].event_type_id }));
      }
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema("petcare")
      .from("event")
      .select(
        `
        *,
        event_type_catalog!inner (
          event_type_id,
          display_name
        )
      `
      )
      .eq("pet_id", petId)
      .order("ts", { ascending: false });

    if (error) {
      console.error("Error cargando eventos:", error);
      setError(error.message);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const getEventIcon = (eventTypeId) => {
    const icons = {
      vaccine_administered: "💉",
      medication_dose: "💊",
      routine_check: "👨‍⚕️",
      weight_logged: "⚖️",
      walk: "🚶",
      heat_cycle: "🌸",
      incident_reported: "⚠️",
      document_uploaded: "📄",
      other: "📋",
    };
    return icons[eventTypeId] || "📋";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.e_type_id) {
      setError("Selecciona un tipo de evento");
      return;
    }

    if (!petId) {
      setError("No se puede registrar un evento: mascota no definida");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const eventData = {
        pet_id: petId, // ✅ usamos el prop correctamente
        user_id: user.id,
        e_type_id: formData.e_type_id,
        ts: new Date().toISOString(),
        details: {},
      };

      if (formData.period_yyyymm)
        eventData.period_yyyymm = parseInt(formData.period_yyyymm);
      if (formData.comuna_id)
        eventData.comuna_id = parseInt(formData.comuna_id);
      if (formData.weight_kg)
        eventData.weight_kg = parseFloat(formData.weight_kg);
      if (formData.duration_min)
        eventData.duration_min = parseInt(formData.duration_min);
      if (formData.distance_m)
        eventData.distance_m = parseInt(formData.distance_m);
      if (formData.dose_mg) eventData.dose_mg = parseFloat(formData.dose_mg);
      if (formData.vaccine_batch)
        eventData.vaccine_batch = formData.vaccine_batch;
      if (formData.vaccine_dose_number)
        eventData.vaccine_dose_number = parseInt(formData.vaccine_dose_number);
      if (formData.vaccine_expiration_date)
        eventData.vaccine_expiration_date = formData.vaccine_expiration_date;

      if (
        formData.vet_clinic_name ||
        formData.vet_clinic_address ||
        formData.vet_clinic_phone
      ) {
        eventData.details = {
          vet_clinic: {
            name: formData.vet_clinic_name || null,
            address: formData.vet_clinic_address || null,
            phone: formData.vet_clinic_phone || null,
          },
          description: formData.details || null,
        };
      } else if (formData.details) {
        eventData.details = { description: formData.details };
      }

      const { error: insertError } = await supabase
        .schema("petcare")
        .from("event")
        .insert(eventData);

      if (insertError) throw insertError;

      setFormData({
        e_type_id: eventTypes[0]?.event_type_id || "",
        period_yyyymm: "",
        comuna_id: "",
        weight_kg: "",
        duration_min: "",
        distance_m: "",
        dose_mg: "",
        vaccine_batch: "",
        vaccine_dose_number: "",
        vaccine_expiration_date: "",
        details: "",
        vet_clinic_name: "",
        vet_clinic_address: "",
        vet_clinic_phone: "",
      });
      setShowForm(false);
      loadEvents();
    } catch (err) {
      console.error("Error guardando evento:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm("¿Eliminar este registro?")) return;

    const { error } = await supabase
      .schema("petcare")
      .from("event")
      .delete()
      .eq("event_id", eventId);

    if (error) {
      alert("Error al eliminar");
      return;
    }

    loadEvents();
  };

  const renderEventFields = () => {
    const selectedType = eventTypes.find(
      (t) => t.event_type_id === formData.e_type_id
    );
    if (!selectedType) return null;

    const typeId = selectedType.event_type_id;

    return (
      <>
        {["vaccine_administered", "medication_dose", "routine_check"].includes(
          typeId
        ) && (
          <>
            <div className="md:col-span-2">
              <h4 className="font-medium mb-3">
                Datos de la Clínica Veterinaria (Opcional)
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de la clínica
              </label>
              <input
                type="text"
                value={formData.vet_clinic_name}
                onChange={(e) =>
                  setFormData({ ...formData, vet_clinic_name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: Clínica Veterinaria Los Andes"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.vet_clinic_phone}
                onChange={(e) =>
                  setFormData({ ...formData, vet_clinic_phone: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: +56 9 1234 5678"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Dirección</label>
              <input
                type="text"
                value={formData.vet_clinic_address}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vet_clinic_address: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: Av. Libertador 123, Providencia"
              />
            </div>
          </>
        )}

        {typeId === "vaccine_administered" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Lote de vacuna</label>
              <input
                type="text"
                value={formData.vaccine_batch}
                onChange={(e) =>
                  setFormData({ ...formData, vaccine_batch: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: LOT123456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Número de dosis
              </label>
              <input
                type="number"
                min="1"
                value={formData.vaccine_dose_number}
                onChange={(e) =>
                  setFormData({ ...formData, vaccine_dose_number: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: 1, 2, 3..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fecha de expiración</label>
              <input
                type="date"
                value={formData.vaccine_expiration_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vaccine_expiration_date: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </>
        )}

        {typeId === "medication_dose" && (
          <div>
            <label className="block text-sm font-medium mb-2">Dosis (mg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.dose_mg}
              onChange={(e) =>
                setFormData({ ...formData, dose_mg: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ej: 50"
            />
          </div>
        )}

        {typeId === "weight_logged" && (
          <div>
            <label className="block text-sm font-medium mb-2">Peso (kg) *</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="500"
              value={formData.weight_kg}
              onChange={(e) =>
                setFormData({ ...formData, weight_kg: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ej: 25.5"
              required
            />
          </div>
        )}

        {typeId === "walk" && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Duración (minutos)</label>
              <input
                type="number"
                min="1"
                value={formData.duration_min}
                onChange={(e) =>
                  setFormData({ ...formData, duration_min: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: 30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Distancia (metros)</label>
              <input
                type="number"
                min="1"
                value={formData.distance_m}
                onChange={(e) =>
                  setFormData({ ...formData, distance_m: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Ej: 2000"
              />
            </div>
          </>
        )}

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Detalles / Descripción</label>
          <textarea
            value={formData.details}
            onChange={(e) =>
              setFormData({ ...formData, details: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
            rows="3"
            placeholder="Agrega detalles adicionales sobre este evento..."
          />
        </div>
      </>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Cargando historial...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Historial de Eventos</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "+ Agregar Evento"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-6 border rounded-2xl bg-gray-50"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Tipo de Evento *</label>
              <select
                value={formData.e_type_id}
                onChange={(e) =>
                  setFormData({ ...formData, e_type_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white"
                required
              >
                <option value="">Seleccionar...</option>
                {eventTypes.map((type) => (
                  <option key={type.event_type_id} value={type.event_type_id}>
                    {type.display_name}
                  </option>
                ))}
              </select>
            </div>

            {renderEventFields()}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Evento"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {events.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No hay eventos registrados aún</p>
        ) : (
          events.map((event) => (
            <div
              key={event.event_id}
              className="border rounded-2xl p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getEventIcon(event.e_type_id)}</span>
                    <div>
                      <h4 className="font-semibold">{event.event_type_catalog?.display_name}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(event.ts).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {event.weight_kg && <p className="text-gray-700">⚖️ Peso: {event.weight_kg} kg</p>}
                    {event.dose_mg && <p className="text-gray-700">💊 Dosis: {event.dose_mg} mg</p>}
                    {event.vaccine_batch && <p className="text-gray-700">🏷️ Lote: {event.vaccine_batch}</p>}
                    {event.vaccine_dose_number && <p className="text-gray-700">💉 Dosis #{event.vaccine_dose_number}</p>}
                    {event.duration_min && <p className="text-gray-700">⏱️ Duración: {event.duration_min} min</p>}
                    {event.distance_m && <p className="text-gray-700">📏 Distancia: {event.distance_m} m</p>}

                    {event.details && typeof event.details === "object" && (
                      <>
                        {event.details.description && <p className="text-gray-700">{event.details.description}</p>}
                        {event.details.vet_clinic && (
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                            {event.details.vet_clinic.name && <p className="font-medium">🏥 {event.details.vet_clinic.name}</p>}
                            {event.details.vet_clinic.phone && <p>📞 {event.details.vet_clinic.phone}</p>}
                            {event.details.vet_clinic.address && <p>📍 {event.details.vet_clinic.address}</p>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(event.event_id)}
                  className="ml-4 text-red-600 hover:text-red-800 text-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
