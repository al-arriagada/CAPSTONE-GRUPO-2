// src/components/CaregiverPayCard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js'; // Asegúrate que la ruta sea correcta
import { useAuth } from '../context/AuthContext.jsx'; // Asegúrate que la ruta sea correcta


// Helper para formatear a CLP
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '$--';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
};

export default function CaregiverPayCard({ petId }) { // petId puede ser UUID o 'all'
  const { user } = useAuth(); // Obtener el usuario (dueño)
  const [trendData, setTrendData] = useState({
    currentPay: null, // <-- Renombrado
    prevPay: null, // <-- Renombrado
    changePercentage: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPayTrend = async () => {
      if (!user || !petId) {
        setLoading(false);
        setError(petId ? "Usuario no encontrado." : "Selecciona mascota o 'Todas'.");
        setTrendData({ currentPay: null, prevPay: null, changePercentage: null });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // --- LÓGICA DE GASTOS (Adaptada) ---
        // Usaremos la misma lógica de agregación en JS para 'all' y para un 'petId' específico
        // para no depender de una vista que quizás no existe.

        const today = new Date();
        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(today.getDate() - 14); // Rango de 2 semanas
        const startDateStr = twoWeeksAgo.toISOString();
        const todayStr = today.toISOString();

        // 1. Empezar la consulta a la tabla 'expense' 
        let query = supabase
          .schema('petcare')
          .from('expense') // <-- CAMBIO: Tabla 'expense'
          .select('spent_at, amount') // <-- CAMBIO: Columnas 'spent_at' y 'amount'
          .eq('user_id', user.id) // Pagos hechos por el dueño logueado
          
       
          .eq('category_id', 'caregiver') // <-- CAMBIO: Filtrar por categoría
          
          .gte('spent_at', startDateStr) // Rango de fecha inicio
          .lte('spent_at', todayStr);   // Rango de fecha fin

        // 2. Añadir filtro de mascota si no es 'all'
        if (petId !== 'all') {
          query = query.eq('pet_id', petId); // 
        }

        // 3. Ejecutar la consulta
        const { data: expensesData, error: dbError } = await query;

        if (dbError) throw dbError;

        // 4. Agregación en JavaScript por semana ISO (SUMA en lugar de CONTAR)
        const weeklySums = (expensesData || [])
          .reduce((acc, expense) => {
            const relevantDate = new Date(expense.spent_at); // <-- CAMBIO: usa 'spent_at'
            const dayOfWeek = relevantDate.getUTCDay(); // 0=Domingo(UTC), 1=Lunes,...
            const diff = relevantDate.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const weekStart = new Date(Date.UTC(relevantDate.getUTCFullYear(), relevantDate.getUTCMonth(), diff));
            const weekStr = weekStart.toISOString().split('T')[0]; // Clave YYYY-MM-DD
            
            // --- 👇 LÓGICA DE SUMA ---
            acc[weekStr] = (acc[weekStr] || 0) + (expense.amount || 0);
            // --- 👆 LÓGICA DE SUMA ---
            
            return acc;
          }, {});

        // 5. Cálculo de Tendencia
        const sortedWeeks = Object.keys(weeklySums).sort().reverse();
        const currentPay = sortedWeeks.length > 0 ? weeklySums[sortedWeeks[0]] : 0;
        const prevPay = sortedWeeks.length > 1 ? weeklySums[sortedWeeks[1]] : null;
        let changePercentage = null;

        if (prevPay !== null && prevPay > 0) {
          changePercentage = Math.round(((currentPay - prevPay) / prevPay) * 1000) / 10;
        } else if (prevPay === 0 && currentPay > 0) {
          changePercentage = Infinity;
        }
        
        setTrendData({ currentPay, prevPay, changePercentage });

      } catch (err) {
        console.error("Error fetching pay trend:", err);
        setError("No se pudo cargar la tendencia de pagos.");
        setTrendData({ currentPay: null, prevPay: null, changePercentage: null });
      } finally {
        setLoading(false);
      }
    };

    fetchPayTrend();
  }, [petId, user]); // Depende de petId y user

  // --- Helper para formatear el cambio porcentual ---
  const renderChange = () => {
    const change = trendData.changePercentage;
    const prev = trendData.prevPay;

    if (prev === null) {
      if (trendData.currentPay > 0) {
        return <span className="text-sm font-semibold text-green-600">↑ Primeros gastos</span>;
      }
      return <span className="text-sm text-gray-500">vs semana anterior</span>;
    }
    if (change === null) {
        if (prev > 0 && trendData.currentPay === 0) {
            return <span className="text-sm font-semibold text-red-600">↓ -100% vs semana anterior</span>;
        }
        return <span className="text-sm text-gray-500">vs semana anterior</span>;
    }
    if (change === Infinity) {
        return <span className="text-sm font-semibold text-green-600">↑ Aumento de gastos</span>;
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
  if (!loading && !error && trendData.currentPay === null) {
     return <NoDataState message="No hay datos de pagos a cuidadores." />;
  }

  const cardTitle = petId === 'all' ? "Pagos a Cuidadores (Todas)" : "Pagos a Cuidadores";

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h4 className="font-semibold mb-4 text-gray-700">{cardTitle}</h4>
      <div className="text-center">
        <p className="text-4xl font-bold mb-1">
          {/* Formatea el valor como moneda */}
          {formatCurrency(trendData.currentPay)}
        </p>
        <p className="text-gray-600 mb-2">
          pagados esta semana
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