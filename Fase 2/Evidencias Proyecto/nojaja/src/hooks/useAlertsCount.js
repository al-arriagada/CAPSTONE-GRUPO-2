// src/hooks/useAlertsCount.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useAlertsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!user?.id) {
      setCount(0);
      setLoadingAlerts(false);
      return;
    }
    setLoadingAlerts(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { count, error } = await supabase
      .schema('petcare')
      .from('alert')
      .select('alert_id', { count: 'exact' }) // Solo contamos, no traemos datos
      .eq('user_id', user.id)
      .in('status_id', ['scheduled', 'sent'])
      .gte('scheduled_at', todayStart.toISOString())
      .lte('scheduled_at', todayEnd.toISOString());

    if (error) {
      console.error("Error fetching alerts count:", error);
      setCount(0);
    } else {
      setCount(count || 0);
    }
    setLoadingAlerts(false);
  }, [user]);

  const fetchCountRef = useRef(fetchCount);
  useEffect(() => {
    fetchCountRef.current = fetchCount;
  }, [fetchCount]);


  useEffect(() => {

    if (!user) {
      setLoadingAlerts(false);
      setCount(0);
      return;
    }

    fetchCount();
    window.addEventListener('alertsChanged', fetchCount);

    // Opcional: suscripción en tiempo real para que la campana se actualice
    // sin necesidad de recargar la página.
    const channel = supabase
      .channel('alerts-count-ch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'petcare', table: 'alert', filter: `user_id=eq.${user?.id}` },
        // Puedes refinar el filtro para solo eventos de 'scheduled' o 'sent'
        fetchCount
          // // Solo si es una alerta relevante para "hoy" y nuestro usuario
          // const alertDate = new Date(payload.new?.scheduled_at || payload.old?.scheduled_at);
          // const todayStart = new Date(); todayStart.setHours(0,0,0,0);
          // const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

          // if (alertDate >= todayStart && alertDate <= todayEnd) {
          //   fetchCount(); // Re-fetch completo para simplificar
          // }

      )
      .subscribe();

    return () => {
      window.removeEventListener('alertsChanged', fetchCount);
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchCount]);

  return { count, loadingAlerts };
}