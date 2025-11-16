import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

// -------------------------------
// CLASIFICACIÓN DE TIPOS
// -------------------------------

// Eventos clínicos (bloque unificado)
const CLINICAL_TYPES = [
  "routine_check",
  "antiparasitic_treatment",
  "emergency_check",
  "sterilization",
  "vaccine_administered",
  "medication_dose",
  "hairdressing",
];

// Eventos clínicos que generan evento futuro
const FUTURE_CLINICAL_TYPES = [
  "routine_check",
  "antiparasitic_treatment",
  "emergency_check",
  "sterilization",
  "vaccine_administered",
  "medication_dose",
];

// Tipos con cobro asociado (trigger expense)
const CHARGE_TYPES = [
  "routine_check",
  "antiparasitic_treatment",
  "emergency_check",
  "sterilization",
  "vaccine_administered",
  "medication_dose",
];

// Eventos no clínicos especiales
const WEIGHT_TYPE = "weight_logged";
const WALK_TYPE = "walk";

// Eventos no clínicos simples
const SIMPLE_TYPES = ["other", "incident_reported", "heat_cycle"];

// -------------------------------
// COMPONENTE
// -------------------------------

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

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [fieldErrors, setFieldErrors] = useState({
    event_datetime: "",
    next_dose_datetime: "",
    charge: "",
    currency_id: "",
  });

  const [formData, setFormData] = useState({
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

  // -------------------------------
  // HELPERS
  // -------------------------------

  const isClinical = (t) => CLINICAL_TYPES.includes(t);
  const isWeight = (t) => t === WEIGHT_TYPE;
  const isWalk = (t) => t === WALK_TYPE;
  const isSimple = (t) => SIMPLE_TYPES.includes(t);

  const convertToISO = (dt) =>
    dt ? new Date(dt).toISOString() : new Date().toISOString();

  const formatEventDateTime = (isoString) => {
    if (!isoString) return "—";
    const date = new Date(isoString);

    return (
      date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) +
      ", " +
      date.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const getEventIcon = (id) => {
    const icons = {
      vaccine_administered: "💉",
      medication_dose: "💊",
      routine_check: "👨‍⚕️",
      antiparasitic_treatment: "🐛",
      emergency_check: "🚨",
      sterilization: "✂️",
      hairdressing: "✂️",
      weight_logged: "⚖️",
      walk: "🚶",
      heat_cycle: "🌸",
      incident_reported: "⚠️",
      other: "📋",
    };
    return icons[id] || "📋";
  };

  const resetForm = () => {
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
    setFieldErrors({
      event_datetime: "",
      next_dose_datetime: "",
      charge: "",
      currency_id: "",
    });
    setEditingId(null);
  };

  const validateField = (name, value, extra = {}) => {
    let errorMsg = "";

    if (name === "event_datetime") {
      if (!value) errorMsg = "La fecha y hora del evento es obligatoria.";
    }

    if (name === "next_dose_datetime") {
      if (value && extra.event_datetime) {
        const eventDt = new Date(extra.event_datetime);
        const nextDt = new Date(value);
        if (isNaN(eventDt.getTime()) || isNaN(nextDt.getTime())) {
          errorMsg = "Las fechas no son válidas.";
        } else if (nextDt <= eventDt) {
          errorMsg = "Debe ser posterior al evento.";
        }
      }
    }

    if (name === "charge") {
      if (value === "") {
        errorMsg = "";
      } else {
        const ch = Number(value);
        if (isNaN(ch)) errorMsg = "Debe ser un número válido.";
        else if (ch < 0) errorMsg = "El cobro no puede ser menor que 0.";
      }
    }

    if (name === "currency_id") {
      const chargeValue = extra.charge;
      if (chargeValue && Number(chargeValue) > 0 && !value) {
        errorMsg = "Selecciona una moneda.";
      }
    }

    setFieldErrors((prev) => ({ ...prev, [name]: errorMsg }));
    return errorMsg === "";
  };

  // -------------------------------
  // CARGAS INICIALES
  // -------------------------------

  useEffect(() => {
    if (!user || !petId || initialized) return;

    const init = async () => {
      try {
        const { data: types } = await supabase
          .schema("petcare")
          .from("event_type_catalog")
          .select("event_type_id, display_name")
          .order("display_name");

        setEventTypes(types || []);

        const { data: regionsData } = await supabase
          .schema("petcare")
          .from("region")
          .select("region_id, name")
          .order("name");
        setRegions(regionsData || []);

        const { data: currencyData } = await supabase
          .schema("petcare")
          .from("currency")
          .select("currency_id");
        setCurrencies(currencyData || []);

        const { data: petData } = await supabase
          .schema("petcare")
          .from("pet")
          .select("species_id")
          .eq("pet_id", petId)
          .maybeSingle();

        if (petData?.species_id) {
          const { data: vacs } = await supabase
            .schema("petcare")
            .from("vaccine")
            .select("vaccine_id, name")
            .eq("species_id", petData.species_id)
            .order("name");

          setVaccines(vacs || []);
        }

        setInitialized(true);
      } catch (err) {
        console.error("Error inicializando EventLog:", err);
      }
    };

    init();
  }, [user, petId, initialized]);

  // -------------------------------
  // CARGAR EVENTOS
  // -------------------------------

  const loadEvents = useCallback(async () => {
    if (!petId || !user) return;

    setLoading(true);
    try {
      const { data, error: evtErr } = await supabase
        .schema("petcare")
        .from("event")
        .select("*")
        .eq("pet_id", petId)
        .order("ts", { ascending: false });

      if (evtErr) {
        setError("Error al cargar eventos.");
        setLoading(false);
        return;
      }

      const enriched = await Promise.all(
        (data || []).map(async (evt) => {
          try {
            const { data: type } = await supabase
              .schema("petcare")
              .from("event_type_catalog")
              .select("event_type_id, display_name")
              .eq("event_type_id", evt.e_type_id)
              .maybeSingle();

            let clinic = null;
            let vet = null;

            if (evt.clinic_id) {
              const { data: c } = await supabase
                .schema("petcare")
                .from("clinic")
                .select("name, address, phone")
                .eq("clinic_id", evt.clinic_id)
                .maybeSingle();
              clinic = c;
            }

            if (evt.vet_id) {
              const { data: v } = await supabase
                .schema("petcare")
                .from("vet")
                .select("full_name")
                .eq("vet_id", evt.vet_id)
                .maybeSingle();
              vet = v;
            }

            return {
              ...evt,
              event_type_catalog: type,
              clinic,
              vet,
            };
          } catch {
            return evt;
          }
        })
      );

      setEvents(enriched);
    } catch (err) {
      setError("Error al cargar eventos.");
    } finally {
      setLoading(false);
    }
  }, [petId, user]);

  useEffect(() => {
    if (initialized && user) loadEvents();
  }, [initialized, user, loadEvents]);

  // -------------------------------
  // CASCADA REGION → COMUNA
  // -------------------------------

  useEffect(() => {
    if (!formData.region_id) {
      setComunas([]);
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .schema("petcare")
        .from("comuna")
        .select("comuna_id, name")
        .eq("region_id", formData.region_id)
        .order("name");

      setComunas(data || []);
    };

    load();

    setFormData((prev) => ({
      ...prev,
      comuna_id: "",
      clinic_id: "",
      vet_id: "",
      clinic_name: "",
      clinic_address: "",
      clinic_phone: "",
    }));
  }, [formData.region_id]);

  // -------------------------------
  // COMUNA → CLÍNICAS / VETS
  // -------------------------------

  useEffect(() => {
    if (!formData.comuna_id) {
      setClinics([]);
      setVetsByClinic([]);
      setVetsByComuna([]);
      return;
    }

    const load = async () => {
      const { data: cls } = await supabase
        .schema("petcare")
        .from("clinic")
        .select("clinic_id, name, address, phone")
        .eq("comuna_id", formData.comuna_id);

      setClinics(cls || []);

      const { data: vets } = await supabase
        .schema("petcare")
        .from("vet")
        .select("vet_id, full_name, clinic_id")
        .eq("comuna_id", formData.comuna_id)
        .order("full_name");

      setVetsByComuna(vets || []);
    };

    load();

    setFormData((prev) => ({
      ...prev,
      clinic_id: "",
      vet_id: "",
      clinic_name: "",
      clinic_address: "",
      clinic_phone: "",
    }));
  }, [formData.comuna_id]);

  // -------------------------------
  // CLÍNICA → VETS
  // -------------------------------

  useEffect(() => {
    if (!formData.clinic_id) {
      setVetsByClinic([]);
      return;
    }

    const load = async () => {
      const clinic = clinics.find((c) => c.clinic_id === formData.clinic_id);

      if (clinic) {
        setFormData((prev) => ({
          ...prev,
          clinic_name: clinic.name,
          clinic_address: clinic.address,
          clinic_phone: clinic.phone,
        }));
      }

      const { data } = await supabase
        .schema("petcare")
        .from("vet")
        .select("vet_id, full_name")
        .eq("clinic_id", formData.clinic_id)
        .order("full_name");

      setVetsByClinic(data || []);
    };

    load();
  }, [formData.clinic_id, clinics]);

  // -------------------------------
  // FORM BLOCKS
  // -------------------------------

  const renderClinicalBlock = () => {
    if (!isClinical(formData.e_type_id)) return null;

    const domicilio = formData.domicilio === "si";
    const showNext = formData.e_type_id !== "hairdressing";

    return (
      <>
        {/* A DOMICILIO */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">¿A domicilio?</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="domicilio"
                value="si"
                checked={formData.domicilio === "si"}
                onChange={(e) =>
                  setFormData({ ...formData, domicilio: e.target.value })
                }
              />
              <span>Sí</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="domicilio"
                value="no"
                checked={formData.domicilio === "no"}
                onChange={(e) =>
                  setFormData({ ...formData, domicilio: e.target.value })
                }
              />
              <span>No</span>
            </label>
          </div>
        </div>

        {/* REGIÓN */}
        <div>
          <label className="block text-sm font-medium mb-2">Región</label>
          <select
            value={formData.region_id}
            onChange={(e) =>
              setFormData({ ...formData, region_id: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">Seleccionar...</option>
            {regions.map((r) => (
              <option key={r.region_id} value={r.region_id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* COMUNA */}
        <div>
          <label className="block text-sm font-medium mb-2">Comuna</label>
          <select
            value={formData.comuna_id}
            onChange={(e) =>
              setFormData({ ...formData, comuna_id: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">Seleccionar...</option>
            {comunas.map((c) => (
              <option key={c.comuna_id} value={c.comuna_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {/* CLÍNICA Y VET (si NO es domicilio) */}
        {!domicilio ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Clínica</label>
              <select
                value={formData.clinic_id}
                onChange={(e) =>
                  setFormData({ ...formData, clinic_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {clinics.map((cl) => (
                  <option key={cl.clinic_id} value={cl.clinic_id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Dirección</label>
              <input
                type="text"
                value={formData.clinic_address}
                className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Teléfono</label>
              <input
                type="text"
                value={formData.clinic_phone}
                className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                readOnly
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Veterinario</label>
              <select
                value={formData.vet_id}
                onChange={(e) =>
                  setFormData({ ...formData, vet_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {vetsByClinic.map((v) => (
                  <option key={v.vet_id} value={v.vet_id}>
                    {v.full_name}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          // SI ES DOMICILIO: SOLO VETS POR COMUNA
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2">Veterinario</label>
            <select
              value={formData.vet_id}
              onChange={(e) =>
                setFormData({ ...formData, vet_id: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg bg-white"
            >
              <option value="">Seleccionar...</option>
              {vetsByComuna.map((v) => (
                <option key={v.vet_id} value={v.vet_id}>
                  {v.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* CAMPOS ESPECIALES DE VACUNA */}
        {formData.e_type_id === "vaccine_administered" && (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Vacuna aplicada
              </label>
              <select
                value={formData.vaccine_id}
                onChange={(e) =>
                  setFormData({ ...formData, vaccine_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {vaccines.map((v) => (
                  <option key={v.vaccine_id} value={v.vaccine_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Lote</label>
              <input
                type="text"
                value={formData.vaccine_batch}
                onChange={(e) =>
                  setFormData({ ...formData, vaccine_batch: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Número de dosis
              </label>
              <input
                type="number"
                value={formData.vaccine_dose_number}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vaccine_dose_number: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Fecha de vencimiento
              </label>
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

        {/* CAMPOS DE MEDICACIÓN */}
        {formData.e_type_id === "medication_dose" && (
          <div>
            <label className="block text-sm font-medium mb-2">Dosis (mg)</label>
            <input
              type="number"
              value={formData.dose_mg}
              onChange={(e) =>
                setFormData({ ...formData, dose_mg: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        )}

        {/* PRÓXIMO CONTROL (no para hairdressing) */}
        {formData.e_type_id !== "hairdressing" &&
          isClinical(formData.e_type_id) && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Próximo control / próxima dosis
              </label>
              <input
                type="datetime-local"
                value={formData.next_dose_datetime}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, next_dose_datetime: val });
                  validateField("next_dose_datetime", val, {
                    event_datetime: formData.event_datetime,
                  });
                }}
                className={`w-full px-3 py-2 border rounded-lg ${fieldErrors.next_dose_datetime ? "border-red-500" : ""
                  }`}
                min={formData.event_datetime}
              />
              {fieldErrors.next_dose_datetime && (
                <p className="text-red-600 text-sm">
                  {fieldErrors.next_dose_datetime}
                </p>
              )}
            </div>
          )}
      </>
    );
  };

  // -------------------------------
  // BLOQUE PESO
  // -------------------------------

  const renderWeightBlock = () => {
    if (!isWeight(formData.e_type_id)) return null;

    return (
      <div>
        <label className="block text-sm font-medium mb-2">Peso (kg)</label>
        <input
          type="number"
          value={formData.weight_value}
          onChange={(e) =>
            setFormData({ ...formData, weight_value: e.target.value })
          }
          className="w-full px-3 py-2 border rounded-lg"
          min="0"
          step="0.1"
        />
      </div>
    );
  };

  // -------------------------------
  // BLOQUE PASEO
  // -------------------------------

  const renderWalkBlock = () => {
    if (!isWalk(formData.e_type_id)) return null;

    return (
      <>
        <div>
          <label className="block text-sm font-medium mb-2">Duración (min)</label>
          <input
            type="number"
            value={formData.duration_min}
            onChange={(e) =>
              setFormData({ ...formData, duration_min: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Distancia (metros)
          </label>
          <input
            type="number"
            value={formData.distance_m}
            onChange={(e) =>
              setFormData({ ...formData, distance_m: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg"
            min="0"
          />
        </div>
      </>
    );
  };

  // -------------------------------
  // BLOQUE DESCRIPCIÓN (FORMULARIO)
  // -------------------------------

  const renderDescriptionBlock = () => (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium mb-2">Descripción</label>
      <textarea
        value={formData.e_description}
        onChange={(e) =>
          setFormData({
            ...formData,
            e_description: e.target.value.slice(0, 250),
          })
        }
        rows={3}
        className="w-full px-3 py-2 border rounded-lg"
        placeholder="Opcional"
      />
      <div className="text-right text-xs text-gray-500">
        {formData.e_description.length}/250
      </div>
    </div>
  );

  // -------------------------------
  // BLOQUE COBRO
  // -------------------------------

  const renderChargeBlock = () => {
    if (!CHARGE_TYPES.includes(formData.e_type_id)) return null;

    return (
      <>
        <div>
          <label className="block text-sm font-medium mb-2">Cobro</label>
          <input
            type="number"
            value={formData.charge}
            min="0"
            step="0.01"
            onChange={(e) => {
              const val = e.target.value;
              setFormData({ ...formData, charge: val });
              validateField("charge", val);
              validateField("currency_id", formData.currency_id, {
                charge: val,
              });
            }}
            className={`w-full px-3 py-2 border rounded-lg ${fieldErrors.charge ? "border-red-500" : ""
              }`}
          />
          {fieldErrors.charge && (
            <p className="text-red-600 text-sm">{fieldErrors.charge}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Moneda</label>
          <select
            value={formData.currency_id}
            onChange={(e) => {
              const val = e.target.value;
              setFormData({ ...formData, currency_id: val });
              validateField("currency_id", val, {
                charge: formData.charge,
              });
            }}
            disabled={!formData.charge || Number(formData.charge) <= 0}
            className={`w-full px-3 py-2 border rounded-lg bg-white disabled:opacity-50 ${fieldErrors.currency_id ? "border-red-500" : ""
              }`}
          >
            <option value="">Seleccionar...</option>
            {currencies.map((c) => (
              <option key={c.currency_id} value={c.currency_id}>
                {c.currency_id}
              </option>
            ))}
          </select>
          {fieldErrors.currency_id && (
            <p className="text-red-600 text-sm">{fieldErrors.currency_id}</p>
          )}
        </div>
      </>
    );
  };

  // -------------------------------
  // SUBMIT — Validaciones previas
  // -------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const typeId = formData.e_type_id;
    if (!typeId) {
      setError("Debes seleccionar un tipo de evento.");
      return;
    }

    // Fecha obligatoria (TODOS los tipos)
    if (!formData.event_datetime) {
      setError("Debes ingresar fecha y hora del evento.");
      return;
    }

    // Próximo control (solo clínicos y no hairdressing)
    if (
      isClinical(typeId) &&
      typeId !== "hairdressing" &&
      formData.next_dose_datetime
    ) {
      const eventDt = new Date(formData.event_datetime);
      const nextDt = new Date(formData.next_dose_datetime);
      if (nextDt <= eventDt) {
        setError("La fecha del próximo control debe ser posterior al evento.");
        return;
      }
    }
    // Validación de cobro
    if (CHARGE_TYPES.includes(typeId)) {
      const chargeValue =
        formData.charge !== "" ? Number(formData.charge) : null;

      if (chargeValue !== null && isNaN(chargeValue)) {
        setError("El cobro debe ser un número válido.");
        return;
      }
      if (chargeValue !== null && chargeValue < 0) {
        setError("El cobro no puede ser menor que 0.");
        return;
      }
      if (chargeValue && chargeValue > 0 && !formData.currency_id) {
        setError("Debes seleccionar una moneda.");
        return;
      }
    }

    // Validación de peso
    if (isWeight(typeId)) {
      const w = parseFloat(formData.weight_value);
      if (isNaN(w) || w <= 0 || w >= 100) {
        setError("Peso inválido. Debe ser mayor a 0 y menor a 100 kg.");
        return;
      }
    }

    // Paseo (solo si hay valores)
    if (isWalk(typeId)) {
      const dur =
        formData.duration_min !== "" ? Number(formData.duration_min) : null;
      const dist =
        formData.distance_m !== "" ? Number(formData.distance_m) : null;

      if (dur !== null && (isNaN(dur) || dur < 0)) {
        setError("La duración debe ser un número válido.");
        return;
      }
      if (dist !== null && (isNaN(dist) || dist < 0)) {
        setError("La distancia debe ser un número válido.");
        return;
      }
    }

    // Revisión final de errores individuales
    if (Object.values(fieldErrors).some((v) => v)) {
      setError("Por favor corrige los errores en el formulario.");
      return;
    }

    try {
      setSaving(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Sesión inválida.");

      const domicilio = formData.domicilio === "si";

      const eventData = {
        pet_id: petId,
        user_id: auth.user.id,
        e_type_id: typeId,
        ts: convertToISO(formData.event_datetime),
      };

      // DETALLES (solo clínicos)
      if (isClinical(typeId)) {
        eventData.details = { "En casa": domicilio };
      }

      // Descripción
      if (formData.e_description.trim()) {
        eventData.e_description = formData.e_description.trim();
      }

      // Clínica / vet
      if (isClinical(typeId)) {
        if (formData.comuna_id) {
          eventData.comuna_id = Number(formData.comuna_id);
        }
        if (!domicilio && formData.clinic_id) {
          eventData.clinic_id = formData.clinic_id;
        }
        if (formData.vet_id) {
          eventData.vet_id = formData.vet_id;
        }
      }

      // Medicación especial
      if (typeId === "medication_dose" && formData.dose_mg) {
        eventData.dose_mg = parseFloat(formData.dose_mg);
      }

      // Peso
      if (isWeight(typeId)) {
        eventData.var_weight = {
          value: parseFloat(formData.weight_value),
          date: new Date().toISOString().slice(0, 10),
        };
      }

      // Paseo
      if (isWalk(typeId)) {
        if (formData.duration_min !== "") {
          eventData.duration_min = Number(formData.duration_min);
        }
        if (formData.distance_m !== "") {
          eventData.distance_m = Number(formData.distance_m);
        }
      }

      // Cobro
      if (CHARGE_TYPES.includes(typeId)) {
        const chargeValue =
          formData.charge !== "" ? Number(formData.charge) : null;
        eventData.charge = chargeValue;
        eventData.currency_id =
          chargeValue && chargeValue > 0 ? formData.currency_id : null;
      }

      // INSERTAR O ACTUALIZAR
      let eventIdCreated = editingId;

      if (editingId) {
        const { error: updErr } = await supabase
          .schema("petcare")
          .from("event")
          .update(eventData)
          .eq("event_id", editingId);

        if (updErr) throw new Error(updErr.message);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .schema("petcare")
          .from("event")
          .insert(eventData)
          .select("event_id")
          .single();

        if (insErr) throw new Error(insErr.message);
        eventIdCreated = inserted.event_id;
      }

      // REGISTRO DE VACUNA
      if (!editingId && typeId === "vaccine_administered") {
        if (!formData.vaccine_id) {
          throw new Error("Debes seleccionar la vacuna aplicada.");
        }

        const vacc = {
          event_id: eventIdCreated,
          vaccine_id: Number(formData.vaccine_id),
          next_due_date: formData.next_dose_datetime
            ? new Date(formData.next_dose_datetime)
              .toISOString()
              .slice(0, 10)
            : null,
          vaccine_batch: formData.vaccine_batch || "",
          vaccine_dose_number: formData.vaccine_dose_number
            ? Number(formData.vaccine_dose_number)
            : null,
          vaccine_expiration_date: formData.vaccine_expiration_date || null,
        };

        const { error: veErr } = await supabase
          .schema("petcare")
          .from("vaccine_event")
          .insert(vacc);
        if (veErr) throw new Error(veErr.message);
      }

      // EVENTO FUTURO
      const requiresFuture =
        isClinical(typeId) &&
        FUTURE_CLINICAL_TYPES.includes(typeId) &&
        formData.next_dose_datetime;

      if (requiresFuture) {
        const future = {
          pet_id: petId,
          user_id: auth.user.id,
          e_type_id: typeId,
          ts: convertToISO(formData.next_dose_datetime),
          details: { "En casa": domicilio },
        };

        if (formData.comuna_id) {
          future.comuna_id = Number(formData.comuna_id);
        }
        if (!domicilio && formData.clinic_id) {
          future.clinic_id = formData.clinic_id;
        }
        if (formData.vet_id) {
          future.vet_id = formData.vet_id;
        }

        if (CHARGE_TYPES.includes(typeId)) {
          const chargeValue =
            formData.charge !== "" ? Number(formData.charge) : null;
          future.charge = chargeValue;
          future.currency_id =
            chargeValue && chargeValue > 0 ? formData.currency_id : null;
        }

        await supabase.schema("petcare").from("event").insert(future);
      }

      resetForm();
      setShowForm(false);
      await loadEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------
  // ELIMINAR EVENTO
  // -------------------------------

  const handleDelete = async (eventId) => {
    if (!confirm("¿Eliminar este evento?")) return;

    const { error: delErr } = await supabase
      .schema("petcare")
      .from("event")
      .delete()
      .eq("event_id", eventId);

    if (delErr) {
      alert(delErr.message);
      return;
    }

    loadEvents();
  };

  // -------------------------------
  // EDITAR EVENTO
  // -------------------------------

  const handleEdit = async (ev) => {
    try {
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

      if (regionId) {
        const { data: cmnList } = await supabase
          .schema("petcare")
          .from("comuna")
          .select("comuna_id, name")
          .eq("region_id", regionId);

        setComunas(cmnList || []);
      }

      // Recargar clínicas / vet
      if (ev.comuna_id && isClinical(ev.e_type_id)) {
        const [{ data: cls }, { data: vetsC }, { data: vetsClinic }] =
          await Promise.all([
            supabase
              .schema("petcare")
              .from("clinic")
              .select("clinic_id, name, address, phone")
              .eq("comuna_id", ev.comuna_id),

            supabase
              .schema("petcare")
              .from("vet")
              .select("vet_id, full_name, clinic_id")
              .eq("comuna_id", ev.comuna_id),

            supabase
              .schema("petcare")
              .from("vet")
              .select("vet_id, full_name")
              .eq("clinic_id", ev.clinic_id || ""),
          ]);

        setClinics(cls || []);
        setVetsByComuna(vetsC || []);
        setVetsByClinic(vetsClinic || []);
      }

      const enCasa = !!ev?.details?.["En casa"];

      setFormData({
        e_type_id: ev.e_type_id,
        event_datetime: ev.ts
          ? new Date(ev.ts).toISOString().slice(0, 16)
          : "",
        domicilio: enCasa ? "si" : "no",
        region_id: regionId,
        comuna_id: ev.comuna_id || "",
        clinic_id: enCasa ? "" : ev.clinic_id || "",
        vet_id: enCasa ? "" : ev.vet_id || "",
        e_description: ev.e_description || "",
        weight_value: ev.var_weight?.value || "",
        duration_min: ev.duration_min || "",
        distance_m: ev.distance_m || "",
        dose_mg: ev.dose_mg || "",
        charge: ev.charge ?? "",
        currency_id: ev.currency_id || "",
        next_dose_datetime: "",
        vaccine_id: "",
        vaccine_batch: "",
        vaccine_dose_number: "",
        vaccine_expiration_date: "",
        clinic_name: "",
        clinic_address: "",
        clinic_phone: "",
      });

      setFieldErrors({
        event_datetime: "",
        next_dose_datetime: "",
        charge: "",
        currency_id: "",
      });

      setEditingId(ev.event_id);
      setShowForm(true);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
    }
  };

  // -------------------------------
  // RENDER
  // -------------------------------

  if (loading) {
    return <div className="text-center py-8">Cargando historial...</div>;
  }

  return (
    <div>
      {/* ENCABEZADO */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Historial de Eventos</h3>

        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
            } else {
              setShowForm(true);
              resetForm();
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "+ Agregar Evento"}
        </button>
      </div>

      {/* ERROR GENERAL */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 p-3 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* FORMULARIO */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-6 bg-gray-50 border rounded-2xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tipo de evento */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Tipo de evento *
              </label>
              <select
                value={formData.e_type_id}
                onChange={(e) =>
                  setFormData({ ...formData, e_type_id: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white"
              >
                <option value="">Seleccionar...</option>
                {eventTypes.map((t) => (
                  <option key={t.event_type_id} value={t.event_type_id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Fecha y hora */}
            {formData.e_type_id && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Fecha y hora *
                </label>
                <input
                  type="datetime-local"
                  value={formData.event_datetime}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, event_datetime: val });
                    validateField("event_datetime", val);

                    if (formData.next_dose_datetime) {
                      validateField(
                        "next_dose_datetime",
                        formData.next_dose_datetime,
                        { event_datetime: val }
                      );
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg ${fieldErrors.event_datetime ? "border-red-500" : ""
                    }`}
                />
                {fieldErrors.event_datetime && (
                  <p className="text-red-600 text-sm">
                    {fieldErrors.event_datetime}
                  </p>
                )}
              </div>
            )}

            {/* Bloques según categoría */}
            {renderClinicalBlock()}
            {renderWeightBlock()}
            {renderWalkBlock()}

            {/* Descripción */}
            {formData.e_type_id && renderDescriptionBlock()}

            {/* Cobro */}
            {renderChargeBlock()}
          </div>

          {/* Botones */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || Object.values(fieldErrors).some((e) => e)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* LISTA DE EVENTOS */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No hay eventos registrados.
          </p>
        ) : (
          events.map((event) => (
            <div
              key={event.event_id}
              className="border rounded-2xl p-4 hover:shadow transition"
            >
              <div className="flex justify-between">
                <div className="flex-1">
                  {/* Cabecera */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">
                      {getEventIcon(event.e_type_id)}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">
                          {event.event_type_catalog?.display_name ||
                            event.e_type_id}
                        </h4>

                        {new Date(event.ts) > new Date() ? (
                          <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-700">
                            Programado
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">
                            Realizado
                          </span>
                        )}
                      </div>

                      <p className="text-gray-500 text-sm">
                        {formatEventDateTime(event.ts)}
                      </p>
                    </div>
                  </div>

                  {/* BLOQUE DETALLES */}
                  <div className="bg-gray-100 p-3 rounded-lg space-y-1 text-sm">
                    {/* Clínica / domicilio */}
                    {event.clinic?.name && (
                      <p className="font-medium">🏥 {event.clinic.name}</p>
                    )}

                    {/* Veterinario */}
                    {event.vet?.full_name && (
                      <p>👨‍⚕️ {event.vet.full_name}</p>
                    )}

                    {/* Dirección */}
                    {event.clinic?.address && (
                      <p>📍 {event.clinic.address}</p>
                    )}

                    {/* Teléfono */}
                    {event.clinic?.phone && (
                      <p>📞 {event.clinic.phone}</p>
                    )}

                    {/* En casa */}
                    {event.details?.["En casa"] && <p>📍 En casa</p>}

                    {/* Peso */}
                    {event.var_weight && (
                      <p>⚖️ Peso: {event.var_weight.value} kg</p>
                    )}

                    {/* Medicación */}
                    {event.dose_mg && <p>💊 Dosis: {event.dose_mg} mg</p>}

                    {/* Paseo */}
                    {event.duration_min && (
                      <p>⏱️ Duración: {event.duration_min} min</p>
                    )}
                    {event.distance_m && (
                      <p>📏 Distancia: {event.distance_m} m</p>
                    )}

                    {/* Cobro */}
                    {event.charge && (
                      <p>
                        💵 {event.charge}{" "}
                        {event.currency_id ? event.currency_id : ""}
                      </p>
                    )}
                  </div>

                  {/* BLOQUE DESCRIPCIÓN SEPARADO */}
                  {event.e_description && (
                    <div className="mt-3 bg-gray-100 p-3 rounded-lg">
                      <p className="font-semibold mb-1">Descripción</p>
                      <p className="text-gray-700 whitespace-pre-line">
                        {event.e_description}
                      </p>
                    </div>
                  )}
                </div>

                {/* ACCIONES */}
                <div className="flex gap-3 ml-4">
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

