// src/pages/caregiver/ViewReportPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient.js";

// --- Helpers de Formato de Fecha ---
const formatLongDate = (dateString) => {
  if (!dateString) return "Fecha desconocida";
  const date = new Date(dateString);
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
  return date.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatShortDateTime = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString)
    .toLocaleString("es-CL", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", "");
};
// --- Fin Helpers ---

export default function ViewReportPage() {
  const { petId, reportDate } = useParams(); // /view/:petId/:reportDate
  const { user } = useAuth();
  const location = useLocation();

  const [petName, setPetName] = useState(location.state?.petName || "Mascota");
  const [activityDetails, setActivityDetails] = useState([]); // { routine, alert }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga datos del reporte: Rutinas + Alertas + Activity Logs
  useEffect(() => {
    if (!user || !petId || !reportDate) {
      setError("Faltan datos para cargar el reporte.");
      setLoading(false);
      return;
    }

    const loadReportData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Nombre de la mascota (si no viene en state)
        if (!location.state?.petName) {
          const { data: petData, error: petError } = await supabase
            .schema("petcare")
            .from("pet")
            .select("name")
            .eq("pet_id", petId)
            .maybeSingle();

          if (petError) throw petError;
          if (petData) setPetName(petData.name);
        }

        // 2. Rutinas activas de la mascota
        const { data: routines, error: routineError } = await supabase
          .schema("petcare")
          .from("routine")
          .select("routine_id, routine_type_id, time_local, title, description")
          .eq("pet_id", petId)
          .eq("active", true)
          .order("time_local", { ascending: true });

        if (routineError) throw routineError;
        if (!routines || routines.length === 0) {
          setActivityDetails([]);
          setLoading(false);
          return;
        }

        const routineIds = routines.map((r) => r.routine_id);

        // 3. Alertas de ese día para esas rutinas
        const reportDateStart = `${reportDate}T00:00:00.000Z`;
        const reportDateEnd = `${reportDate}T23:59:59.999Z`;

        const { data: alerts, error: alertError } = await supabase
          .schema("petcare")
          .from("alert")
          .select("alert_id, routine_id, status_id, notes, completed_at, scheduled_at")
          .in("routine_id", routineIds)
          .gte("scheduled_at", reportDateStart)
          .lte("scheduled_at", reportDateEnd);

        if (alertError) throw alertError;

        // 4. Logs del reporte (lo que el cuidador marcó ese día)
        const { data: logs, error: logError } = await supabase
          .schema("petcare")
          .from("activity_log")
          .select("routine_id, status_id, notes")
          .eq("pet_id", petId)
          .eq("activity_date", reportDate);

        if (logError) throw logError;

        // Maps para acceso rápido
        const alertsMap = new Map();
        (alerts || []).forEach((a) => alertsMap.set(a.routine_id, a));

        const logsMap = new Map();
        (logs || []).forEach((l) => logsMap.set(l.routine_id, l));

        // 5. Combinar rutinas + alert + log
        const details = routines.map((routine) => {
          const alert = alertsMap.get(routine.routine_id) || null;
          const log = logsMap.get(routine.routine_id) || null;

          // status base: primero log, luego alert, luego 'scheduled'
          let finalStatus = log?.status_id || alert?.status_id || "scheduled";
          // Mapeo: en el log usamos 'skipped', en alert usamos 'omitted'
          if (finalStatus === "skipped") finalStatus = "omitted";

          const finalNotes =
            log?.notes != null
              ? log.notes
              : alert?.notes != null
              ? alert.notes
              : "";

          const mergedAlert = {
            ...(alert || {}),
            // Log puede sobrescribir status y notas
            status_id: finalStatus,
            notes: finalNotes,
          };

          return {
            routine,
            alert: mergedAlert,
          };
        });

        setActivityDetails(details);
      } catch (e) {
        console.error("Error loading report details:", e);
        setError("No se pudieron cargar los detalles del reporte.");
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [user, petId, reportDate, location.state]);

  // Resumen
  const summary = useMemo(() => {
    return activityDetails.reduce(
      (acc, { alert }) => {
        const status = alert?.status_id;
        if (status === "completed") acc.completed++;
        else if (status === "omitted") acc.omitted++;
        return acc;
      },
      { completed: 0, omitted: 0, rescheduled: 0 }
    );
  }, [activityDetails]);

  const totalActivities =
    summary.completed + summary.omitted + summary.rescheduled;
  const completionRate =
    totalActivities > 0
      ? Math.round((summary.completed / totalActivities) * 100)
      : 0;

  // Hora del último completado (si existe)
  const lastSentTime = useMemo(() => {
    const timestamps = activityDetails
      .map((d) => d.alert?.completed_at)
      .filter(Boolean);
    if (timestamps.length === 0) return null;
    const maxDate = new Date(
      Math.max.apply(
        null,
        timestamps.map((ts) => new Date(ts))
      )
    );
    return formatShortDateTime(maxDate);
  }, [activityDetails]);

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/caregiver"
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
        Volver al Dashboard
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Último Reporte Enviado
        </h1>
        <p className="mt-1 text-gray-500">
          Para {petName} • {formatLongDate(reportDate)}
        </p>
      </header>

      {loading && <div className="text-center py-10">Cargando reporte...</div>}
      {error && (
        <div className="text-center py-10 text-red-600">Error: {error}</div>
      )}

      {!loading && !error && activityDetails.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No se encontraron actividades para este reporte.
        </div>
      )}

      {!loading && !error && activityDetails.length > 0 && (
        <div className="space-y-6">
          {/* Resumen del Día */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Resumen del Día
              {totalActivities > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {completionRate}% Cumplimiento
                </span>
              )}
            </h3>
            {lastSentTime && (
              <p className="text-sm text-gray-500 mb-4">
                Enviado el {formatLongDate(reportDate)}, {lastSentTime}
              </p>
            )}
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
                <p className="text-3xl font-bold text-red-600">
                  {summary.omitted}
                </p>
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

          {/* Detalle de Actividades */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
              Detalle de Actividades
            </h3>
            <div className="space-y-4">
              {activityDetails.map(({ routine, alert }) => (
                <ReportActivityCard
                  key={routine.routine_id}
                  routine={routine}
                  alert={alert}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-start pt-4 border-t border-gray-200">
            <Link
              to="/caregiver"
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Volver al Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------- Helper: ReportActivityCard (Solo Vista) ----------------------- */
function ReportActivityCard({ routine, alert }) {
  const status = alert?.status_id || "scheduled";
  const isCompleted = status === "completed";
  const isOmitted = status === "omitted";
  const notes = alert?.notes || "";

  const getIcon = (type) => {
    if (type === "feeding") return "🍲";
    if (type === "walking" || type === "paseo") return "🚶";
    if (type === "medication") return "💊";
    if (type === "training") return "🎓";
    return "📋";
  };
  const getStatusText = (status) => {
    if (status === "completed") return "Completada";
    if (status === "omitted") return "Omitida";
    return "Pendiente";
  };
  const getStatusColor = (status) => {
    if (status === "completed") return "bg-green-100 text-green-800";
    if (status === "omitted") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="p-4 rounded-lg border border-gray-200 bg-white">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getIcon(routine.routine_type_id)}</span>
          <h4 className="font-semibold text-gray-800">
            {routine.title || routine.routine_type_id}
          </h4>
          {isCompleted && <span className="text-green-600">✓</span>}
          {isOmitted && <span className="text-red-600">✕</span>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">
            {routine.time_local ? routine.time_local.substring(0, 5) : "N/A"}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
              status
            )}`}
          >
            {getStatusText(status)}
          </span>
        </div>
      </div>

      {/* Detalles si está completada u omitida */}
      {(isCompleted || isOmitted) && (
        <div className="pl-8 space-y-2">
          {notes && (
            <div className="p-3 rounded bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap break-words">
              {notes}
            </div>
          )}

          {isCompleted && alert?.completed_at && (
            <p className="text-xs text-gray-500">
              Completada: {formatShortDateTime(alert.completed_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
