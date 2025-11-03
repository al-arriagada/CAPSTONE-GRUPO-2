// src/components/NewRoutineModal.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

const FREQS = [
  { id: "daily", label: "Diaria" },
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensual" },
  { id: "once", label: "Una sola vez" },
];

const WEEKDAYS = [
  { id: "MO", label: "Lu" }, { id: "TU", label: "Ma" }, { id: "WE", label: "Mi" },
  { id: "TH", label: "Ju" }, { id: "FR", label: "Vi" }, { id: "SA", label: "Sá" },
  { id: "SU", label: "Do" },
];


export default function NewRoutineModal({ petId, onClose, onCreated, routineToEdit = null }) {
  const { user } = useAuth();
  
  // Definir si estamos en modo Edición
  const isEditMode = Boolean(routineToEdit);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [time, setTime] = useState("");
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [freq, setFreq] = useState("daily");
  const [selectedWeekdays, setSelectedWeekdays] = useState([]);

  const [types, setTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");




  // Cargar catálogo de tipos
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .schema("petcare")
        .from("routine_type_catalog")
        .select("routine_type_id, display_name")
        .order("display_name");
      if (!error) setTypes(data || []);
    })();
  }, []);

  // Rellenar formulario si es modo Edición
  useEffect(() => {
    if (isEditMode && routineToEdit) {
      setTitle(routineToEdit.title || "");
      setTypeId(routineToEdit.routine_type_id || "");
      setTime(routineToEdit.time_local || "");
      setActive(routineToEdit.active);
      
      const rrule = routineToEdit.rrule;
      if (!rrule) {
        setFreq("once");
      } else if (rrule.includes("FREQ=DAILY")) {
        setFreq("daily");
      } else if (rrule.includes("FREQ=WEEKLY")) {
        setFreq("weekly");
      } else if (rrule.includes("FREQ=MONTHLY")) {
        setFreq("monthly");
      }
      
      // Extraer 'UNTIL' (fecha de fin) del rrule si existe
      if (rrule && rrule.includes("UNTIL=")) {
        const untilPart = rrule.split('UNTIL=')[1];
        const yyyymmdd = untilPart.split('T')[0];
        if (yyyymmdd && yyyymmdd.length === 8) {
          const y = yyyymmdd.substring(0, 4);
          const m = yyyymmdd.substring(4, 6);
          const d = yyyymmdd.substring(6, 8);
          setEndDate(`${y}-${m}-${d}`);
        }
      } else {
        setEndDate("");
      }

      // Los campos 'description', 'startDate' y 'enableAlerts'
      // solo se usan al crear la primera alerta, así que los ocultamos
      // y deshabilitamos.
      setEnableAlerts(false);
    }
  }, [isEditMode, routineToEdit]);


  const handleWeekdayChange = (dayId) => {
    setSelectedWeekdays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId) // Deseleccionar
        : [...prev, dayId] // Seleccionar
    );
  };

  const buildRrule = () => {
    if (freq === "once") return null;
    
    let rule = `RRULE:FREQ=${freq.toUpperCase()}`;
    
    // Añadir BYDAY si es semanal y hay días seleccionados
    if (freq === "weekly" && selectedWeekdays.length > 0) {
      // Ordenar los días
      const orderedDays = WEEKDAYS.map(d => d.id).filter(id => selectedWeekdays.includes(id));
      rule += `;BYDAY=${orderedDays.join(',')}`;
    }
    
    // Añadir UNTIL si hay fecha de fin
    if (endDate) {
      const [y, m, d] = endDate.split("-").map(Number);
      const until = new Date(Date.UTC(y, m - 1, d, 23, 59, 59)); // Fecha en UTC
      const yyyymmdd =
        until.getUTCFullYear().toString().padStart(4, "0") +
        (until.getUTCMonth() + 1).toString().padStart(2, "0") +
        until.getUTCDate().toString().padStart(2, "0");
      rule += `;UNTIL=${yyyymmdd}T235959Z`;
    }
    
    return rule;
  };

  const nextOccurrence = () => {
    // ... (no cambia) ...
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    const [y, m, d] = (startDate || new Date().toISOString().slice(0, 10))
      .split("-")
      .map(Number);
    let dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    const now = new Date();
    if (dt <= now) {
      if (freq === "once") dt.setDate(dt.getDate() + 1);
      else if (freq === "daily") while (dt <= now) dt.setDate(dt.getDate() + 1);
      else if (freq === "weekly") while (dt <= now) dt.setDate(dt.getDate() + 7);
      else if (freq === "monthly") while (dt <= now) dt.setMonth(dt.getMonth() + 1);
    }
    return dt;
  };
  
  // Lógica de CREAR
  const handleCreate = async () => {
    const rrule = buildRrule();
    const firstAt = nextOccurrence();

    // 1) rutina
    const { data: routine, error: rErr } = await supabase
      .schema("petcare")
      .from("routine")
      .insert({
        pet_id: petId,
        routine_type_id: typeId,
        rrule: rrule,
        time_local: time,
        active,
        user_id: user.id,
        title: title.trim(),
      })
      .select()
      .single();
    if (rErr) throw rErr;

    // 2) primera alerta (email)
    if (enableAlerts) {
      const { error: aErr } = await supabase
        .schema("petcare")
        .from("alert")
        .insert({
          routine_id: routine.routine_id,
          pet_id: routine.pet_id,
          scheduled_at: firstAt.toISOString(),
          status_id: "scheduled",
          user_id: user.id,
          title: routine.title,
          body: description?.trim() || "",
          channels: ["email"],
        });
      if (aErr) throw aErr;
    }
  };
  
  // Lógica de ACTUALIZAR
  const handleUpdate = async () => {
    const rrule = buildRrule();
    
    const { error: rErr } = await supabase
      .schema("petcare")
      .from("routine")
      .update({
        routine_type_id: typeId,
        rrule: rrule,
        time_local: time,
        active,
        title: title.trim(),
      })
      .eq("routine_id", routineToEdit.routine_id);
      
    if (rErr) throw rErr;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!user) return setErr("Sesión inválida.");
    if (!petId) return setErr("Falta petId.");
    if (!title.trim() || !typeId || !time) {
      return setErr("Completa título, tipo y hora.");
    }
    
    // En modo edición, no se requiere 'startDate'
    if (!isEditMode && !startDate) {
      return setErr("Completa la fecha de inicio.");
    }

    setSaving(true);
    try {
      let createdNewAlert = false;
      // Decidir qué lógica ejecutar
      if (isEditMode) {
        await handleUpdate();
      } else {
        await handleCreate();

        if (enableAlerts) {
          createdNewAlert = true;
        }

      }

      setSaving(false);
      onCreated?.(); // Refresca la lista
      onClose?.();   // Cierra el modal
      
      if (createdNewAlert) {
        window.dispatchEvent(new Event('alertsChanged'));
      }


    } catch (e2) {
      console.error(e2);
      setErr(e2.message || "No se pudo guardar la rutina.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold">
            {isEditMode ? "Editar Rutina" : "Nueva Rutina"}
          </h3>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          {isEditMode 
            ? "Modifica los detalles de la regla de rutina."
            : "Define la regla y programamos la primera alerta automáticamente."
          }
        </p>

        {err && (
          <div className="mb-3 text-sm text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-lg">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Ej: Desayuno, Paseo matutino…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {!isEditMode && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Notas, instrucciones, dosis…"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo *</label>
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {types.map((t) => (
                  <option key={t.routine_type_id} value={t.routine_type_id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Frecuencia *</label>
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white"
                value={freq}
                onChange={(e) => {setFreq(e.target.value);
                  if (e.target.value !=='weekly') setSelectedWeekdays([]) 

                }}
              >
                {FREQS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

            {freq === 'weekly' && (
              <div className="pt-2">
                <label className="block text-sm font-medium mb-2">Repetir los días:</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(day => (
                    <button
                      type="button"
                      key={day.id}
                      onClick={() => handleWeekdayChange(day.id)}
                      className={`px-3 py-1.5 border rounded-full text-xs font-medium ${
                        selectedWeekdays.includes(day.id) 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                {selectedWeekdays.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">Selecciona al menos un día.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Hora *</label>
              <input
                type="time"
                className="w-full border rounded-lg px-3 py-2"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>

            {!isEditMode && (
              <div>
                <label className="block text-sm font-medium mb-1">Inicio *</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Fin (opcional)</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Rutina activa
            </label>
            
            {!isEditMode && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enableAlerts}
                  onChange={(e) => setEnableAlerts(e.target.checked)}
                />
                Recordatorios por email
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-white bg-black hover:bg-gray-800 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Guardando…" : (isEditMode ? "Guardar Cambios" : "Crear Rutina")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}