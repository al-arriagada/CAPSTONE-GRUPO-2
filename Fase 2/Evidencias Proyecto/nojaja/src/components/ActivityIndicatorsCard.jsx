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
        // --- Fechas para hoy y esta semana ---
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Calcular inicio de la semana ISO (Lunes)
        const dayOfWeek = today.getDay(); // 0=Domingo, 1=Lunes,... 6=Sábado
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajusta al Lunes
        const weekStart = new Date(today.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split('T')[0];


        // --- Construir Query Base ---
        let dailyQuery = supabase
          .schema('petcare')
          .from('v_activity_daily')
          .select('routines_done, walks_done')
          .eq('day', todayStr); // Solo hoy

        let weeklyQuery = supabase
          .schema('petcare')
          .from('v_activity_weekly')
          .select('routines_done, walks_done')
          .eq('week', weekStartStr); // Solo esta semana ISO


        // --- Aplicar Filtro (Mascota o Todas) ---
        if (petId === 'all') {
          // Asumimos RLS en vistas/tablas base para filtrar por usuario
          // Si no, necesitaríamos unir con 'pet' y filtrar user_id
          //console.log("Fetching activity for ALL user pets");
        } else {
          //console.log(`Fetching activity for petId: ${petId}`);
          dailyQuery = dailyQuery.eq('pet_id', petId);
          weeklyQuery = weeklyQuery.eq('pet_id', petId);
        }

        // --- Ejecutar Consultas ---
        const [dailyResult, weeklyResult] = await Promise.all([
          dailyQuery,
          weeklyQuery
        ]);

        if (dailyResult.error) throw dailyResult.error;
        if (weeklyResult.error) throw weeklyResult.error;

        // --- Procesar Resultados ---
        let todayRoutines = 0;
        let todayWalks = 0;
        let weekRoutines = 0;
        let weekWalks = 0;

        // Sumar datos diarios (si petId='all', data puede tener varias filas por mascota)
        if (dailyResult.data) {
          dailyResult.data.forEach(row => {
            todayRoutines += row.routines_done || 0;
            todayWalks += row.walks_done || 0;
          });
        }

        // Sumar datos semanales (igual si petId='all')
        if (weeklyResult.data) {
          weeklyResult.data.forEach(row => {
            weekRoutines += row.routines_done || 0;
            weekWalks += row.walks_done || 0;
          });
        }

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

// --- Componentes Helper (Opcional, puedes ponerlos al final o importarlos) ---
const LoadingState = () => (
  <div className="p-4 border rounded-lg bg-white text-center text-gray-500">Cargando actividad...</div>
);
const ErrorState = ({ message }) => (
 <div className="p-4 border rounded-lg bg-red-50 text-center text-red-600">{message || "Error al cargar."}</div>
);