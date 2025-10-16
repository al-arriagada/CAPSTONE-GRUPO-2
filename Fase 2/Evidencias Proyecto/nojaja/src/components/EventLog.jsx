import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";

/**
 * EventLog.jsx (reworked)
 *
 * Cumple con los flujos solicitados por tipo de evento usando el esquema petcare v3.
 * Tablas usadas: app_user, pet, event, event_type_catalog, vaccine, vaccine_event,
 * clinic, vet, comuna y region.
 *
 * Notas de modelo importantes:
 * - event.e_description: <= 250 chars (CHECK en BD)
 * - event.var_weight: { value: number, date: YYYY-MM-DD }
 * - vaccine_event: guarda next_due_date, vaccine_batch, vaccine_dose_number,
 *   vaccine_expiration_date y FK vaccine_id/event_id.
 * - event.clinic_id y event.vet_id se asignan según flujo.
 * - "¿A domicilio?": Si = ocultar clínica y mostrar veterinarios por comuna via app_user.comuna_id.
 */

export default function EventLog({ petId: propPetId }) {
  const { id } = useParams();
  const petId = propPetId || id;
  const { user } = useAuth();

  // Listado e historial
  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);

  // Catálogos/maestros
  const [regions, setRegions] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [vetsByClinic, setVetsByClinic] = useState([]);
  const [vetsByComuna, setVetsByComuna] = useState([]);
  const [vaccines, setVaccines] = useState([]);

  // Datos auxiliares
  const [petSpeciesId, setPetSpeciesId] = useState(null);

  // UI/estado
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    e_type_id: "",
    domicilio: "no", // "si" | "no"
    region_id: "",
    comuna_id: "",
    clinic_id: "",
    vet_id: "",
    // "Descripción" (event.e_description)
    e_description: "",

    // Peso (solo weight_logged)
    weight_value: "", // number as string

    // Walk
    duration_min: "",
    distance_m: "",

    // Vaccine
    vaccine_id: "",
    next_due_date: "",
    vaccine_batch: "",
    vaccine_dose_number: "",
    vaccine_expiration_date: "",

    // Autorelleno de clínica en details (no editables)
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
  });

  /** Helpers */
  const todayISO = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

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

  /** Cargas iniciales */
  const loadEventTypes = async () => {
    const { data, error } = await supabase
      .schema("petcare")
      .from("event_type_catalog")
      .select("event_type_id, display_name")
      .order("display_name");
    if (!error) setEventTypes(data || []);
  };

  const loadRegions = async () => {
    const { data, error } = await supabase
      .schema("petcare")
      .from("region")
      .select("region_id, name")
      .order("name");
    if (!error) setRegions(data || []);
  };

  const loadPet = async () => {
    if (!petId) return;
    const { data, error } = await supabase
      .schema("petcare")
      .from("pet")
      .select("species_id")
      .eq("pet_id", petId)
      .maybeSingle();
    if (!error && data) setPetSpeciesId(data.species_id);
  };

  const loadVaccinesBySpecies = async (speciesId) => {
    if (!speciesId) {
      setVaccines([]);
      return;
    }
    const { data, error } = await supabase
      .schema("petcare")
      .from("vaccine")
      .select("vaccine_id, name")
      .eq("species_id", speciesId)
      .order("name");
    if (!error) setVaccines(data || []);
  };

  /** Historial */
  const loadEvents = useCallback(async () => {
    if (!petId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .schema("petcare")
      .from("event")
      .select(
        `*, event_type_catalog!inner(event_type_id, display_name), clinic:clinic_id(name,address,phone), vet:vet_id(full_name)`
      )
      .eq("pet_id", petId)
      .order("ts", { ascending: false });
    if (!error) setEvents(data || []);
    setLoading(false);
  }, [petId]);

  useEffect(() => {
    loadEventTypes();
    loadRegions();
    loadPet();
  }, [petId]);

  useEffect(() => {
    if (petSpeciesId) loadVaccinesBySpecies(petSpeciesId);
  }, [petSpeciesId]);

  useEffect(() => {
    // Cargar historial al entrar
    loadEvents();
  }, [loadEvents]);

  /** Cascadas Region -> Comuna */
  useEffect(() => {
    // Limpiar selecciones dependientes
    setFormData((p) => ({
      ...p,
      comuna_id: "",
      clinic_id: "",
      vet_id: "",
      clinic_name: "",
      clinic_address: "",
      clinic_phone: "",
    }));

    if (!formData.region_id) {
      setComunas([]);
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .schema("petcare")
        .from("comuna")
        .select("comuna_id, name")
        .eq("region_id", formData.region_id)
        .order("name");
      if (!error) setComunas(data || []);
    })();
  }, [formData.region_id]);

  /** Comuna -> Clínicas y Vets (a domicilio) */
  useEffect(() => {
    setFormData((p) => ({ ...p, clinic_id: "", vet_id: "", clinic_name: "", clinic_address: "", clinic_phone: "" }));
    setClinics([]);
    setVetsByClinic([]);
    setVetsByComuna([]);

    if (!formData.comuna_id) return;

    (async () => {
      // Clínicas por comuna
      const { data: cData } = await supabase
        .schema("petcare")
        .from("clinic")
        .select("clinic_id, name, address, phone")
        .eq("comuna_id", formData.comuna_id)
        .order("name");
      setClinics(cData || []);

      // Vets por comuna (vía app_user)
      // 1) obtener usuarios en la comuna
      const { data: usersData } = await supabase
        .schema("petcare")
        .from("app_user")
        .select("user_id")
        .eq("comuna_id", formData.comuna_id);

      const userIds = (usersData || []).map((u) => u.user_id);
      if (userIds.length === 0) {
        setVetsByComuna([]);
        return;
      }
      // 2) obtener vets cuyo user_id esté en esos usuarios
      const { data: vetsData } = await supabase
        .schema("petcare")
        .from("vet")
        .select("vet_id, full_name, clinic_id, user_id")
        .in("user_id", userIds)
        .order("full_name");
      setVetsByComuna(vetsData || []);
    })();
  }, [formData.comuna_id]);

  /** Clínica -> Veterinarios */
  useEffect(() => {
    setVetsByClinic([]);

    if (!formData.clinic_id) {
      // limpiar autorelleno
      setFormData((p) => ({ ...p, clinic_name: "", clinic_address: "", clinic_phone: "" }));
      return;
    }

    (async () => {
      // Autorelleno de datos de clínica seleccionada
      const clinic = clinics.find((c) => c.clinic_id === formData.clinic_id);
      setFormData((p) => ({
        ...p,
        clinic_name: clinic?.name || "",
        clinic_address: clinic?.address || "",
        clinic_phone: clinic?.phone || "",
      }));

      // Vets por clínica
      const { data, error } = await supabase
        .schema("petcare")
        .from("vet")
        .select("vet_id, full_name")
        .eq("clinic_id", formData.clinic_id)
        .order("full_name");
      if (!error) setVetsByClinic(data || []);
    })();
  }, [formData.clinic_id, clinics]);

  /** Guardado */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.e_type_id) return setError("Selecciona un tipo de evento");

    // Validaciones por tipo
    const typeId = formData.e_type_id;
    const domicilio = formData.domicilio === "si";

    try {
      setSaving(true);

      // Construcción objeto base de event
      const eventData = {
        pet_id: petId,
        user_id: user?.id || null,
        e_type_id: typeId,
        ts: new Date().toISOString(),
      };

      // Descripción (opcional, <= 250)
      if (formData.e_description?.trim()) {
        eventData.e_description = formData.e_description.trim();
      }

      // Pesos / Walk / Dosis / Ubicación
      if (["vaccine_administered", "medication_dose", "routine_check"].includes(typeId)) {
        // Región no se guarda; Comuna sí
        if (formData.comuna_id) eventData.comuna_id = parseInt(formData.comuna_id);

        if (!domicilio) {
          if (formData.clinic_id) eventData.clinic_id = formData.clinic_id;
          if (formData.vet_id) eventData.vet_id = formData.vet_id;

          // details con datos de clínica
          if (formData.clinic_name || formData.clinic_phone || formData.clinic_address) {
            eventData.details = {
              name: formData.clinic_name || null,
              phone: formData.clinic_phone || null,
              address: formData.clinic_address || null,
            };
          }
        } else {
          // A domicilio: sin clínica, con vet_id por comuna si se eligió
          if (formData.vet_id) eventData.vet_id = formData.vet_id;
        }
      }

      if (typeId === "medication_dose") {
        if (formData.dose_mg) eventData.dose_mg = parseFloat(formData.dose_mg);
      }

      if (typeId === "weight_logged") {
        if (!formData.weight_value) throw new Error("Ingrese el peso en kg");
        const val = parseFloat(formData.weight_value);
        if (!(val > 0 && val < 100)) throw new Error("El peso debe ser > 0 y < 100 kg");
        eventData.var_weight = { value: val, date: todayISO() };
      }

      if (typeId === "walk") {
        if (formData.duration_min) eventData.duration_min = parseInt(formData.duration_min);
        if (formData.distance_m) eventData.distance_m = parseInt(formData.distance_m);
      }

      // Inserción del evento (devolviendo event_id)
      const { data: inserted, error: insertErr } = await supabase
        .schema("petcare")
        .from("event")
        .insert(eventData)
        .select("event_id")
        .single();

      if (insertErr) throw insertErr;
      const newEventId = inserted.event_id;

      // Si es vacuna, insertar en vaccine_event
      if (typeId === "vaccine_administered") {
        if (!formData.vaccine_id) throw new Error("Seleccione la vacuna aplicada");

        const vaccineEvent = {
          event_id: newEventId,
          vaccine_id: parseInt(formData.vaccine_id),
          next_due_date: formData.next_due_date || null,
          vaccine_batch: formData.vaccine_batch || "",
          vaccine_dose_number: formData.vaccine_dose_number ? parseInt(formData.vaccine_dose_number) : null,
          vaccine_expiration_date: formData.vaccine_expiration_date || null,
        };

        const { error: veErr } = await supabase
          .schema("petcare")
          .from("vaccine_event")
          .insert(vaccineEvent);
        if (veErr) throw veErr;
      }

      // Limpiar y cerrar
      setFormData({
        e_type_id: eventTypes[0]?.event_type_id || "",
        domicilio: "no",
        region_id: "",
        comuna_id: "",
        clinic_id: "",
        vet_id: "",
        e_description: "",
        weight_value: "",
        duration_min: "",
        distance_m: "",
        vaccine_id: "",
        next_due_date: "",
        vaccine_batch: "",
        vaccine_dose_number: "",
        vaccine_expiration_date: "",
        clinic_name: "",
        clinic_address: "",
        clinic_phone: "",
      });
      setShowForm(false);
      await loadEvents();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al guardar el evento");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm("¿Eliminar este registro?")) return;
    const { error } = await supabase.schema("petcare").from("event").delete().eq("event_id", eventId);
    if (error) {
      alert(`Error al eliminar: ${error.message || "Verifique su conexión o permisos RLS."}`);
      return;
    }
    loadEvents();
  };

  /** Render dinámico por tipo */
  const renderGeoClinicVetBlock = (typeId) => {
    if (!["vaccine_administered", "medication_dose", "routine_check"].includes(typeId)) return null;

    const domicilio = formData.domicilio === "si";

    return (
      <>
        {/* A domicilio */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">¿A domicilio? *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="domicilio"
                value="si"
                checked={formData.domicilio === "si"}
                onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
              />
              <span>Si</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="domicilio"
                value="no"
                checked={formData.domicilio === "no"}
                onChange={(e) => setFormData({ ...formData, domicilio: e.target.value })}
              />
              <span>No</span>
            </label>
          </div>
        </div>

        {/* Región (solo filtro) */}
        <div>
          <label className="block text-sm font-medium mb-2">Región</label>
          <select
            value={formData.region_id}
            onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">Seleccionar...</option>
            {regions.map((r) => (
              <option key={r.region_id} value={r.region_id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Comuna (se guarda en event.comuna_id) */}
        <div>
          <label className="block text-sm font-medium mb-2">Comuna</label>
          <select
            value={formData.comuna_id}
            onChange={(e) => setFormData({ ...formData, comuna_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">Seleccionar...</option>
            {comunas.map((c) => (
              <option key={c.comuna_id} value={c.comuna_id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Flujos según domicilio */}
        {!domicilio ? (
          <>
            {/* Clínica por comuna */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Nombre de la clínica</label>
              <select
                value={formData.clinic_id}
                onChange={(e) => setFormData({ ...formData, clinic_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {clinics.map((cl) => (
                  <option key={cl.clinic_id} value={cl.clinic_id}>{cl.name}</option>
                ))}
              </select>
            </div>

            {/* Autorelleno Dirección / Teléfono (no editables, se guardan en event.details) */}
            <div>
              <label className="block text-sm font-medium mb-2">Dirección</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-gray-100" value={formData.clinic_address} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Teléfono</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-gray-100" value={formData.clinic_phone} readOnly />
            </div>

            {/* Veterinario por clínica */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Veterinario</label>
              <select
                value={formData.vet_id}
                onChange={(e) => setFormData({ ...formData, vet_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {vetsByClinic.map((v) => (
                  <option key={v.vet_id} value={v.vet_id}>{v.full_name}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            {/* Veterinario por comuna (vía app_user) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Veterinario</label>
              <select
                value={formData.vet_id}
                onChange={(e) => setFormData({ ...formData, vet_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {vetsByComuna.map((v) => (
                  <option key={v.vet_id} value={v.vet_id}>{v.full_name}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </>
    );
  };

  const renderVaccineBlock = (typeId) => {
    if (typeId !== "vaccine_administered") return null;
    return (
      <>
        {/* Vacuna por especie */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Nombre de la vacuna</label>
          <select
            value={formData.vaccine_id}
            onChange={(e) => setFormData({ ...formData, vaccine_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">Seleccionar...</option>
            {vaccines.map((v) => (
              <option key={v.vaccine_id} value={v.vaccine_id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Próxima dosis (next_due_date)</label>
          <input
            type="date"
            value={formData.next_due_date}
            onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Lote de vacuna</label>
          <input
            type="text"
            value={formData.vaccine_batch}
            onChange={(e) => setFormData({ ...formData, vaccine_batch: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ej: LOT123456"
            maxLength={25}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Número de dosis</label>
          <input
            type="number"
            min="0"
            value={formData.vaccine_dose_number}
            onChange={(e) => setFormData({ ...formData, vaccine_dose_number: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ej: 1, 2, 3..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Fecha de expiración</label>
          <input
            type="date"
            value={formData.vaccine_expiration_date}
            onChange={(e) => setFormData({ ...formData, vaccine_expiration_date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </>
    );
  };

  const renderMedicationBlock = (typeId) => {
    if (typeId !== "medication_dose") return null;
    return (
      <div>
        <label className="block text-sm font-medium mb-2">Dosis (mg)</label>
        <input
          type="number"
          step="0.1"
          min="0"
          value={formData.dose_mg}
          onChange={(e) => setFormData({ ...formData, dose_mg: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Ej: 50"
        />
      </div>
    );
  };

  const renderWeightBlock = (typeId) => {
    if (typeId !== "weight_logged") return null;
    return (
      <div>
        <label className="block text-sm font-medium mb-2">Peso (kg) *</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          max="99.9"
          value={formData.weight_value}
          onChange={(e) => setFormData({ ...formData, weight_value: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Ej: 12.5"
          required
        />
      </div>
    );
  };

  const renderWalkBlock = (typeId) => {
    if (typeId !== "walk") return null;
    return (
      <>
        <div>
          <label className="block text-sm font-medium mb-2">Duración (min)</label>
          <input
            type="number"
            min="1"
            value={formData.duration_min}
            onChange={(e) => setFormData({ ...formData, duration_min: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ej: 30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Distancia (mts)</label>
          <input
            type="number"
            min="1"
            value={formData.distance_m}
            onChange={(e) => setFormData({ ...formData, distance_m: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ej: 2000"
          />
        </div>
      </>
    );
  };

  const renderDescription = () => (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium mb-2">Descripción</label>
      <textarea
        value={formData.e_description}
        onChange={(e) => setFormData({ ...formData, e_description: e.target.value.slice(0, 250) })}
        className="w-full px-3 py-2 border rounded-lg"
        rows={3}
        placeholder="Opcional. Máx 250 caracteres"
      />
      <div className="text-right text-xs text-gray-500">{formData.e_description.length}/250</div>
    </div>
  );

  if (loading) return <div className="text-center py-8">Cargando historial...</div>;

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
        <form onSubmit={handleSubmit} className="mb-6 p-6 border rounded-2xl bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Tipo de Evento *</label>
              <select
                value={formData.e_type_id}
                onChange={(e) => setFormData({ ...formData, e_type_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg bg-white"
                required
              >
                <option value="">Seleccionar...</option>
                {eventTypes.map((t) => (
                  <option key={t.event_type_id} value={t.event_type_id}>{t.display_name}</option>
                ))}
              </select>
            </div>

            {/* Bloque geo/atención (para vacuna/medicación/chequeo) */}
            {renderGeoClinicVetBlock(formData.e_type_id)}

            {/* Bloques específicos */}
            {renderVaccineBlock(formData.e_type_id)}
            {renderMedicationBlock(formData.e_type_id)}
            {renderWeightBlock(formData.e_type_id)}
            {renderWalkBlock(formData.e_type_id)}

            {/* Descripción (presente en todos los casos menos que el usuario no quiera) */}
            {renderDescription()}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
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
            <div key={event.event_id} className="border rounded-2xl p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getEventIcon(event.e_type_id)}</span>
                    <div>
                      <h4 className="font-semibold">{event.event_type_catalog?.display_name}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(event.ts).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {event.var_weight && (
                      <p className="text-gray-700">⚖️ Peso: {event.var_weight?.value} kg — {event.var_weight?.date}</p>
                    )}
                    {event.dose_mg && <p className="text-gray-700">💊 Dosis: {event.dose_mg} mg</p>}
                    {event.duration_min && <p className="text-gray-700">⏱️ Duración: {event.duration_min} min</p>}
                    {event.distance_m && <p className="text-gray-700">📏 Distancia: {event.distance_m} m</p>}
                    {event.e_description && <p className="text-gray-700">{event.e_description}</p>}

                    {/* Clínica y vet (si existen) */}
                    {(event.clinic || event.vet) && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {event.clinic?.name && <p className="font-medium">🏥 {event.clinic.name}</p>}
                        {event.vet?.full_name && <p>👨‍⚕️ {event.vet.full_name}</p>}
                        {event.clinic?.phone && <p>📞 {event.clinic.phone}</p>}
                        {event.clinic?.address && <p>📍 {event.clinic.address}</p>}
                      </div>
                    )}

                    {/* details guardado para clínica seleccionada */}
                    {event.details && typeof event.details === "object" && (event.details.name || event.details.phone || event.details.address) && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {event.details.name && <p className="font-medium">🏥 {event.details.name}</p>}
                        {event.details.phone && <p>📞 {event.details.phone}</p>}
                        {event.details.address && <p>📍 {event.details.address}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={() => handleDelete(event.event_id)} className="ml-4 text-red-600 hover:text-red-800 text-sm">
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