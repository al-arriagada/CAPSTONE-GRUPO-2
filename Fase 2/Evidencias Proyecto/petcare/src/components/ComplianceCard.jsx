// src/components/ComplianceCard.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

// Define el período a calcular (ej: últimos 7 días)
const COMPLIANCE_PERIOD_DAYS = 7;

export default function ComplianceCard({ petId }) { // petId can be UUID or 'all'
  const { user } = useAuth(); 
  const [complianceData, setComplianceData] = useState({
    averagePct: null,
    totalCompleted: 0,
    totalScheduled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCompliance = async () => {
      if (!user || !petId) {
        setLoading(false);
        setError(petId ? "Usuario no encontrado." : "Selecciona una mascota o 'Todas'.");
        setComplianceData({ averagePct: null, totalCompleted: 0, totalScheduled: 0 });
        return;
      }

      setLoading(true);
      setError(null);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - COMPLIANCE_PERIOD_DAYS);
      const startDateStr = startDate.toISOString().split('T')[0];

      try {
        let query = supabase
          .schema('petcare')
          .from('v_pet_compliance')
          .select('scheduled_cnt, completed_cnt, compliance_pct')
          .gte('day', startDateStr); 

        if (petId === 'all') {

          query = supabase
            .schema('petcare')
            .from('alert') // Consulta la tabla base
            .select('status_id')
            .eq('user_id', user.id) // Filtra explícitamente por usuario
            .gte('scheduled_at', startDate.toISOString()) // Filtra por fecha
            .lte('scheduled_at', new Date().toISOString()); // Hasta ahora
        } else {
          query = query.eq('pet_id', petId);
        }

        const { data, error: dbError } = await query;

        if (dbError) throw dbError;

        if (!data || data.length === 0) {
          setComplianceData({ averagePct: null, totalCompleted: 0, totalScheduled: 0 });
        } else {
          if (petId === 'all') {
             const totals = data.reduce((acc, alert) => {
                if (['scheduled', 'sent', 'completed', 'skipped'].includes(alert.status_id)) {
                   acc.totalScheduled += 1;
                }
                if (alert.status_id === 'completed') {
                   acc.totalCompleted += 1;
                }
                return acc;
             }, { totalScheduled: 0, totalCompleted: 0 });

             const overallPct = totals.totalScheduled > 0
                ? Math.round((totals.totalCompleted / totals.totalScheduled) * 100)
                : null;
             setComplianceData({ averagePct: overallPct, ...totals });

          } else { 
             const totalScheduled = data.reduce((sum, day) => sum + (day.scheduled_cnt || 0), 0);
             const totalCompleted = data.reduce((sum, day) => sum + (day.completed_cnt || 0), 0);
             const overallPct = totalScheduled > 0
                ? Math.round((totalCompleted / totalScheduled) * 100)
                : null;
             setComplianceData({ averagePct: overallPct, totalCompleted, totalScheduled });
          }
        }
      } catch (err) {
        console.error("Error fetching compliance data:", err);
        setError("No se pudo cargar el cumplimiento.");
        setComplianceData({ averagePct: null, totalCompleted: 0, totalScheduled: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchCompliance();
  }, [petId, user]);

  const { averagePct, totalCompleted, totalScheduled } = complianceData;

  
  if (loading) { /* ... */ }
  if (error) { /* ... */ }
  if (!loading && !error && (averagePct === null || totalScheduled === 0)) { /* ... */ }

  const cardTitle = petId === 'all'
    ? `Cumplimiento General (${COMPLIANCE_PERIOD_DAYS} días)`
    : `Cumplimiento (${COMPLIANCE_PERIOD_DAYS} días)`;


  // Renderizado principal de la tarjeta
  return (
    <div className="p-6 border rounded-2xl shadow-sm bg-white">
      <h4 className="text-lg font-semibold mb-3">{cardTitle}</h4>
      <div className="flex items-baseline justify-center gap-2 mb-2">
        <span className="text-5xl font-bold">{averagePct ?? '--'}%</span>
      </div>
      <p className="text-center text-gray-600 text-sm mb-4">
        {totalCompleted} de {totalScheduled} rutinas completadas
      </p>
      {/* Barra de Progreso */}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full"
          style={{ width: `${averagePct ?? 0}%` }} // Usa 0% si averagePct es null
        ></div>
      </div>
    </div>
  );
}


const LoadingState = () => (
  <div className="p-4 border rounded-lg bg-white text-center text-gray-500">Cargando cumplimiento...</div>
);


const ErrorState = ({ message }) => (
 <div className="p-4 border rounded-lg bg-red-50 text-center text-red-600">{message || "Error al cargar."}</div>
);


const NoDataState = () => (
   <div className="p-4 border rounded-lg bg-white text-center text-gray-500">
     No hay suficientes datos de rutinas completadas en los últimos 7 días.
   </div>
);