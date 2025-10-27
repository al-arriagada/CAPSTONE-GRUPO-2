// src/components/WalkTrendCard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; // Asegúrate que la ruta sea correcta
import { useAuth } from '../context/AuthContext.jsx'; // Asegúrate que la ruta sea correcta

export default function WalkTrendCard({ petId }) { // petId puede ser UUID o 'all'
  const { user } = useAuth(); // Obtener el usuario
  const [trendData, setTrendData] = useState({
    currentWalks: null,
    prevWalks: null,
    changePercentage: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWalkTrend = async () => {
      // Necesitamos user para el caso 'all', y un petId válido (sea UUID o 'all')
      if (!user || !petId) {
        setLoading(false);
        setError(petId ? "Usuario no encontrado." : "Selecciona mascota o 'Todas'.");
        setTrendData({ currentWalks: null, prevWalks: null, changePercentage: null });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (petId === 'all') {
          // --- LÓGICA PARA 'TODAS' LAS MASCOTAS (CON FILTRO EXPLÍCITO) ---
          console.log("Fetching walk trend for ALL user pets with explicit user filter");

          const today = new Date();
          const twoWeeksAgo = new Date(today);
          twoWeeksAgo.setDate(today.getDate() - 14); // O 21 para margen
          const startDateStr = twoWeeksAgo.toISOString();
          const todayStr = today.toISOString();

          // Consulta directa a 'alert' con filtro explícito de usuario y tipo de rutina
          const { data: alertsData, error: dbError } = await supabase
            .schema('petcare')
            .from('alert') // Consulta la tabla base
            .select(`
              scheduled_at,
              completed_at,
              routine:routine_id ( routine_type_id )
            `)
            .eq('user_id', user.id) // <-- FILTRO EXPLÍCITO POR USUARIO
            .eq('status_id', 'completed')
            .eq('routine.routine_type_id', 'walk') // <-- Filtra paseos usando la relación
            .gte('scheduled_at', startDateStr) // Rango de fecha inicio
            .lte('scheduled_at', todayStr); // Rango de fecha fin

          if (dbError) throw dbError;

          // Agregación en JavaScript por semana ISO
          const weeklySums = (alertsData || [])
            .reduce((acc, alert) => {
              const relevantDate = new Date(alert.completed_at || alert.scheduled_at);
              const dayOfWeek = relevantDate.getUTCDay(); // 0=Domingo(UTC), 1=Lunes,...
              const diff = relevantDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
              const weekStart = new Date(Date.UTC(relevantDate.getUTCFullYear(), relevantDate.getUTCMonth(), diff));
              const weekStr = weekStart.toISOString().split('T')[0]; // Clave YYYY-MM-DD
              acc[weekStr] = (acc[weekStr] || 0) + 1;
              return acc;
            }, {});

          // Cálculo de Tendencia
          const sortedWeeks = Object.keys(weeklySums).sort().reverse();
          const currentWalks = sortedWeeks.length > 0 ? weeklySums[sortedWeeks[0]] : 0;
          const prevWalks = sortedWeeks.length > 1 ? weeklySums[sortedWeeks[1]] : null;
          let changePercentage = null;
          if (prevWalks !== null && prevWalks > 0) {
            changePercentage = Math.round(((currentWalks - prevWalks) / prevWalks) * 1000) / 10;
          } else if (prevWalks === 0 && currentWalks > 0) {
            changePercentage = Infinity;
          }
          setTrendData({ currentWalks, prevWalks, changePercentage });

        } else {
          // --- LÓGICA PARA MASCOTA ESPECÍFICA (Usa la vista) ---
          //console.log(`Fetching walk trend for petId: ${petId}`);
          const { data, error: dbError } = await supabase
            .schema('petcare')
            .from('v_walks_weekly_trend') // Usa la vista precalculada
            .select('week, walks_count, prev_walks, pct_walks_change')
            .eq('pet_id', petId)
            .order('week', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (dbError) throw dbError;

          if (data) {
            setTrendData({
              currentWalks: data.walks_count,
              prevWalks: data.prev_walks,
              changePercentage: data.pct_walks_change,
            });
          } else {
            setTrendData({ currentWalks: 0, prevWalks: null, changePercentage: null });
          }
        }
      } catch (err) {
        console.error("Error fetching walk trend:", err);
        setError("No se pudo cargar la tendencia de paseos.");
        setTrendData({ currentWalks: null, prevWalks: null, changePercentage: null });
      } finally {
        setLoading(false);
      }
    };

    fetchWalkTrend();
  }, [petId, user]); // Añadir 'user' a las dependencias

  // --- Helper para formatear el cambio porcentual ---
  const renderChange = () => {
    const change = trendData.changePercentage;
    const prev = trendData.prevWalks;

    if (prev === null) {
      if (trendData.currentWalks > 0) {
         return <span className="text-sm font-semibold text-green-600">↑ Nueva actividad</span>;
      }
      return <span className="text-sm text-gray-500">vs semana anterior</span>;
    }
    if (change === null) {
        if (prev > 0 && trendData.currentWalks === 0) {
             return <span className="text-sm font-semibold text-red-600">↓ -100% vs semana anterior</span>;
        }
        return <span className="text-sm text-gray-500">vs semana anterior</span>;
    }
     if (change === Infinity) {
        return <span className="text-sm font-semibold text-green-600">↑ Nueva actividad</span>;
    }

    const isPositive = change > 0;
    const isNegative = change < 0;
    const absChange = Math.abs(change);

    return (
      <span className={`text-sm font-semibold ${
        isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
      }`}>
        {isPositive ? '↑ +' : isNegative ? '↓ -' : ''}{absChange}% vs semana anterior
      </span>
    );
  };

  // --- Renderizado ---
  if (loading) {
    return <LoadingState />;
  }
  if (error) {
    return <ErrorState message={error} />;
  }
  // Si no hay datos y no hubo error
  if (!loading && !error && trendData.currentWalks === null && petId !== 'all') {
      return <NoDataState message="No hay datos de paseos para esta mascota." />;
  }
   if (!loading && !error && trendData.currentWalks === null && petId === 'all') {
      return <NoDataState message="No hay datos de paseos para tus mascotas." />;
  }


  const cardTitle = petId === 'all' ? "Paseos Semanales (Todas)" : "Paseos Semanales";

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h4 className="font-semibold mb-4 text-gray-700">{cardTitle}</h4>
      <div className="text-center">
        <p className="text-4xl font-bold mb-1">
          {trendData.currentWalks === null ? '--' : trendData.currentWalks}
        </p>
        <p className="text-gray-600 mb-2">
          {trendData.currentWalks === 1 ? 'paseo esta semana' : 'paseos esta semana'}
        </p>
        {renderChange()}
      </div>
    </div>
  );
}

// --- Componentes Helper (Opcional) ---
const LoadingState = () => (
 <div className="p-4 border rounded-lg bg-white text-center text-gray-500">Cargando tendencias...</div>
);

const ErrorState = ({ message }) => (
 <div className="p-4 border rounded-lg bg-red-50 text-center text-red-600">{message || "Error al cargar."}</div>
);

const NoDataState = ({ message }) => (
   <div className="p-4 border rounded-lg bg-white text-center text-gray-500">
     {message || "No hay datos disponibles."}
   </div>
);