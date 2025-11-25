// src/components/RoutineListItem.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

export default function RoutineListItem({
  routine,
  alert,
  onToggleActive,
  onEdit,
  onDelete,
  onRefresh,
  timeHHmm,
  ruleBadge
}) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const canComplete = alert && (alert.status_id === 'scheduled' || alert.status_id === 'sent');

  const handleComplete = async () => {
    // ... (tu lógica handleComplete sin cambios) ...
    if (!canComplete) return;
    setIsCompleting(true);
    const { error } = await supabase
      .schema('petcare')
      .from('alert')
      .update({ status_id: 'completed', completed_at: new Date().toISOString(), completed_by: user.id })
      .eq('alert_id', alert.alert_id);

    if (error) {
      alert(error.message);
    } else {
      onRefresh();
      window.dispatchEvent(new Event('alertsChanged'));
    }
    setIsCompleting(false);
    setIsExpanded(false);
  };

  return (
    <li className="flex flex-col rounded-xl border transition-all duration-200 bg-white"> {/* Agregué bg-white por si acaso */}

      {/* --- Fila Principal (Clickable) --- */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-gray-50 gap-4" // ⬅️ Cambio clave: flex-col en móvil, gap-4
        onClick={() => setIsExpanded(prev => !prev)}
      >
        {/* Info de la Rutina */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="text-2xl mt-1 sm:mt-0">🍽️</div> {/* Icono alineado arriba en móvil */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${!routine.active ? 'text-gray-400 line-through' : ''}`}>
                {routine.title || "Rutina"}
              </span>
              {ruleBadge(routine.rrule)}
            </div>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              <span>🕒</span>
              <span>{timeHHmm(routine.time_local)}</span>
            </div>
          </div>
        </div>

        {/* Botones de Acción (Editar/Borrar) */}
        {/* En móvil: ancho completo y justificados al final. En escritorio: auto. */}
        <div
          className="flex items-center justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`rounded-lg border px-3 py-2 text-sm flex-1 sm:flex-none flex justify-center ${ // Botones más grandes en móvil (flex-1)
              routine.active
                ? "border-blue-200 text-blue-700 bg-blue-50"
                : "border-slate-200 text-slate-600"
              }`}
            onClick={onToggleActive}
            title={routine.active ? "Desactivar Regla" : "Activar Regla"}
          >
            🔔
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-sm text-slate-700 flex-1 sm:flex-none flex justify-center"
            onClick={onEdit}
            title="Editar Regla"
          >
            ✏️
          </button>
          <button
            className="rounded-lg border px-3 py-2 text-sm text-red-600 border-red-200 flex-1 sm:flex-none flex justify-center"
            onClick={onDelete}
            title="Eliminar Regla"
          >
            🗑
          </button>
        </div>
      </div>

      {/* --- Panel Expandible --- */}
      {isExpanded && (
        <div className="p-4 border-t bg-gray-50/50">
          {/* ... (tu contenido expandible sin cambios) ... */}
          {canComplete ? (
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-700 mb-3">¿Completaste esta tarea hoy?</p>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full max-w-xs bg-black text-white py-2 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                ✓ <span>{isCompleting ? 'Completando...' : 'Marcar como Completada'}</span>
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center">
              {alert ? "Esta tarea ya fue completada hoy." : "No hay una alerta programada para esta rutina hoy."}
            </p>
          )}
        </div>
      )}
    </li>
  );
}