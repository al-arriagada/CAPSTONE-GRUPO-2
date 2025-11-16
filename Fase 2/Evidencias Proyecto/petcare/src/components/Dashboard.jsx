// src/components/supr
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
          console.log("Fetching walk trend for ALL user pets (FIXED Inner Join)");

          const today = new Date();
          const twoWeeksAgo = new Date(today);
          twoWeeksAgo.setDate(today.getDate() - 14);
          const startDateStr = twoWeeksAgo.toISOString();
          const todayStr = today.toISOString();

          // --- ⬇️ ESTA ES LA CONSULTA CORREGIDA ⬇️ ---
          const { data: alertsData, error: dbError } = await supabase
            .schema('petcare')
            .from('alert')
            // 1. Añade '!inner' para forzar un INNER JOIN.
            //    Esto EXCLUYE alertas donde 'routine' es 'null'.
            .select(`
              scheduled_at,
              completed_at,
              routine!inner ( routine_type_id )
            `)
            .eq('user_id', user.id) // Filtra por usuario
            .eq('status_id', 'completed')
            .eq('routine.routine_type_id', 'walk') // 2. Ahora este filtro SÍ funciona
            .gte('scheduled_at', startDateStr)
            .lte('scheduled_at', todayStr);
          // --- ⬆️ FIN DE LA CONSULTA CORREGIDA ⬆️ ---

          if (dbError) throw dbError;

          // Agregación en JavaScript (Sin Cambios)
          const weeklySums = (alertsData || [])
            .reduce((acc, alert) => {
              const relevantDate = new Date(alert.completed_at || alert.scheduled_at);
              const dayOfWeek = relevantDate.getUTCDay();
              const diff = relevantDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
              const weekStart = new Date(Date.UTC(relevantDate.getUTCFullYear(), relevantDate.getUTCMonth(), diff));
              const weekStr = weekStart.toISOString().split('T')[0];
              acc[weekStr] = (acc[weekStr] || 0) + 1;
              return acc;
            }, {});

          // Cálculo de Tendencia (Sin Cambios)
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

  // --- Helper renderChange ---
  const renderChange = () => {
    const change = trendData.changePercentage;
    const prev = trendData.prevWalks;

    if (prev === null || prev === 0) {
      if (trendData.currentWalks > 0) {
         return <span className="text-sm font-semibold text-green-600">↑ Nueva actividad</span>;
      }
      return <span className="text-sm text-gray-500">vs semana anterior</span>;
    }
    if (change === null) {
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

// src/components/PetCard.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

const SPECIES = { dog: "Perro", cat: "Gato", other: "Otro" };
const SEX = { male: "Macho", female: "Hembra", unknown: "Desconocido" };

export default function PetCard({ pet }) {
  const {
    pet_id,
    name,
    species_id,
    breed,
    sex_id,
    birth_date,
    weight_kg,
    image_url,
    status_id, // --- 1. Asegúrate de recibir 'status_id' en el objeto 'pet' ---
  } = pet;

  // --- 2. Define la variable de estado ---
  const isDeceased = status_id === 'deceased';

  const navigate = useNavigate();
  const labelSpecies = SPECIES[species_id] ?? species_id;
  const labelSex = SEX[sex_id] ?? sex_id;

  // --- 3. Modifica 'openDetail' para no navegar si ha fallecido ---
  const openDetail = () => {
    if (isDeceased) return; // No hacer nada si está fallecido
    navigate(`/app/pets/${pet_id}`);
  };
  
  const stop = (e) => e.stopPropagation(); // evita que el click de los botones abra el detalle

  // --- 4. Define clases CSS condicionales ---
  const cardClassName = `
    rounded-2xl border bg-white shadow-sm transition
    ${isDeceased
      ? 'grayscale opacity-70' // Estilo fallecido
      : 'hover:shadow-md cursor-pointer' // Estilo normal
    }
  `;

  const linkClassName = `
    rounded-xl border px-3 py-1.5 text-sm
    ${isDeceased
      ? 'text-gray-400 bg-gray-50 pointer-events-none' // Estilo deshabilitado
      : 'hover:bg-gray-50' // Estilo normal
    }
  `;

  return (
    <div
      onClick={openDetail}
      role="button"
      tabIndex={isDeceased ? -1 : 0} // Deshabilitar navegación por teclado
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openDetail()}
      className={cardClassName} // Aplicar clases condicionales
    >
      {/* Imagen */}
      <div className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-gray-100">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            Sin foto
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {name}
            {/* --- 5. Añade etiqueta "(Fallecido)" --- */}
            {isDeceased && <span className="text-sm text-gray-500 ml-2">(Fallecido)</span>}
          </h3>
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {labelSpecies}
          </span>
        </div>

        {/* ... (tu <dl> con Raza, Sexo, etc. no cambia) ... */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
          {breed && (
            <>
              <dt className="col-span-1">Raza</dt>
              <dd className="col-span-1">{breed}</dd>
            </>
          )}
          <dt>Sexo</dt>
          <dd>{labelSex}</dd>
          {birth_date && (
            <>
              <dt>Nacimiento</dt>
              <dd>{new Date(birth_date).toLocaleDateString()}</dd>
            </>
          )}
          {weight_kg != null && (
            <>
              <dt>Peso</dt>
              <dd>{Number(weight_kg).toFixed(1)} kg</dd>
            </>
          )}
        </dl>

        {/* Acciones */}
        <div className="mt-4 flex gap-2">
          <Link
            to={`/app/pets/${pet_id}/eventlog`}
            onClick={stop}
            className={linkClassName} // Aplicar clases condicionales
            aria-disabled={isDeceased} // Para accesibilidad
            tabIndex={isDeceased ? -1 : 0} // Deshabilitar navegación por teclado
          >
            Ver eventos
          </Link>
          <Link
            to={`/app/pets/${pet_id}/diet`}
            onClick={stop}
            className={linkClassName} // Aplicar clases condicionales
            aria-disabled={isDeceased}
            tabIndex={isDeceased ? -1 : 0}
          >
            Ver alimentación
          </Link>
          <Link
            to={`/app/pets/${pet_id}/expense`}
            onClick={stop}
            className={linkClassName} // Aplicar clases condicionales
            aria-disabled={isDeceased}
            tabIndex={isDeceased ? -1 : 0}
          >
            Ver gastos
          </Link>
        </div>
      </div>
    </div>
  );
}