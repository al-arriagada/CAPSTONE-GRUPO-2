// src/pages/caregiver/CreateReportPage.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient.js";

// Helper simple para obtener YYYY-MM-DD
const getTodayDateString = () => new Date().toISOString().split('T')[0];
// Helper para combinar fecha y hora (ej: 2025-10-24 y 22:30:00 -> 2025-10-24T22:30:00)
const combineDateAndTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return new Date().toISOString(); 
    const time = timeStr.split(':');
    const date = new Date(dateStr);
    date.setHours(parseInt(time[0] || 0, 10), parseInt(time[1] || 0, 10), parseInt(time[2] || 0, 10), 0);
    return date.toISOString(); 
};


export default function CreateReportPage() {
  const { petId } = useParams(); 
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); 
  const petName = location.state?.petName || "Mascota"; 

  const [routineActivities, setRoutineActivities] = useState([]); // Rutinas del día
  const [alertDataMap, setAlertDataMap] = useState({}); // Datos de alerts existentes { routine_id: alert_data }
  const [activityChanges, setActivityChanges] = useState({}); // Cambios hechos por el cuidador { routine_id: changes }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const todayDate = getTodayDateString();
  const todayStart = `${todayDate}T00:00:00.000Z`;
  const todayEnd = `${todayDate}T23:59:59.999Z`;

  // --- Cargar Rutinas y Alerts Existentes ---
  const loadData = useCallback(async () => {
    if (!user || !petId) return;
    setLoading(true);
    setError(null);
    setActivityChanges({}); 
    try {
      // 1. Obtener las rutinas activas para esta mascota
      const { data: routines, error: routineError } = await supabase
        .schema("petcare")
        .from("routine") 
        .select("routine_id, routine_type_id, time_local, title, description") 
        .eq("pet_id", petId)
        .eq("active", true) 
        .order("time_local", { ascending: true });

      if (routineError) throw routineError;
      setRoutineActivities(routines || []);

      // 2. Buscar alerts existentes para estas rutinas programados para HOY
      const routineIds = routines?.map(r => r.routine_id) || [];
      if (routineIds.length > 0) {
          const { data: alerts, error: alertError } = await supabase
              .schema("petcare")
              .from("alert") 
              .select("alert_id, routine_id, status_id, notes, completed_at, completed_by") 
              .in("routine_id", routineIds)
              .gte("scheduled_at", todayStart) 
              .lte("scheduled_at", todayEnd);   

          if (alertError) throw alertError;

          // Mapea los alerts por routine_id
          const alertsMap = (alerts || []).reduce((map, alert) => {
              map[alert.routine_id] = alert;
              return map;
          }, {});
          setAlertDataMap(alertsMap);

          // Inicializa los cambios locales con los datos existentes
          const initialChanges = {};
           for (const routineId in alertsMap) {
               const alert = alertsMap[routineId];
               initialChanges[routineId] = {
                   alert_id: alert.alert_id, 
                   status: alert.status_id, 
                   notes: alert.notes || '',
                   // rating: alert.rating || 0, // <-- ELIMINADO
                   completed_at: alert.completed_at, 
                   completed_by: alert.completed_by, 
               };
           }
           setActivityChanges(initialChanges);
      }
    } catch (e) {
      console.error("Error loading report data:", e);
      setError("No se pudieron cargar los datos del reporte.");
    } finally {
      setLoading(false);
    }
  }, [user, petId, todayDate, todayStart, todayEnd]); 

  useEffect(() => {
    loadData();
  }, [loadData]); 

  // --- Manejar Cambios en los Logs ---
  const handleLogChange = (routineId, field, value) => {
    setActivityChanges(prevChanges => {
        const currentChange = prevChanges[routineId] || {};
        const existingAlert = alertDataMap[routineId]; 

        // Prepara los nuevos cambios
        const newChangeData = {
            ...currentChange,
            alert_id: currentChange.alert_id || existingAlert?.alert_id, 
            [field]: value,
        };

        // Lógica adicional al cambiar el status
        if (field === 'status') {
            const completionTimestamp = currentChange.completed_at || existingAlert?.completed_at || new Date().toISOString();
            const completerId = currentChange.completed_by || existingAlert?.completed_by || user.id;

            if (value === 'completed') {
                newChangeData.completed_at = completionTimestamp; 
                newChangeData.completed_by = completerId; 
                // newChangeData.omission_reason = null; // Si tuvieras esta columna
            } else if (value === 'omitted' || value === null || value === 'scheduled') { 
                 newChangeData.completed_at = null;
                 newChangeData.completed_by = null;
                 if (value === null || value === 'scheduled') {
                    newChangeData.notes = currentChange.notes || existingAlert?.notes || ''; 
                 }
            }
        }
        
        return {
            ...prevChanges,
            [routineId]: newChangeData
        };
    });
  };

  // --- Enviar Reporte (Solo actualiza/crea Alerts) ---
  const handleSubmitReport = async () => {
     if (!user || !petId) return;
     setSaving(true);
     setError(null);
     try {
         // 1. Prepara los datos para 'alert' (upsert)
         const alertUpserts = [];
         
         for (const routine of routineActivities) {
             const routineId = routine.routine_id;
             const changes = activityChanges[routineId];
             const existingAlert = alertDataMap[routineId];

             // Si no hay cambios Y no había un alert existente, no hace nada
             if (!changes && !existingAlert) continue; 
             
             // Si hay cambios (el cuidador interactuó)
             if (changes) {
                 // Si el 'status' no es nulo (completado u omitido)
                 if (changes.status) { 
                      alertUpserts.push({
                         alert_id: changes.alert_id || existingAlert?.alert_id || undefined, 
                         pet_id: petId,
                         routine_id: routineId,
                         user_id: user.id, // El cuidador es el 'user_id' de la alerta
                         title: routine.title,
                         body: routine.description, // Copia la descripción de la rutina al cuerpo de la alerta
                         scheduled_at: combineDateAndTime(todayDate, routine.time_local), 
                         status_id: changes.status, // 'completed' o 'omitted'
                         notes: changes.notes || null, 
                         completed_at: changes.status === 'completed' ? (changes.completed_at || new Date().toISOString()) : null,
                         completed_by: changes.status === 'completed' ? (changes.completed_by || user.id) : null,
                         updated_at: new Date().toISOString() 
                         // rating: changes.rating || null, // <-- ELIMINADO
                     });
                 } else if (existingAlert) {
                      // Si el usuario desmarcó una actividad (status: null)
                      alertUpserts.push({
                         alert_id: existingAlert.alert_id,
                         status_id: 'scheduled', // Vuelve a 'scheduled'
                         notes: null,
                         completed_at: null,
                         completed_by: null,
                         updated_at: new Date().toISOString()
                         // rating: null // <-- ELIMINADO
                      });
                 }
             }
         }
        
         if (alertUpserts.length > 0) {
             console.log("Actualizando/Creando alerts:", alertUpserts);
             const { error: upsertError } = await supabase
                 .schema("petcare")
                 .from("alert")
                 .upsert(alertUpserts, { onConflict: 'alert_id' }); // Actualiza basado en alert_id
             
             if (upsertError) throw upsertError;
         } else {
             console.log("No hay cambios en los alerts para guardar.");
         }

         alert("Actividades actualizadas con éxito!");
         // 👇 CORREGIDO: Navega a la página de ver reporte
         navigate(`/caregiver/reportes/ver/${petId}/${todayDate}`, { state: { petName } });

     } catch (e) {
         console.error("Error saving activity logs:", e);
         setError(`No se pudieron guardar los cambios: ${e.message}`);
     } finally {
         setSaving(false);
     }
  };

  // --- JSX ---
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
       <Link
        to="/caregiver/reportes" // Vuelve a la lista de mascotas para reportar
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
        Volver
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Registrar Actividades del Día
        </h1>
        <p className="mt-1 text-gray-500">
          Para {petName} • {new Date().toLocaleDateString("es-CL", { dateStyle: 'long' })}
        </p>
      </header>

      {loading && <div className="text-center py-10">Cargando rutinas...</div>}
      {error && <div className="text-center py-10 text-red-600">Error: {error}</div>}

      {!loading && !error && (
        <div className="space-y-6">
          
          {/* Resumen del Día (Calculado dinámicamente) */}
          <SummaryCard activities={Object.values(activityChanges)} />

          {/* Lista de Actividades */}
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Detalle de Actividades</h3>
          {routineActivities.length > 0 ? (
            routineActivities.map(activity => (
              <ActivityLogCard 
                key={activity.routine_id} 
                activity={activity}
                // Combina datos del alert original con los cambios actuales
                log={{ ...(alertDataMap[activity.routine_id] || {}), ...(activityChanges[activity.routine_id] || {}) }} 
                onChange={handleLogChange} 
              />
            ))
          ) : (
            <p className="text-gray-500 italic">No hay rutinas programadas para esta mascota hoy.</p>
          )}
          
          {/* Botones de Acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
             <button
              type="button"
              onClick={() => navigate("/caregiver/reportes")} // Vuelve a la lista
              disabled={saving}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmitReport} // Solo guarda los logs
              disabled={saving || routineActivities.length === 0} 
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
  // Usa 'status' del estado local 'activityChanges' o 'status_id' de la BD
  const currentStatus = log?.status || log?.status_id; 
  const isCompleted = currentStatus === 'completed';
  const isOmitted = currentStatus === 'omitted';
  const notes = log?.notes || ''; // Razón de omisión también usa 'notes'

  const handleStatusChange = (newStatus) => {
    const finalStatus = currentStatus === newStatus ? null : newStatus; 
    onChange(activity.routine_id, 'status', finalStatus);
  };

  const getIcon = (type) => {
    if (type === 'feeding') return '🍲';
    if (type === 'walking' || type === 'paseo') return '🚶'; 
    if (type === 'medication') return '💊';
    if (type === 'training') return '🎓';
    return '📋'; // 'other' o default
  }

  return (
    <div className={`p-4 rounded-lg border ${
      isCompleted ? 'bg-green-50 border-green-200' : isOmitted ? 'bg-red-50 border-red-200' : 'bg-white'
    }`}>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
           <span className="text-xl">{getIcon(activity.routine_type_id)}</span>
           <h4 className="font-semibold text-gray-800">{activity.title || activity.routine_type_id}</h4>
           <span className="text-sm text-gray-500">({activity.time_local ? activity.time_local.substring(0, 5) : 'N/A'})</span>
        </div>
        <div className="flex gap-2">
           <button title="Completada" onClick={() => handleStatusChange('completed')} className={`p-1 rounded-full ${isCompleted ? 'bg-green-600 text-white ring-2 ring-green-300' : 'bg-gray-200 text-gray-500 hover:bg-green-100'}`}> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg> </button>
           <button title="Omitida" onClick={() => handleStatusChange('omitted')} className={`p-1 rounded-full ${isOmitted ? 'bg-red-600 text-white ring-2 ring-red-300' : 'bg-gray-200 text-gray-500 hover:bg-red-100'}`}> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg> </button>
        </div>
      </div>

      {/* Instrucciones */}
      {activity.description && <p className="text-sm text-gray-500 mb-2">Instrucciones: {activity.description}</p>}

      {/* Inputs Completado */}
      {isCompleted && (
          <div className="mt-3 space-y-2 border-t pt-3">
              {/* <StarRating value={log?.rating || 0} onChange={(rating) => onChange(activity.routine_id, 'rating', rating)} /> */}
              <textarea rows={2} placeholder="Notas (ej: comió bien, paseo corto...)" className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" value={notes} onChange={(e) => onChange(activity.routine_id, 'notes', e.target.value)} />
              {log?.completed_at && <p className="text-xs text-gray-500">Completada: {new Date(log.completed_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short'})}</p>}
          </div>
      )}

      {/* Inputs Omitido */}
       {isOmitted && (
          <div className="mt-3 border-t pt-3">
              <textarea rows={2} placeholder="Motivo por el cual se omitió..." className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" value={notes} onChange={(e) => onChange(activity.routine_id, 'notes', e.target.value)} />
          </div>
       )}
    </div>
  );
}

/* ----------------------- Helper: StarRating (Opcional) ----------------------- */
// function StarRating({ value, onChange }) { ... }


/* ----------------------- Helper: SummaryCard ----------------------- */
function SummaryCard({ activities }) {
    const summary = useMemo(() => {
        return activities.reduce((acc, log) => {
             const status = log?.status || log?.status_id;
             if (status === 'completed') acc.completed++;
             else if (status === 'omitted') acc.omitted++;
             return acc;
         }, { completed: 0, omitted: 0, rescheduled: 0 });
    }, [activities]);

    const total = summary.completed + summary.omitted + summary.rescheduled;
    const completionRate = total > 0 ? Math.round((summary.completed / total) * 100) : 0;

    return (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Resumen del Día 
                {total > 0 && <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">{completionRate}% Cumplimiento</span>}
            </h3>
            <p className="text-sm text-gray-500 mb-4">Actividades programadas para hoy</p>
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-3xl font-bold text-green-600">{summary.completed}</p>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Completadas</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-red-600">{summary.omitted}</p>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Omitidas</p>
                </div>
                 <div>
                    <p className="text-3xl font-bold text-gray-600">{summary.rescheduled || 0}</p>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Reagendadas</p>
                </div>
            </div>
        </div>
    );
}