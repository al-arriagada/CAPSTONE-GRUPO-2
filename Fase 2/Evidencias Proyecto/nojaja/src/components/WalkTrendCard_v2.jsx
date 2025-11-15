// src/components/WalkTrendCard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function WalkTrendCard({ petId }) { // petId puede ser UUID o 'all'
  const { user } = useAuth();
  const [trendData, setTrendData] = useState({
    currentWalks: null,
    prevWalks: null,
    changePercentage: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWalkTrend = async () => {
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
          // --- LÓGICA 'TODAS' (CORREGIDA) ---
          console.log("Fetching walk trend for ALL user pets (Corrected Logic)");

          // --- 1. Definir rangos de fecha (ESTA SEMANA y SEMANA PASADA) ---
          const today = new Date(); // Usamos la fecha del cliente

          // Calcular inicio de ESTA semana (Lunes)
          const currentDayOfWeek = today.getDay(); // 0=Domingo, 1=Lunes,...
          const diffCurrent = today.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
          const weekStartCurrent = new Date(today.getFullYear(), today.getMonth(), diffCurrent);
          weekStartCurrent.setHours(0, 0, 0, 0); // Lunes a las 00:00

          // Calcular inicio de la semana PASADA (Lunes anterior)
          const weekStartPrev = new Date(weekStartCurrent);
          weekStartPrev.setDate(weekStartCurrent.getDate() - 7);
          const weekStartPrevStr = weekStartPrev.toISOString();

          // --- 2. Consultar 'alert' de las últimas 2 semanas ---
          const { data: alertsData, error: dbError } = await supabase
            .schema('petcare')
            .from('alert')
            .select(`
              scheduled_at,
              completed_at,
              routine!inner ( routine_type_id )
            `)
            .eq('user_id', user.id) // <-- FILTRO EXPLÍCITO POR USUARIO
            .eq('status_id', 'completed')
            .eq('routine.routine_type_id', 'walk') // <-- Filtra SOLO paseos
            .gte('scheduled_at', weekStartPrevStr) // Desde inicio de semana pasada
            .lte('scheduled_at', today.toISOString()); // Hasta ahora

          if (dbError) throw dbError;

          // --- 3. Calcular totales para CADA semana por separado ---
          let currentWalks = 0;
          let prevWalks = 0;

          (alertsData || []).forEach(alert => {
            const relevantDate = new Date(alert.completed_at || alert.scheduled_at);
            
            // Compara con el inicio de la semana actual
            if (relevantDate >= weekStartCurrent) {
              currentWalks++;
            } else {
              // Si es anterior, pertenece a la semana pasada
              prevWalks++;
            }
          });

          // --- 4. Calcular porcentaje ---
          let changePercentage = null;
          if (prevWalks > 0) {
            changePercentage = Math.round(((currentWalks - prevWalks) / prevWalks) * 1000) / 10;
          } else if (prevWalks === 0 && currentWalks > 0) {
            changePercentage = Infinity;
          }
          // Si prevWalks es null (nunca hubo datos), changePercentage queda null.
          
          setTrendData({ currentWalks, prevWalks: prevWalks, changePercentage });

        } else {
          // --- LÓGICA 'ESPECÍFICA' (sin cambios) ---
          const { data, error: dbError } = await supabase
            .schema('petcare')
            .from('v_walks_weekly_trend')
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
  }, [petId, user]);

  // --- Helper para formatear el cambio porcentual ---
  const renderChange = () => {
    const change = trendData.changePercentage;
    const prev = trendData.prevWalks;

    // Si no hay datos de la semana anterior (prevWalks es null o 0)
    if (prev === null || prev === 0) {
      if (trendData.currentWalks > 0) {
         return <span className="text-sm font-semibold text-green-600">↑ Nueva actividad</span>;
      }
      return <span className="text-sm text-gray-500">vs semana anterior</span>;
    }

    // Si hubo datos la semana anterior (prev > 0)
    if (change === null) { // Caso prev > 0 pero current = 0
        if (trendData.currentWalks === 0) {
             return <span className="text-sm font-semibold text-red-600">↓ -100% vs semana anterior</span>;
        }
        return <span className="text-sm text-gray-500">vs semana anterior</span>;
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
  if (!loading && !error && trendData.currentWalks === null) {
      return <NoDataState message="No hay datos de paseos." />;
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