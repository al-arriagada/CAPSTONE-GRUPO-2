// src/pages/caregiver/ViewReportPage.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient.js";

// Helper simple para obtener YYYY-MM-DD
const getDateString = (date = new Date()) => date.toISOString().split('T')[0];

// Helper para formato largo de fecha
const formatLongDate = (dateString) => {
    if (!dateString) return "Fecha desconocida";
    // Asegura que interpretemos la fecha correctamente (ej: YYYY-MM-DD)
    const date = new Date(dateString + 'T00:00:00'); // Añade hora para evitar problemas de zona horaria
     return date.toLocaleDateString("es-CL", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
};

// Helper para formato corto de hora/fecha
const formatShortDateTime = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("es-CL", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true, // Usa formato AM/PM si prefieres
    }).replace(',', ''); // Quita coma a veces añadida
};


export default function ViewReportPage() {
  // Asumimos que la ruta es /caregiver/reportes/ver/:petId/:reportDate
  // Si usas reportId, ajusta useParams y la lógica de carga
  const { petId, reportDate } = useParams(); 
  const { user } = useAuth(); // Podría ser útil para validar permisos

  const [petName, setPetName] = useState("Mascota");
  const [reportSummary, setReportSummary] = useState({ completed: 0, omitted: 0, rescheduled: 0 });
  const [activityDetails, setActivityDetails] = useState([]); // Lista de { routine, alert }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !petId || !reportDate) {
        setError("Faltan datos para cargar el reporte.");
        setLoading(false);
        return;
    };

    const loadReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Obtener nombre de la mascota
        const { data: petData, error: petError } = await supabase
            .schema("petcare")
            .from("pet")
            .select("name")
            .eq("pet_id", petId)
            .maybeSingle();
        if (petError) throw petError;
        if (petData) setPetName(petData.name);

        // 2. Obtener las rutinas aplicables a esa fecha 
        //    (Simplificado: asume diarias, ignora rrule)
        const { data: routines, error: routineError } = await supabase
            .schema("petcare")
            .from("routine")
            .select("routine_id, routine_type_id, time_local, title, description")
            .eq("pet_id", petId)
            .eq("active", true)
            .order("time_local", { ascending: true });
        if (routineError) throw routineError;
        if (!routines || routines.length === 0) {
            setLoading(false);
            return; // No hay rutinas, no hay reporte que mostrar
        }

        // 3. Obtener los 'alert' correspondientes a esas rutinas para la fecha del reporte
        const routineIds = routines.map(r => r.routine_id);
        const reportDateStart = `${reportDate}T00:00:00.000Z`;
        const reportDateEnd = `${reportDate}T23:59:59.999Z`;

        const { data: alerts, error: alertError } = await supabase
            .schema("petcare")
            .from("alert")
            .select("alert_id, routine_id, status_id, notes, completed_at, completed_by") // Incluye completed_at
            .in("routine_id", routineIds)
            // Busca alerts cuya fecha programada (o creación?) caiga en el día del reporte
            .gte("scheduled_at", reportDateStart) // Ajusta si usas 'created_at' para filtrar el día
            .lte("scheduled_at", reportDateEnd);
        if (alertError) throw alertError;

        // Mapea alerts por routine_id para fácil acceso
        const alertsMap = (alerts || []).reduce((map, alert) => {
            map[alert.routine_id] = alert;
            return map;
        }, {});

        // 4. Combinar rutinas y alerts
        const details = routines.map(routine => ({
            routine: routine,
            alert: alertsMap[routine.routine_id] || { status_id: 'pending' } // Asume pendiente si no hay alert
        }));
        setActivityDetails(details);

        // 5. Calcular Resumen directamente desde los alerts encontrados
        const summary = (alerts || []).reduce((acc, alert) => {
             if (alert.status_id === 'completed') acc.completed++;
             else if (alert.status_id === 'omitted') acc.omitted++;
             // else if (alert.status_id === 'rescheduled') acc.rescheduled++; 
             return acc;
         }, { completed: 0, omitted: 0, rescheduled: 0 });
         setReportSummary(summary);

      } catch (e) {
        console.error("Error loading report details:", e);
        setError("No se pudieron cargar los detalles del reporte.");
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [user, petId, reportDate]);

  const totalActivities = reportSummary.completed + reportSummary.omitted + reportSummary.rescheduled;
  const completionRate = totalActivities > 0 ? Math.round((reportSummary.completed / totalActivities) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
       <Link
        to="/caregiver/reportes" // Vuelve a la lista de reportes
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
        Volver
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Reporte de Rutinas
        </h1>
        <p className="mt-1 text-gray-500">
          Para {petName} • {formatLongDate(reportDate)}
        </p>
      </header>

      {loading && <div className="text-center py-10">Cargando reporte...</div>}
      {error && <div className="text-center py-10 text-red-600">Error: {error}</div>}

      {!loading && !error && activityDetails.length === 0 && (
          <div className="text-center py-10 text-gray-500">No se encontraron actividades para este reporte.</div>
      )}

      {!loading && !error && activityDetails.length > 0 && (
        <div className="space-y-6">
          {/* Resumen del Día */}
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Resumen del Día 
                {totalActivities > 0 && <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">{completionRate}% Cumplimiento</span>}
            </h3>
            <p className="text-sm text-gray-500 mb-4">Actividades programadas para {petName} el día de hoy</p>
            <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-2xl font-bold text-green-600">{reportSummary.completed}</p>
                    <p className="text-xs text-gray-500">Completadas</p>
                </div>
                <div>
                    <p className="text-2xl font-bold text-red-600">{reportSummary.omitted}</p>
                    <p className="text-xs text-gray-500">Omitidas</p>
                </div>
                 <div>
                    <p className="text-2xl font-bold text-gray-600">{reportSummary.rescheduled}</p>
                    <p className="text-xs text-gray-500">Reagendadas</p>
                </div>
            </div>
          </div>
          
          {/* Detalle de Actividades */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Detalle de Actividades</h3>
            <div className="space-y-4">
              {activityDetails.map(({ routine, alert }) => (
                <ReportActivityCard key={routine.routine_id} routine={routine} alert={alert} />
              ))}
            </div>
          </div>

           {/* Aquí podrías mostrar las notas generales si tuvieras la tabla daily_care_report */}
           {/* <div className="border-t pt-4">
               <h3 className="text-lg font-semibold text-gray-800 mb-2">Notas del Cuidador</h3>
               <p className="text-sm text-gray-600 whitespace-pre-wrap">{report?.general_notes || "No hay notas generales."}</p>
           </div> 
           */}

        </div>
      )}
    </div>
  );
}


/* ----------------------- Helper: ReportActivityCard ----------------------- */
// Muestra el detalle de una actividad en el reporte
function ReportActivityCard({ routine, alert }) {
  const status = alert?.status_id || 'pending'; // Default a pendiente si no hay alert
  const isCompleted = status === 'completed';
  const isOmitted = status === 'omitted';
  const notes = alert?.notes || '';
  // const rating = alert?.rating; // Si tuvieras rating en 'alert'

  // Iconos y Títulos (igual que en CreateReportPage)
  const getIcon = (type) => {
    if (type === 'feeding') return '🍲';
    if (type === 'walking' || type === 'paseo') return '🚶';
    if (type === 'medication') return '💊';
    return '📋';
  }
  const getStatusText = (status) => {
    if (status === 'completed') return 'Completada';
    if (status === 'omitted') return 'Omitida';
    if (status === 'scheduled') return 'Programada'; // Si este es un estado posible en tus alerts
    return 'Pendiente';
  }
  const getStatusColor = (status) => {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    if (status === 'omitted') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  }

  return (
    <div className={`p-4 rounded-lg border ${
      isCompleted ? 'border-green-200' : isOmitted ? 'border-red-200' : 'border-gray-200'
    } bg-white`}>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getIcon(routine.routine_type_id)}</span>
          <h4 className="font-semibold text-gray-800">{routine.title || routine.routine_type_id}</h4>
          {isCompleted && <span className="text-green-600">✓</span>}
          {isOmitted && <span className="text-red-600">✕</span>}
        </div>
        <div className="flex items-center gap-2 text-sm">
             <span className="text-gray-500">{routine.time_local ? routine.time_local.substring(0, 5) : 'N/A'}</span>
             <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
               {getStatusText(status)}
             </span>
        </div>
      </div>

      {/* Cuerpo con detalles */}
      <div className="pl-8 space-y-2"> {/* Indentación para detalles */}
        {/* Calificación (si aplica) */}
        {/* {isCompleted && rating && (
            <div className="flex items-center">
                <span className="text-sm font-medium text-gray-700 mr-2">Calificación:</span>
                <StarDisplay rating={rating} />
            </div>
        )} */}

        {/* Notas */}
        {notes && (
          <div className="p-2 rounded bg-gray-50 text-sm text-gray-700">
            {notes}
          </div>
        )}
         {!notes && !isCompleted && !isOmitted && (
             <p className="text-sm text-gray-400 italic">Sin completar aún.</p>
         )}

        {/* Fecha de Completado/Omisión */}
        {isCompleted && alert?.completed_at && (
           <p className="text-xs text-gray-500">Completada: {formatShortDateTime(alert.completed_at)}</p>
        )}
        {/* Podrías añadir fecha de omisión si la guardaras */}
        
      </div>
    </div>
  );
}

/* ----------------------- Helper: StarDisplay (Opcional) ----------------------- */
// Muestra estrellas (sin interacción)
function StarDisplay({ rating }) {
    const stars = [1, 2, 3, 4, 5];
    return (
        <div className="inline-flex">
            {stars.map(star => (
                <span key={star} className={`text-xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
            ))}
        </div>
    );
}