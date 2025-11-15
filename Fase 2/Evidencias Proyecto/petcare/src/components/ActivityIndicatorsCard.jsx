// src/components/ActivityIndicatorsCard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ActivityIndicatorsCard({ petId }) { // petId puede ser UUID o 'all'
  const { user } = useAuth();
  const [activityData, setActivityData] = useState({
    todayRoutines: 0,
    todayWalks: 0,
    weekRoutines: 0,
    weekWalks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivity = async () => {
      if (!user || !petId) {
        setLoading(false);
        setError(petId ? "Usuario no encontrado." : "Selecciona mascota o 'Todas'.");
        return;
      }
      setLoading(true);
      setError(null);

      try {
        // --- 1. Definir rangos de fecha ---
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        // Calcular inicio de la semana ISO (Lunes)
        // (Corregido para manejar 'today' sin mutarlo)
        const currentDayOfWeek = today.getDay(); // 0=Domingo, 1=Lunes,...
        const diff = today.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(today.getFullYear(), today.getMonth(), diff);
        weekStart.setHours(0, 0, 0, 0);
        
        // --- 2. Construir la consulta base ---
        let query = supabase
          .schema('petcare')
          .from('alert')
          .select(`
            scheduled_at,
            completed_at,
            routine:routine_id ( routine_type_id )
          `)
          .eq('user_id', user.id) // <-- FILTRO EXPLÍCITO DE USUARIO (SIEMPRE)
          .eq('status_id', 'completed')
          .gte('scheduled_at', weekStart.toISOString()) // Trae todo desde el inicio de la semana
          .lte('scheduled_at', todayEnd.toISOString()); // Hasta el fin de hoy

        // --- 3. Añadir filtro de mascota si no es 'all' ---
        if (petId !== 'all') {
          query = query.eq('pet_id', petId);
        }

        const { data: alertsData, error: dbError } = await query;
        if (dbError) throw dbError;

        // --- 4. Procesar resultados en JavaScript ---
        let todayRoutines = 0;
        let todayWalks = 0;
        let weekRoutines = 0;
        let weekWalks = 0;

        (alertsData || []).forEach(alert => {
          const alertDate = new Date(alert.completed_at || alert.scheduled_at);
          
          // Todas las alertas en 'alertsData' son de esta semana
          weekRoutines++;
          if (alert.routine?.routine_type_id === 'walk') {
            weekWalks++;
          }

          // Revisar si también son de "hoy"
          if (alertDate >= todayStart && alertDate <= todayEnd) {
            todayRoutines++;
            if (alert.routine?.routine_type_id === 'walk') {
              todayWalks++;
            }
          }
        });
        
        setActivityData({ todayRoutines, todayWalks, weekRoutines, weekWalks });

      } catch (err) {
        console.error("Error fetching activity data:", err);
        setError("No se pudo cargar la actividad.");
        setActivityData({ todayRoutines: 0, todayWalks: 0, weekRoutines: 0, weekWalks: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [petId, user]); // Recarga si cambia mascota o usuario

  // --- Renderizado ---
  if (loading) {
    return <LoadingState />;
  }
  if (error) {
    return <ErrorState message={error} />;
  }

  const cardTitle = petId === 'all' ? "Actividad Física (Todas)" : "Actividad Física";

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h4 className="font-semibold mb-4 text-gray-700">{cardTitle}</h4>
      <div className="grid grid-cols-2 gap-4 text-center">
        {/* Indicador Diario */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Hoy</p>
          <p className="text-2xl font-bold">{activityData.todayRoutines}</p>
          <p className="text-sm text-gray-600">Rutinas</p>
          <p className="text-lg font-semibold mt-2">{activityData.todayWalks}</p>
          <p className="text-xs text-gray-500">Paseos</p>
        </div>
        {/* Indicador Semanal */}
        <div>
          <p className="text-xs text-gray-500 uppercase mb-1">Esta Semana</p>
          <p className="text-2xl font-bold">{activityData.weekRoutines}</p>
          <p className="text-sm text-gray-600">Rutinas</p>
          <p className="text-lg font-semibold mt-2">{activityData.weekWalks}</p>
          <p className="text-xs text-gray-500">Paseos</p>
        </div>
      </div>
    </div>
  );
}

// --- Componentes Helper (Opcional) ---
const LoadingState = () => (
 <div className="p-4 border rounded-lg bg-white text-center text-gray-500">Cargando actividad...</div>
);

const ErrorState = ({ message }) => (
 <div className="p-4 border rounded-lg bg-red-50 text-center text-red-600">{message || "Error al cargar."}</div>
);