// src/components/AlertsPopover.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom'; // Opcional, para linkear

// (Este hook es el mismo que usamos en el panel anterior)
function useTodayAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .schema('petcare')
      .from('alert')
      .select(`
        alert_id, title, body, scheduled_at,
        pet ( pet_id, name )
      `)
      .eq('user_id', user.id)
      .in('status_id', ['scheduled', 'sent']) // Solo pendientes
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString())
      .order('scheduled_at', { ascending: true });
    

      if (!error) setAlerts(data || []);
      setLoading(false);

  }, [user]);

  const fetchAlertsRef = useRef(fetchAlerts);
  useEffect(() => {
    fetchAlertsRef.current = fetchAlerts;
  }, [fetchAlerts]);


  useEffect(() => {
    if (!user) {
      setLoading(false);
      setAlerts([]);
      return;
    }

    fetchAlerts();
    
    const channel = supabase
      .channel('today-alerts-popover-ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'petcare', table: 'alert', filter: `user_id=eq.${user?.id}` },
        fetchAlerts
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAlerts]);

  return { alerts, loading, fetchAlerts };
}


// --- El Componente del Popover ---
export default function AlertsPopover({ onClose }) {
  const { user } = useAuth();
  const { alerts, loading, fetchAlerts } = useTodayAlerts();
  const [isCompleting, setIsCompleting] = useState(null); // ID de la alerta

  const handleComplete = async (alertId) => {
    setIsCompleting(alertId);
    await supabase
      .schema('petcare')
      .from('alert')
      .update({ status_id: 'completed', completed_at: new Date().toISOString(), completed_by: user.id })
      .eq('alert_id', alertId);
    
    // No necesitamos fetchAlerts() aquí porque el canal de Supabase
    // detectará el cambio y actualizará la lista automáticamente.
    // Si la actualización no es instantánea, descomenta la línea de abajo:
    await fetchAlerts();
    window.dispatchEvent(new Event('alertsChanged'));
    // if (onAlertCompleted) {
    //   onAlertCompleted();
    // }

    setIsCompleting(null);
  };

  // --- Lógica para tu maqueta ---
  const now = new Date();
  const overdueAlerts = alerts.filter(a => new Date(a.scheduled_at) < now);

  return (
    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-lg border z-[1001]">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-semibold text-lg">Rutinas Pendientes</h3>
        <span className="bg-gray-200 text-gray-800 text-sm font-bold px-2.5 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>
      
      {overdueAlerts.length > 0 && (
        <div className="p-4 border-b">
          <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded-md">
            {overdueAlerts.length} {overdueAlerts.length === 1 ? 'retrasada' : 'retrasadas'}
          </span>
        </div>
      )}

      {/* Lista */}
      <div className="max-h-96 overflow-y-auto p-2">
        {loading && <p className="p-4 text-sm text-gray-500">Cargando...</p>}
        {!loading && alerts.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No hay tareas pendientes por hoy.</p>
        )}
        
        <ul className="space-y-2">
          {alerts.map(alert => (
            <AlertItem 
              key={alert.alert_id} 
              alert={alert} 
              onComplete={handleComplete} 
              isCompleting={isCompleting === alert.alert_id}
            />
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-4 border-t text-center">
        <button className="text-sm font-medium text-gray-700 hover:text-black" disabled={alerts.length === 0}>
          Omitir todas
        </button>
      </div>
    </div>
  );
}
    
// --- El Componente de cada Tarea (basado en tu maqueta) ---
function AlertItem({ alert, onComplete, isCompleting }) {
  const time = new Date(alert.scheduled_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const isOverdue = new Date(alert.scheduled_at) < new Date();
  
  // Lógica de "Retrasada 10m" (simple)
  let overdueText = "Retrasada";
  if (isOverdue) {
    const diffMs = new Date() - new Date(alert.scheduled_at);
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) overdueText = `Retrasada ${diffMins}m`;
    else overdueText = `Retrasada ${Math.floor(diffMins/60)}h ${diffMins % 60}m`;
  }

  return (
    <li className="p-3 rounded-lg bg-pink-50 border border-pink-100">
      <div className="flex justify-between items-center">
        <span className="text-xl">🍽️</span> {/* TODO: Cambiar icono según 'routine_type' */}
        {isOverdue && <span className="text-xs font-bold text-red-600">{overdueText}</span>}
      </div>
      
      <h4 className="font-semibold mt-1">{alert.title}</h4>
      
      <div className="flex items-center gap-2 mt-1">
        <Link to={`/app/pet/${alert.pet.pet_id}`} className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full hover:bg-blue-200">
          {alert.pet.name}
        </Link>
        <span className="text-sm text-gray-500">🕒 {time}</span>
      </div>

      <p className="text-sm text-gray-700 mt-2">{alert.body || 'Completar tarea.'}</p>
      
      <div className="flex gap-2 mt-3">
        <button 
          onClick={() => onComplete(alert.alert_id)} 
          disabled={isCompleting}
          className="flex-1 bg-black text-white py-2 rounded-lg font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          ✓ <span>{isCompleting ? 'Completando...' : 'Completar'}</span>
        </button>
        <button 
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
          title="Omitir"
        >
          ✕
        </button>
      </div>
    </li>
  );
}