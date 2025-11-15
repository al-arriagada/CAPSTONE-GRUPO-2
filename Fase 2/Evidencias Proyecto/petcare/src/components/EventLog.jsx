import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";

const CHARGE_TYPES = ["routine_check", "vaccine_administered", "medication_dose"];

export default function EventLog({ petId: propPetId }) {
  const { id } = useParams();
  const petId = propPetId || id;
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [regions, setRegions] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [vetsByClinic, setVetsByClinic] = useState([]);
  const [vetsByComuna, setVetsByComuna] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [petSpeciesId, setPetSpeciesId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modo edición
  const [editingId, setEditingId] = useState(null);

  // Estado para rastrear si ya se cargaron los datos iniciales
  const [initialized, setInitialized] = useState(false);

  const [formData, setFormData] = useState({
    e_type_id: "",
    event_datetime: "", // datetime-local
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
    next_dose_datetime: "", // próxima dosis/control
    vaccine_batch: "",
    vaccine_dose_number: "",
    vaccine_expiration_date: "",
    dose_mg: "",
    clinic_name: "",
    clinic_address: "",
    clinic_phone: "",
    // NUEVO:
    charge: "",
    currency_id: "",
  });

  const convertToISO = (datetimeLocal) => {
    if (!datetimeLocal) return new Date().toISOString();
    return new Date(datetimeLocal).toISOString();
  };

  const formatEventDateTime = (isoString) => {
    if (!isoString) return "—";
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const timeStr = date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit"
    });
    return `${dateStr}, ${timeStr}`;
  };

  const todayISO = () => new Date().toISOString().slice(0, 10);

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

  /** Cargas iniciales - solo una vez */
  useEffect(() => {
    if (!user || !petId || initialized) return;

    const initializeData = async () => {
      try {
        // Tipos de eventos
        const { data: eventTypesData } = await supabase
          .schema("petcare")
          .from("event_type_catalog")
          .select("event_type_id, display_name")
          .order("display_name");
        if (eventTypesData) setEventTypes(eventTypesData);

        // Regiones
        const { data: regionsData } = await supabase
          .schema("petcare")
          .from("region")
          .select("region_id, name")
          .order("name");
        if (regionsData) setRegions(regionsData);

        // Monedas
        const { data: currenciesData } = await supabase
          .schema("petcare")
          .from("currency")
          .select("currency_id")
          .order("currency_id");
        if (currenciesData) setCurrencies(currenciesData);

        // Datos de la mascota → especie
        const { data: petData } = await supabase
          .schema("petcare")
          .from("pet")
          .select("species_id")
          .eq("pet_id", petId)
          .maybeSingle();

        if (petData) {
          setPetSpeciesId(petData.species_id);

          // Vacunas por especie
          const { data: vaccinesData } = await supabase
            .schema("petcare")
            .from("vaccine")
            .select("vaccine_id, name")
            .eq("species_id", petData.species_id)
            .order("name");
          if (vaccinesData) setVaccines(vaccinesData);
        }

        setInitialized(true);
      } catch (err) {
        console.error("Error initializing data:", err);
      }
    };

    initializeData();
  }, [user, petId, initialized]);

  /** Cargar eventos */
  const loadEvents = useCallback(async () => {
    if (!petId || !user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .schema("petcare")
        .from("event")
        .select("*")
        .eq("pet_id", petId)
        .order("ts", { ascending: false });

      if (eventsError) {
        console.error("Error loading events:", eventsError);
        setError("No se pudieron cargar los eventos.");
        setLoading(false);
        return;
      }

      const enrichedEvents = await Promise.all(
        (eventsData || []).map(async (event) => {
          try {
            const { data: eventType } = await supabase
              .schema("petcare")
              .from("event_type_catalog")
              .select("event_type_id, display_name")
              .eq("event_type_id", event.e_type_id)
              .single();

            let clinic = null;
            if (event.clinic_id) {
              const { data: clinicData } = await supabase
                .schema("petcare")
                .from("clinic")
                .select("name, address, phone")
                .eq("clinic_id", event.clinic_id)
                .single();
              clinic = clinicData;
            }

            let vet = null;
            if (event.vet_id) {
              const { data: vetData } = await supabase
                .schema("petcare")
                .from("vet")
                .select("full_name")
                .eq("vet_id", event.vet_id)
                .single();
              vet = vetData;
            }

            return {
              ...event,
              event_type_catalog: eventType,
              clinic: clinic,
              vet: vet,
            };
          } catch (err) {
            console.error("Error enriching event:", err);
            return event;
          }
        })
      );

      setEvents(enrichedEvents);
    } catch (err) {
      console.error("Exception loading events:", err);
      setError("Error al cargar eventos");
    } finally {
      setLoading(false);
    }
  }, [petId, user]);

  useEffect(() => {
    if (user && initialized) {
      loadEvents();
    }
  }, [loadEvents, user, initialized]);

  /** Cascada Region -> Comuna */
  useEffect(() => {
    if (!user || !formData.region_id) {
      setComunas([]);
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    const loadComunas = async () => {
      try {
        const { data, error } = await supabase
          .schema("petcare")
          .from("comuna")
          .select("comuna_id, name")
          .eq("region_id", formData.region_id)
          .order("name");

        if (!error && data) {
          setComunas(data);
        }
      } catch (err) {
        console.error("Error loading comunas:", err);
      }
    };

    loadComunas();

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
  }, [formData.region_id, user]);

  /** Comuna -> Clínicas y Vets */
  useEffect(() => {
    if (!user || !formData.comuna_id) {
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    const loadClinicsAndVets = async () => {
      try {
        // Clínicas
        const { data: cData } = await supabase
          .schema("petcare")
          .from("clinic")
          .select("clinic_id, name, address, phone")
          .eq("comuna_id", formData.comuna_id)
          .order("name");
        if (cData) setClinics(cData);

        // Vets por comuna
        const { data: vetsData, error: vetsError } = await supabase
          .schema("petcare")
          .from("vet")
          .select("vet_id, full_name, clinic_id, user_id")
          .eq("comuna_id", formData.comuna_id)
          .order("full_name");

        if (vetsError) {
          console.error("Error loading vets by comuna:", vetsError);
          setVetsByComuna([]);
        } else {
          setVetsByComuna(vetsData || []);
        }
      } catch (err) {
        console.error("Error loading clinics/vets:", err);
      }
    };

    loadClinicsAndVets();

    // Limpiar dependientes
    setFormData((p) => ({
      ...p,
      clinic_id: "",
      vet_id: "",
      clinic_name: "",
      clinic_address: "",
      clinic_phone: ""
    }));
  }, [formData.comuna_id, user]);

  /** Clínica -> Veterinarios */
  useEffect(() => {
    if (!user || !formData.clinic_id) {
      setVetsByClinic([]);
      setFormData((p) => ({
        ...p,
        clinic_name: "",
        clinic_address: "",
        clinic_phone: ""
      }));
      return;
    }

    const loadVetsByClinic = async () => {
      try {
        // Autorrellenar datos de clínica
        const clinic = clinics.find((c) => c.clinic_id === formData.clinic_id);
        if (clinic) {
          setFormData((p) => ({
            ...p,
            clinic_name: clinic.name || "",
            clinic_address: clinic.address || "",
            clinic_phone: clinic.phone || "",
          }));
        }

        // Vets de la clínica
        const { data } = await supabase
          .schema("petcare")
          .from("vet")
          .select("vet_id, full_name")
          .eq("clinic_id", formData.clinic_id)
          .order("full_name");

        if (data) setVetsByClinic(data);
      } catch (err) {
        console.error("Error loading vets by clinic:", err);
      }
    };

    loadVetsByClinic();
  }, [formData.clinic_id, clinics, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("Debes iniciar sesión para guardar eventos");
      return;
    }

    if (!formData.e_type_id) {
      setError("Selecciona un tipo de evento");
      return;
    }

    const typeId = formData.e_type_id;
    const domicilio = formData.domicilio === "si";

    // Validar fecha para eventos que requieren datetime
    const needsDateTime = ["incident_reported", "medication_dose", "routine_check", "vaccine_administered"].includes(typeId);
    if (needsDateTime && !formData.event_datetime) {
      setError("Debes ingresar la fecha y hora del evento");
      return;
    }

    // Validar próxima dosis/control si se ingresó
    if (formData.next_dose_datetime) {
      const eventDate = new Date(formData.event_datetime || new Date());
      const nextDate = new Date(formData.next_dose_datetime);
      if (nextDate <= eventDate) {
        setError("La fecha de próxima dosis/control debe ser posterior a la fecha del evento");
        return;
      }
    }

    // Validación suave de charge/currency
    if (CHARGE_TYPES.includes(typeId)) {
      if (formData.charge !== "" && Number(formData.charge) < 0) {
        setError("El cobro (charge) no puede ser negativo");
        return;
      }
      if (formData.charge && Number(formData.charge) > 0 && !formData.currency_id) {
        setError("Selecciona una moneda cuando el cobro es mayor a 0");
        return;
      }
    }

    try {
      setSaving(true);

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        throw new Error("No se pudo verificar la sesión del usuario");
      }

      // Construir payload del evento
      const eventData = {
        pet_id: petId,
        user_id: authUser.id,
        e_type_id: typeId,
        ts: needsDateTime ? convertToISO(formData.event_datetime) : new Date().toISOString(),
        details: { "En casa": domicilio }, // ← NUEVO
      };

      if (formData.e_description?.trim()) {
        eventData.e_description = formData.e_description.trim();
      }

      if (["vaccine_administered", "medication_dose", "routine_check"].includes(typeId)) {
        if (formData.comuna_id) eventData.comuna_id = parseInt(formData.comuna_id);
        if (!domicilio && formData.clinic_id) eventData.clinic_id = formData.clinic_id;
        if (formData.vet_id) eventData.vet_id = formData.vet_id;
      }

      if (typeId === "medication_dose" && formData.dose_mg) {
        eventData.dose_mg = parseFloat(formData.dose_mg);
      }

      if (typeId === "weight_logged") {
        if (!formData.weight_value) throw new Error("Ingrese el peso en kg");
        const val = parseFloat(formData.weight_value);
        if (isNaN(val) || val <= 0 || val >= 100) {
          throw new Error("El peso debe ser un número válido entre 0 y 100 kg");
        }
        eventData.var_weight = {
          value: val,
          date: new Date().toISOString().slice(0, 10)
        };
      }

      if (typeId === "walk") {
        if (formData.duration_min) eventData.duration_min = parseInt(formData.duration_min);
        if (formData.distance_m) eventData.distance_m = parseInt(formData.distance_m);
      }

      // NUEVO: charge y currency_id
      if (CHARGE_TYPES.includes(typeId)) {
        eventData.charge = formData.charge !== "" ? Number(formData.charge) : null;
        eventData.currency_id =
          eventData.charge && eventData.charge > 0 ? (formData.currency_id || null) : null;
      }

      // INSERT o UPDATE
      let newEventId = editingId;
      if (editingId) {
        const { error: updErr } = await supabase
          .schema("petcare")
          .from("event")
          .update(eventData)
          .eq("event_id", editingId);
        if (updErr) throw new Error(updErr.message || "Error al actualizar evento");
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .schema("petcare")
          .from("event")
          .insert(eventData)
          .select("event_id")
          .single();
        if (insertErr) throw new Error(insertErr.message || "Error al insertar evento");
        if (!inserted) throw new Error("No se recibió el evento creado");
        newEventId = inserted.event_id;
      }

      // Manejo de vaccine_event SOLO en creación (como en tu flujo original)
      if (!editingId && typeId === "vaccine_administered") {
        if (!formData.vaccine_id) throw new Error("Seleccione la vacuna aplicada");

        const vaccineEvent = {
          event_id: newEventId,
          vaccine_id: parseInt(formData.vaccine_id),
          next_due_date: formData.next_dose_datetime ? new Date(formData.next_dose_datetime).toISOString().slice(0, 10) : null,
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

      // Crear evento futuro si se ingresó próxima dosis/control (igual que tu flujo)
      if (formData.next_dose_datetime && ["medication_dose", "routine_check", "vaccine_administered"].includes(typeId)) {
        const futureEventData = {
          pet_id: petId,
          user_id: authUser.id,
          e_type_id: typeId,
          ts: convertToISO(formData.next_dose_datetime),
          details: { "En casa": domicilio },
        };

        // Copiar datos geográficos y clínica
        if (formData.comuna_id) futureEventData.comuna_id = parseInt(formData.comuna_id);
        if (!domicilio && formData.clinic_id) futureEventData.clinic_id = formData.clinic_id;
        if (formData.vet_id) futureEventData.vet_id = formData.vet_id;

        // charge/currency también para el futuro si corresponde
        if (CHARGE_TYPES.includes(typeId)) {
          const ch = formData.charge !== "" ? Number(formData.charge) : null;
          futureEventData.charge = ch;
          futureEventData.currency_id = ch && ch > 0 ? (formData.currency_id || null) : null;
        }

        await supabase
          .schema("petcare")
          .from("event")
          .insert(futureEventData);
      }

      // Resetear formulario
      setFormData({
        e_type_id: "",
        event_datetime: "",
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
        next_dose_datetime: "",
        vaccine_batch: "",
        vaccine_dose_number: "",
        vaccine_expiration_date: "",
        dose_mg: "",
        clinic_name: "",
        clinic_address: "",
        clinic_phone: "",
        charge: "",
        currency_id: "",
      });
      setEditingId(null);
      setShowForm(false);
      await loadEvents();
    } catch (err) {
      console.error("=== ERROR COMPLETO ===", err);
      setError(err.message || "Error al guardar el evento");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!confirm("¿Eliminar este registro?")) return;

    try {
      const { error } = await supabase
        .schema("petcare")
        .from("event")
        .delete()
        .eq("event_id", eventId);

      if (error) {
        alert(`Error al eliminar: ${error.message}`);
        return;
      }
      loadEvents();
    } catch (err) {
      console.error("Exception deleting event:", err);
      alert("Error al eliminar el evento");
    }
  };

  // Cargar evento al formulario para edición
  const handleEdit = async (ev) => {
    try {
      // obtener region de la comuna
      let regionId = "";
      if (ev.comuna_id) {
        const { data: cmn } = await supabase
          .schema("petcare")
          .from("comuna")
          .select("region_id")
          .eq("comuna_id", ev.comuna_id)
          .maybeSingle();
        regionId = cmn?.region_id || "";
      }

      // preparar cascadas
      if (regionId) {
        const { data: cmns } = await supabase
          .schema("petcare")
          .from("comuna")
          .select("comuna_id, name")
          .eq("region_id", regionId)
          .order("name");
        setComunas(cmns || []);
      }
      if (ev.comuna_id) {
        const [{ data: cls }, { data: vtc }, { data: vtc2 }] = await Promise.all([
          supabase.schema("petcare").from("clinic").select("clinic_id, name, address, phone").eq("comuna_id", ev.comuna_id).order("name"),
          supabase.schema("petcare").from("vet").select("vet_id, full_name, clinic_id, user_id").eq("comuna_id", ev.comuna_id).order("full_name"),
          supabase.schema("petcare").from("vet").select("vet_id, full_name").eq("clinic_id", ev.clinic_id || "").order("full_name"),
        ]);
        setClinics(cls || []);
        setVetsByComuna(vtc || []);
        setVetsByClinic(vtc2 || []);
      }

      const enCasa = !!(ev?.details?.["En casa"]);
      setFormData((prev) => ({
        ...prev,
        e_type_id: ev.e_type_id || "",
        event_datetime: ev.ts ? new Date(ev.ts).toISOString().slice(0, 16) : "",
        domicilio: enCasa ? "si" : "no",
        region_id: regionId || "",
        comuna_id: ev.comuna_id || "",
        clinic_id: enCasa ? "" : (ev.clinic_id || ""),
        vet_id: enCasa ? "" : (ev.vet_id || ""),
        e_description: ev.e_description || "",
        // vaccine fields no los tocamos (se manejan al crear)
        dose_mg: ev.dose_mg || "",
        weight_value: ev.var_weight?.value || "",
        duration_min: ev.duration_min || "",
        distance_m: ev.distance_m || "",
        clinic_name: "",
        clinic_address: "",
        clinic_phone: "",
        // NUEVO:
        charge: ev.charge ?? "",
        currency_id: ev.currency_id || "",
      }));
      setEditingId(ev.event_id);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error preparando edición:", err);
    }
  };

  const renderGeoClinicVetBlock = (typeId) => {
    if (!["vaccine_administered", "medication_dose", "routine_check"].includes(typeId)) return null;

    const domicilio = formData.domicilio === "si";

    return (
      <>
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
              <span>Sí</span>
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

        {!domicilio ? (
          <>
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

            <div>
              <label className="block text-sm font-medium mb-2">Dirección</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-gray-100" value={formData.clinic_address} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Teléfono</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg bg-gray-100" value={formData.clinic_phone} readOnly />
            </div>

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
        )}
      </>
    );
  };

  const renderVaccineBlock = (typeId) => {
    if (typeId !== "vaccine_administered") return null;
    return (
      <>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Nombre de la vacuna *</label>
          <select
            value={formData.vaccine_id}
            onChange={(e) => setFormData({ ...formData, vaccine_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg bg-white"
            required
          >
            <option value="">Seleccionar...</option>
            {vaccines.map((v) => (
              <option key={v.vaccine_id} value={v.vaccine_id}>{v.name}</option>
            ))}
          </select>
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
          <label className="block text-sm font-medium mb-2">Fecha de vencimiento</label>
          <input
            type="date"
            value={formData.vaccine_expiration_date}
            onChange={(e) => setFormData({ ...formData, vaccine_expiration_date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Próxima dosis (fecha y hora)</label>
          <input
            type="datetime-local"
            value={formData.next_dose_datetime}
            onChange={(e) => setFormData({ ...formData, next_dose_datetime: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            min={formData.event_datetime}
          />
          <p className="text-xs text-gray-500 mt-1">
            Opcional. Se creará un evento futuro si se completa.
          </p>
        </div>
      </>
    );
  };

  const renderMedicationBlock = (typeId) => {
    if (typeId !== "medication_dose") return null;
    return (
      <>
        <div>
          <label className="block text-sm font-medium mb-2">Dosis (mg)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={formData.dose_mg || ""}
            onChange={(e) => setFormData({ ...formData, dose_mg: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Ej: 50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Próxima dosis (fecha y hora)</label>
          <input
            type="datetime-local"
            value={formData.next_dose_datetime}
            onChange={(e) => setFormData({ ...formData, next_dose_datetime: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            min={formData.event_datetime}
          />
          <p className="text-xs text-gray-500 mt-1">
            Opcional. Si se completa, se creará automáticamente un evento futuro.
          </p>
        </div>
      </>
    );
  };

  const renderRoutineCheckBlock = (typeId) => {
    if (typeId !== "routine_check") return null;
    return (
      <div className="md:col-span-2">
        <label className="block text-sm font-medium mb-2">Próximo control (fecha y hora)</label>
        <input
          type="datetime-local"
          value={formData.next_dose_datetime}
          onChange={(e) => setFormData({ ...formData, next_dose_datetime: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          min={formData.event_datetime}
        />
        <p className="text-xs text-gray-500 mt-1">
          Opcional. Si se completa, se creará automáticamente un evento futuro para el próximo control.
        </p>
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
            value={formData.duration_min || ""}
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
            value={formData.distance_m || ""}
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

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Debes iniciar sesión para ver el historial de eventos</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-8">Cargando historial...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Historial de Eventos</h3>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) {
              // abrir formulario en modo creación
              setEditingId(null);
              setFormData((p) => ({
                ...p,
                e_type_id: "",
                event_datetime: "",
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
                next_dose_datetime: "",
                vaccine_batch: "",
                vaccine_dose_number: "",
                vaccine_expiration_date: "",
                dose_mg: "",
                clinic_name: "",
                clinic_address: "",
                clinic_phone: "",
                charge: "",
                currency_id: "",
              }));
            }
          }}
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
              {["incident_reported", "medication_dose", "routine_check", "vaccine_administered"].includes(formData.e_type_id) && (
                <div className="md:col-span-2 mt-3">
                  <label className="block text-sm font-medium mb-2">Fecha y hora del evento *</label>
                  <input
                    type="datetime-local"
                    value={formData.event_datetime}
                    onChange={(e) => setFormData({ ...formData, event_datetime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              )}
            </div>

            {renderGeoClinicVetBlock(formData.e_type_id)}
            {renderVaccineBlock(formData.e_type_id)}
            {renderMedicationBlock(formData.e_type_id)}
            {renderRoutineCheckBlock(formData.e_type_id)}
            {renderWeightBlock(formData.e_type_id)}
            {renderWalkBlock(formData.e_type_id)}
            {renderDescription()}

            {/* NUEVO: Charge y Currency */}
            {CHARGE_TYPES.includes(formData.e_type_id) && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Cobro (charge)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.charge || ""}
                    onChange={(e) => setFormData({ ...formData, charge: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Ej: 25000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Moneda (currency_id)</label>
                  <select
                    value={formData.currency_id}
                    onChange={(e) => setFormData({ ...formData, currency_id: e.target.value })}
                    disabled={!formData.charge || Number(formData.charge) <= 0}
                    className="w-full px-3 py-2 border rounded-lg bg-white disabled:opacity-50"
                  >
                    <option value="">Seleccionar...</option>
                    {currencies.map((c) => (
                      <option key={c.currency_id} value={c.currency_id}>
                        {c.currency_id}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : (editingId ? "Actualizar Evento" : "Guardar Evento")}
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{event.event_type_catalog?.display_name || event.e_type_id}</h4>
                        {new Date(event.ts) > new Date() ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Programado</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Realizado</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatEventDateTime(event.ts)}
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

                    {/* Info clínica/vet / ubicación */}
                    {(event.clinic || event.vet || event.details) && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                        {/* Nombre de clínica */}
                        {event.clinic?.name ? (
                          <p className="font-medium">🏥 {event.clinic.name}</p>
                        ) : event.details?.name ? (
                          <p className="font-medium">🏥 {event.details.name}</p>
                        ) : null}

                        {/* Veterinario */}
                        {event.vet?.full_name && <p>👨‍⚕️ {event.vet.full_name}</p>}

                        {/* Teléfono */}
                        {event.clinic?.phone ? (
                          <p>📞 {event.clinic.phone}</p>
                        ) : event.details?.phone ? (
                          <p>📞 {event.details.phone}</p>
                        ) : null}

                        {/* Dirección o "En casa" */}
                        {event?.details?.["En casa"] ? (
                          <p>📍 En casa</p>
                        ) : event.clinic?.address ? (
                          <p>📍 {event.clinic.address}</p>
                        ) : event.details?.address ? (
                          <p>📍 {event.details.address}</p>
                        ) : null}
                      </div>
                    )}

                    {/* NUEVO: mostrar charge/currency si corresponde */}
                    {event.charge ? (
                      <p className="text-gray-700">💵 {event.charge}{event.currency_id ? ` ${event.currency_id}` : ""}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <button
                    onClick={() => handleEdit(event)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(event.event_id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}