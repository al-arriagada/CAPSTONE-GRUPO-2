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

export default function NewRoutineModal({ petId, onClose, onCreated }) {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [time, setTime] = useState(""); // "HH:mm"
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [freq, setFreq] = useState("daily");

  const [types, setTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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

  const buildRrule = () => {
    if (freq === "once") return null;
    let rule = `RRULE:FREQ=${freq.toUpperCase()}`;
    if (endDate) {
      const [y, m, d] = endDate.split("-").map(Number);
      const until = new Date(y, m - 1, d, 23, 59, 59);
      const yyyymmdd =
        until.getUTCFullYear().toString().padStart(4, "0") +
        (until.getUTCMonth() + 1).toString().padStart(2, "0") +
        until.getUTCDate().toString().padStart(2, "0");
      rule += `;UNTIL=${yyyymmdd}T235959Z`;
    }
    return rule;
  };

  const nextOccurrence = () => {
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    if (!user) return setErr("Sesión inválida.");
    if (!petId) return setErr("Falta petId.");
    if (!title.trim() || !typeId || !time) {
      return setErr("Completa título, tipo y hora.");
    }

    setSaving(true);
    try {
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
          time_local: time, // HH:mm
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

      setSaving(false);
      onCreated?.();
      onClose?.();
    } catch (e2) {
      console.error(e2);
      setErr(e2.message || "No se pudo crear la rutina.");
      setSaving(false);
    }
  };

  // ⬇️ Render con PORTAL para evitar quedar “debajo”
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-semibold">Nueva Rutina</h3>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-800"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Define la regla y programamos la primera alerta automáticamente.
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
                onChange={(e) => setFreq(e.target.value)}
              >
                {FREQS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>

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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enableAlerts}
                onChange={(e) => setEnableAlerts(e.target.checked)}
              />
              Recordatorios por email
            </label>
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
              {saving ? "Guardando…" : "Crear Rutina"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
