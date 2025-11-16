// src/pages/caregiver/CreateReportPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient.js";

// --- HELPER DE FECHA (Versión segura) ---
const getTodayDateString = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// --- HELPER DE RANGO DE FECHA (NUEVO) ---


const getTodayUTCRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0); // Inicio del día local (ej. 24 Oct 00:00:00 GTM-3)

  const end = new Date(start);
  end.setDate(end.getDate() + 1); // Inicio del día siguiente (ej. 25 Oct 00:00:00 GTM-3)

  // Convierte a strings ISO (UTC)
  return {
    startOfDayUTC: start.toISOString(), // (ej. 2025-10-24T03:00:00Z)
    endOfDayUTC: end.toISOString(), // (ej. 2025-10-25T03:00:00Z)
  };
};

export default function CreateReportPage() {
  const { petId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const petName = location.state?.petName || "Mascota";

  // 'activities' guarda las alertas de hoy con info de rutina
  const [activities, setActivities] = useState([]);
  const [activityChanges, setActivityChanges] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // --- Cargar Datos ---
  const loadData = useCallback(async () => {
    if (!user || !petId) return;
    setLoading(true);
    setError(null);
    setActivityChanges({});

    try {
      const todayString = getTodayDateString();
      const { startOfDayUTC, endOfDayUTC } = getTodayUTCRange();

      // 1. ALERTAS de hoy (tareas)
      const { data: todayAlerts, error: alertError } = await supabase
        .schema("petcare")
        .from("alert")
        .select(`
          alert_id,
          routine_id,
          title,
          status_id,
          scheduled_at,
          routine ( routine_type_id, time_local, description )
        `)
        .eq("pet_id", petId)
        .gte("scheduled_at", startOfDayUTC)
        .lt("scheduled_at", endOfDayUTC)
        .order("scheduled_at", { ascending: true });

      if (alertError) throw alertError;

      // 2. LOGS de hoy
      const { data: todayLogs, error: logError } = await supabase
        .schema("petcare")
        .from("activity_log")
        .select("log_id, routine_id, status_id, notes")
        .eq("pet_id", petId)
        .eq("activity_date", todayString);

      if (logError) throw logError;

      // 3. Mapear logs
      const logMap = new Map();
      for (const log of todayLogs || []) {
        logMap.set(log.routine_id, log);
      }

      // 4. Combinar Alertas + Logs
      const initialActivities = [];
      const initialChanges = {};

      for (const alert of todayAlerts || []) {
        if (!alert.routine) continue; // si la rutina fue borrada

        const log = logMap.get(alert.routine_id);

        initialActivities.push({
          routine_id: alert.routine_id,
          alert_id: alert.alert_id,
          // rutina
          routine_type_id: alert.routine.routine_type_id,
          time_local: alert.routine.time_local,
          description: alert.routine.description,
          // alerta
          title: alert.title,
        });

        // Estado inicial: prioriza log, sino alerta
        const baseStatus = log ? log.status_id : alert.status_id;
        // Normalizamos: si en la alerta está 'omitted', en la UI usamos 'skipped'
        const normalizedStatus =
          baseStatus === "omitted" ? "skipped" : baseStatus;

        initialChanges[alert.routine_id] = {
          status_id: normalizedStatus, // 'completed' | 'skipped' | null
          notes: log ? log.notes || "" : "",
        };
      }

      setActivities(initialActivities);
      setActivityChanges(initialChanges);
    } catch (e) {
      console.error("Error loading data:", e);
      setError("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, [user, petId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Manejar cambios de log (estado y notas) ---
  const handleLogChange = (routineId, field, value) => {
    setActivityChanges((prevChanges) => {
      const currentChange = prevChanges[routineId] || {};

      const newChangeData = {
        ...currentChange,
        [field]: value,
      };

      if (field === "status_id") {
        const completionTimestamp =
          currentChange.completed_at || new Date().toISOString();
        const completerId = currentChange.completed_by || user.id;

        if (value === "completed") {
          newChangeData.completed_at = completionTimestamp;
          newChangeData.completed_by = completerId;
          newChangeData.notes = currentChange.notes || "";
        } else if (value === "skipped") {
          newChangeData.completed_at = null;
          newChangeData.completed_by = null;
          newChangeData.notes = currentChange.notes || "";
        } else if (value === null || !value) {
          // estado "limpio" / pendiente
          newChangeData.completed_at = null;
          newChangeData.completed_by = null;
          newChangeData.notes = "";
          newChangeData.status_id = null;
        }
      }

      return {
        ...prevChanges,
        [routineId]: newChangeData,
      };
    });
  };

  // --- Enviar Reporte: guarda logs y actualiza alert.status_id ---
  const handleSubmitReport = async () => {
  if (!user || !petId) return;
  setSaving(true);
  setError(null);

  try {
    const todayString = getTodayDateString();
    const logsToUpsert = [];
    const alertsToUpdate = [];

    for (const activity of activities) {
      const routineId = activity.routine_id;
      const change = activityChanges[routineId];

      // Si no hay cambio o no se seleccionó estado, no se guarda nada
      if (!change || !change.status_id) {
        continue;
      }

      // 1️⃣ GUARDAR EN activity_log
      logsToUpsert.push({
        routine_id: routineId,
        activity_date: todayString,
        pet_id: petId,
        user_id: user.id,
        status_id: change.status_id,          // 'completed' | 'skipped'
        notes: change.notes || null,
      });

      // 2️⃣ ACTUALIZAR TABLA alert (status + completed_at + notes)
      alertsToUpdate.push({
        alert_id: activity.alert_id,
        status_id:
          change.status_id === "skipped" ? "omitted" : change.status_id, // mapeo a 'omitted'
        completed_at:
          change.status_id === "completed"
            ? new Date().toISOString()
            : null,
        notes: change.notes || null,          // 👈 AQUÍ agregamos las notas
      });
    }

    // Guardar logs
    if (logsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .schema("petcare")
        .from("activity_log")
        .upsert(logsToUpsert, {
          onConflict: "routine_id, activity_date",
        });

      if (upsertError) throw upsertError;
    }

    // Actualizar alerts (status + completed_at + notes)
    for (const alertUpdate of alertsToUpdate) {
      const { error: alertErr } = await supabase
        .schema("petcare")
        .from("alert")
        .update({
          status_id: alertUpdate.status_id,
          completed_at: alertUpdate.completed_at,
          notes: alertUpdate.notes,          // 👈 Y aquí lo usamos en el update
        })
        .eq("alert_id", alertUpdate.alert_id);

      if (alertErr) throw alertErr;
    }

    alert("¡Reporte guardado con éxito!");
    navigate(location.state?.from || "/caregiver");
  } catch (e) {
    console.error("Error saving log data:", e);
    setError(`No se pudieron guardar los cambios: ${e.message}`);
  } finally {
    setSaving(false);
  }
};


  // --- JSX ---
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to={location.state?.from || "/caregiver"}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
        Volver
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Registrar Actividades del Día
        </h1>
        <p className="mt-1 text-gray-500">
          Para {petName} •{" "}
          {new Date().toLocaleDateString("es-CL", { dateStyle: "long" })}
        </p>
      </header>

      {loading && <div className="text-center py-10">Cargando datos...</div>}
      {error && (
        <div className="text-center py-10 text-red-600">Error: {error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <SummaryCard activities={Object.values(activityChanges)} />

          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
            Detalle de Actividades
          </h3>
          {activities.length > 0 ? (
            activities.map((activity) => (
              <ActivityLogCard
                key={activity.routine_id}
                activity={activity}
                log={activityChanges[activity.routine_id] || {}}
                onChange={handleLogChange}
              />
            ))
          ) : (
            <p className="text-gray-500 italic">
              No hay actividades programadas para hoy.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(location.state?.from || "/caregiver")}
              disabled={saving}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={saving || activities.length === 0}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------- Helper: ActivityLogCard ----------------------- */
function ActivityLogCard({ activity, log, onChange }) {
  const currentStatus = log?.status_id;
  const isCompleted = currentStatus === "completed";
  const isOmitted = currentStatus === "skipped"; // UI usa 'skipped'
  const notes = log?.notes || "";

  const handleStatusChange = (newStatus) => {
    const finalStatus = currentStatus === newStatus ? null : newStatus;
    onChange(activity.routine_id, "status_id", finalStatus);
  };

  const getIcon = (type) => {
    if (type === "feeding") return "🍲";
    if (type === "walking" || type === "paseo") return "🚶";
    if (type === "medication") return "💊";
    if (type === "training") return "🎓";
    return "📋";
  };

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCompleted
          ? "bg-green-50 border-green-200"
          : isOmitted
          ? "bg-red-50 border-red-200"
          : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getIcon(activity.routine_type_id)}</span>
          <h4 className="font-semibold text-gray-800">{activity.title}</h4>
          <span className="text-sm text-gray-500">
            ({activity.time_local ? activity.time_local.substring(0, 5) : "N/A"}
            )
          </span>
        </div>
        <div className="flex gap-2">
          <button
            title="Completada"
            onClick={() => handleStatusChange("completed")}
            className={`p-1 rounded-full ${
              isCompleted
                ? "bg-green-600 text-white ring-2 ring-green-300"
                : "bg-gray-200 text-gray-500 hover:bg-green-100"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            title="Omitida"
            onClick={() => handleStatusChange("skipped")}
            className={`p-1 rounded-full ${
              isOmitted
                ? "bg-red-600 text-white ring-2 ring-red-300"
                : "bg-gray-200 text-gray-500 hover:bg-red-100"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {activity.description && (
        <p className="text-sm text-gray-500 mb-2">
          Instrucciones: {activity.description}
        </p>
      )}

      {isCompleted && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <textarea
            rows={2}
            placeholder="Notas..."
            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            value={notes}
            onChange={(e) =>
              onChange(activity.routine_id, "notes", e.target.value)
            }
          />
          {log?.completed_at && (
            <p className="text-xs text-gray-500">
              Completada:{" "}
              {new Date(log.completed_at).toLocaleString("es-CL", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
      )}

      {isOmitted && (
        <div className="mt-3 border-t pt-3">
          <textarea
            rows={2}
            placeholder="Motivo..."
            className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
            value={notes}
            onChange={(e) =>
              onChange(activity.routine_id, "notes", e.target.value)
            }
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------- Helper: SummaryCard ----------------------- */
function SummaryCard({ activities }) {
  const summary = useMemo(() => {
    return activities.reduce(
      (acc, log) => {
        const status = log?.status_id;
        if (status === "completed") acc.completed++;
        else if (status === "skipped") acc.omitted++;
        return acc;
      },
      { completed: 0, omitted: 0, rescheduled: 0 }
    );
  }, [activities]);

  const total = summary.completed + summary.omitted;
  const completionRate =
    total > 0 ? Math.round((summary.completed / total) * 100) : 0;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Resumen del Día
        {total > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
            {completionRate}% Cumplimiento
          </span>
        )}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Actividades programadas para hoy
      </p>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-3xl font-bold text-green-600">
            {summary.completed}
          </p>
          <p className="text-xs text-gray-500 uppercase font-semibold">
            Completadas
          </p>
        </div>
        <div>
          <p className="text-3xl font-bold text-red-600">{summary.omitted}</p>
          <p className="text-xs text-gray-500 uppercase font-semibold">
            Omitidas
          </p>
        </div>
        <div>
          <p className="text-3xl font-bold text-gray-600">
            {summary.rescheduled}
          </p>
          <p className="text-xs text-gray-500 uppercase font-semibold">
            Reagendadas
          </p>
        </div>
      </div>
    </div>
  );
}
