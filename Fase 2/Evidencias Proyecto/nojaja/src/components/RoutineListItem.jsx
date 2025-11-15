// src/components/RoutineListItem.jsx
import React, { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";

// Componente para un solo ítem en la lista de RoutinesPanel
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

  // La alerta es "completible" si existe Y está pendiente
  const canComplete = alert && (alert.status_id === 'scheduled' || alert.status_id === 'sent');

  const handleComplete = async () => {
    if (!canComplete) return;

    setIsCompleting(true);
    const { error } = await supabase
      .schema('petcare')
      .from('alert')
      .update({ status_id: 'completed', completed_at: new Date().toISOString(), completed_by: user.id })
      .eq('alert_id', alert.alert_id);
    
    if (error) {
      alert(error.message);
      setIsCompleting(false);
    } else {
      // Dispara la recarga en el padre y el evento global
      onRefresh(); 
      window.dispatchEvent(new Event('alertsChanged'));
      // No necesitamos setIsCompleting(false) porque el componente se recargará
      // y 'isCompleting' volverá a false por defecto.
      setIsExpanded(false); // Cierra el acordeón
    }
  };

  return (
    <li className="flex flex-col rounded-xl border transition-all duration-200">
      {/* --- Fila Principal (Clickable) --- */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">🍽️</div> {/* TODO: Icono dinámico */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${!routine.active ? 'text-gray-400 line-through' : ''}`}>
                {routine.title || "Rutina"}
              </span>
              {ruleBadge(routine.rrule)}
            </div>
            <div className="text-sm text-slate-500 flex items-center gap-1">
              <span>🕒</span>
              <span>{timeHHmm(routine.time_local)}</span>
            </div>
          </div>
        </div>

        {/* Botones de Acción (Editar/Borrar) */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            className={`rounded-lg border px-2.5 py-1.5 text-sm ${
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
            className="rounded-lg border px-2.5 py-1.5 text-sm text-slate-700"
            onClick={onEdit}
            title="Editar Regla"
          >
            ✏️
          </button>
          <button
            className="rounded-lg border px-2.5 py-1.5 text-sm text-red-600 border-red-200"
            onClick={onDelete}
            title="Eliminar Regla"
          >
            🗑
          </button>
        </div>
      </div>

      {/* --- Panel Expandible (Para Completar) --- */}
      {isExpanded && (
        <div className="p-4 border-t bg-gray-50/50">
          {canComplete ? (
            // Si hay una alerta PENDIENTE para hoy
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-700 mb-3">
                ¿Completaste esta tarea hoy?
              </p>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full max-w-xs bg-black text-white py-2 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                ✓ <span>{isCompleting ? 'Completando...' : 'Marcar como Completada'}</span>
              </button>
            </div>
          ) : (
            // Si NO hay alerta pendiente para hoy
            <p className="text-sm text-gray-500 text-center">
              {alert ? "Esta tarea ya fue completada hoy." : "No hay una alerta programada para esta rutina hoy."}
            </p>
          )}
        </div>
      )}
    </li>
  );
}