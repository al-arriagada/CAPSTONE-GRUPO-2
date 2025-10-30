// src/pages/caregiver/CaregiverHome.jsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient";
import AssignedPetCard from "../../components/caregiver/AssignedPetCard.jsx";

// --- HELPER DE FECHA (Versión segura) ---
const getTodayDateString = () => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`; 
};

// --- HELPER DE RANGO DE FECHA (NUEVO) ---
const getTodayUTCRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0); // Inicio del día local
  const end = new Date(start);
  end.setDate(end.getDate() + 1); // Inicio del día siguiente
  return {
    startOfDayUTC: start.toISOString(),
    endOfDayUTC: end.toISOString()
  };
};


export default function CaregiverHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("horario"); // Inicia en 'horario'
  const [invitacionesPendientes, setInvitacionesPendientes] = useState(0);
  
  // Estado para "Mascotas Asignadas"
  const [assignedPetsForDashboard, setAssignedPetsForDashboard] = useState([]);
  const [mascotasACargoCount, setMascotasACargoCount] = useState(0); // <-- El problema está aquí
  const [loadingAssignedPetsDashboard, setLoadingAssignedPetsDashboard] = useState(true);
  
  // Estado para "Reportes"
  const [petsForReports, setPetsForReports] = useState([]);
  const [loadingPetsForReports, setLoadingPetsForReports] = useState(true);

  // --- ESTADO para "Horario de Hoy" ---
  const [todayActivities, setTodayActivities] = useState([]);
  const [loadingTodayActivities, setLoadingTodayActivities] = useState(true);
  const [todayStats, setTodayStats] = useState({ completed: 0, total: 0 });
  // ------------------------------------

  const [error, setError] = useState(null); 
  
  // CORRECCIÓN DE LOOP: 'todayDate' ahora es estable
  const todayDate = useMemo(() => getTodayDateString(), []);

  const caregiverName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Cuidador";

  // --- Función para contar invitaciones pendientes ---
  const fetchPendingCount = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .select(null, { count: "exact", head: true })
      .eq("member_user_id", user.id)
      .eq("member_role_id", "caregiver")
      .eq("status", "pending");

    if (error) {
      console.error("Error al buscar conteo de invitaciones:", error);
    } else if (count !== null) {
      setInvitacionesPendientes(count);
    }
  }, [user]);

  // --- Función para buscar mascotas (Pestaña "Asignadas") ---
  const fetchAssignedPetsForDashboard = useCallback(async () => {
      if (!user) {
        setAssignedPetsForDashboard([]);
        setLoadingAssignedPetsDashboard(false);
        return;
      }
      setLoadingAssignedPetsDashboard(true);
      setError(null); 
      try {
          const { data: acceptedMembers, error: membersError } = await supabase
            .schema("petcare").from("pet_member").select("pet_id")
            .eq("member_user_id", user.id).eq("member_role_id", "caregiver").eq("status", "accepted");
          if (membersError) throw membersError;
          if (!acceptedMembers || acceptedMembers.length === 0) {
            setAssignedPetsForDashboard([]);
            setLoadingAssignedPetsDashboard(false);
            return;
          }
          const petIds = acceptedMembers.map(member => member.pet_id);

          const { data: petsData, error: petsError } = await supabase
            .schema("petcare").from("pet")
            .select(`
                pet_id, name, breed, birth_date, image_url,
                species_id, user_id, current_weight, 
                owner_profile: app_user!user_id ( user_id, full_name )
            `)
            .in("pet_id", petIds);
          if (petsError) throw petsError;
          if (!petsData) throw new Error("No pet details found for dashboard.");

          const ownerIds = petsData.map(pet => pet.user_id).filter(Boolean);
          let ownerPhones = {};
          if (ownerIds.length > 0) {
            const { data: piiData, error: piiError } = await supabase
              .schema("petcare").from("user_pii").select("user_id, phone").in("user_id", ownerIds);
            if (piiError) console.warn("Error fetching owner phones:", piiError);
            else if (piiData) ownerPhones = piiData.reduce((map, pii) => { map[pii.user_id] = pii.phone; return map; }, {});
          }

          const combinedPetsData = petsData.map(pet => ({
            ...pet,
            owner: {
                user_id: pet.owner_profile?.user_id,
                full_name: pet.owner_profile?.full_name,
                phone: ownerPhones[pet.user_id] || null
            }
          }));
          setAssignedPetsForDashboard(combinedPetsData);
          // --- LÍNEA ELIMINADA --- (ya no es necesario setear el count aquí)
          // setMascotasACargoCount(combinedPetsData.length || 0); 

      } catch (errorCatch) {
          console.error("Error fetching assigned pets for dashboard:", errorCatch);
          setError(errorCatch.message || "Error cargando mascotas.");
          setAssignedPetsForDashboard([]);
      } finally {
          setLoadingAssignedPetsDashboard(false);
      }
  }, [user]);

  // --- 👇 NUEVA FUNCIÓN SOLO PARA EL CONTADOR ---
  const fetchMascotasACargoCount = useCallback(async () => {
    if (!user) {
      setMascotasACargoCount(0);
      return;
    }
    try {
      // Consulta ligera que solo pide el conteo
      const { count, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select(null, { count: "exact", head: true }) // Pide solo el conteo
        .eq("member_user_id", user.id)
        .eq("member_role_id", "caregiver")
        .eq("status", "accepted"); // Solo cuenta las aceptadas

      if (error) {
        console.error("Error fetching pet count:", error);
        setMascotasACargoCount(0);
      } else {
        setMascotasACargoCount(count || 0);
      }
    } catch (e) {
      console.error("Error in fetchMascotasCount:", e);
      setMascotasACargoCount(0);
    }
  }, [user]);
  // --- 👆 FIN DE LA NUEVA FUNCIÓN ---

  // --- Función para buscar mascotas (Pestaña "Reportes") ---
  const fetchPetsForReports = useCallback(async () => {
    if (!user) {
        setPetsForReports([]);
        setLoadingPetsForReports(false);
        return;
    }
    setLoadingPetsForReports(true);
    setError(null);
    try {
        const { data: acceptedMembers, error: membersError } = await supabase
            .schema("petcare")
            .from("pet_member")
            .select("pet_id")
            .eq("member_user_id", user.id)
            .eq("member_role_id", "caregiver")
            .eq("status", "accepted");

        if (membersError) throw membersError;
        if (!acceptedMembers || acceptedMembers.length === 0) {
            setPetsForReports([]);
            setLoadingPetsForReports(false);
            return;
        }
        const petIds = acceptedMembers.map((member) => member.pet_id);

        const { data: petsData, error: petsError } = await supabase
            .schema("petcare")
            .from("pet")
            .select(
                `
                pet_id, name, image_url,
                owner_profile: app_user!user_id ( full_name )
                `
            )
            .in("pet_id", petIds);

        if (petsError) throw petsError;
        if (!petsData) throw new Error("No se encontraron detalles de mascotas para reportes.");

        const { data: existingLogs, error: logsError } = await supabase
            .schema("petcare")
            .from("activity_log")
            .select("pet_id")
            .in("pet_id", petIds)
            .eq("activity_date", todayDate)
            .in("status_id", ["completed", "skipped"]);

        let reportsMap = new Set();
        if (logsError) {
            console.warn("Error al buscar reportes existentes en 'activity_log':", logsError);
        } else if (existingLogs) {
            reportsMap = new Set(existingLogs.map(r => r.pet_id));
        }

        const petsWithReportStatus = petsData.map(pet => ({
            ...pet,
            owner_name: pet.owner_profile?.full_name || 'N/A',
            has_report_for_today: reportsMap.has(pet.pet_id), 
        }));

        setPetsForReports(petsWithReportStatus);

    } catch (e) {
        console.error("Error fetching pets for reports tab:", e);
        setError(e.message || "Ocurrió un error al cargar las mascotas para reportes.");
        setPetsForReports([]);
    } finally {
        setLoadingPetsForReports(false);
    }
  }, [user, todayDate]);

  // --- Función para "Horario de Hoy" ---
  const fetchTodayActivities = useCallback(async () => {
    if (!user) {
      setTodayActivities([]);
      setLoadingTodayActivities(false);
      return;
    }
    setLoadingTodayActivities(true);
    setError(null);

    try {
      // 1. Obtener IDs de mascotas asignadas
      const { data: acceptedMembers, error: membersError } = await supabase
        .schema("petcare").from("pet_member").select("pet_id")
        .eq("member_user_id", user.id)
        .eq("member_role_id", "caregiver")
        .eq("status", "accepted");

      if (membersError) throw membersError;
      if (!acceptedMembers || acceptedMembers.length === 0) {
        setTodayActivities([]);
        setTodayStats({ completed: 0, total: 0 });
        setLoadingTodayActivities(false);
        return;
      }
      const petIds = acceptedMembers.map(member => member.pet_id);

      // 2. Obtener ALERTAS de hoy para todas esas mascotas
      const { startOfDayUTC, endOfDayUTC } = getTodayUTCRange();
      const { data: todayAlerts, error: alertError } = await supabase
        .schema("petcare")
        .from("alert")
        .select(`
          alert_id, 
          routine_id, 
          pet_id,
          title, 
          status_id, 
          scheduled_at,
          pet: pet ( name ),
          routine: routine ( time_local )
        `)
        .in("pet_id", petIds)
        .gte("scheduled_at", startOfDayUTC)
        .lt("scheduled_at", endOfDayUTC)
        .order("scheduled_at", { ascending: true });

      if (alertError) throw alertError;

      // 3. Obtener LOGS de hoy para ver el estado real
      // const todayString = getTodayDateString(); // 'todayDate' ya está disponible
      const { data: todayLogs, error: logError } = await supabase
        .schema("petcare")
        .from("activity_log")
        .select("routine_id, status_id")
        .in("pet_id", petIds)
        .eq("activity_date", todayDate); // Usa 'todayDate' de useMemo

      if (logError) throw logError;
      const logMap = new Map((todayLogs || []).map(log => [log.routine_id, log]));

      // 4. Combinar datos
      const combinedActivities = todayAlerts.map(alert => {
        const log = logMap.get(alert.routine_id);
        const finalStatus = log ? log.status_id : alert.status_id;
        const isCompletedOrSkipped = finalStatus === 'completed' || finalStatus === 'skipped';

        return {
          alert_id: alert.alert_id,
          routine_id: alert.routine_id,
          pet_id: alert.pet_id,
          title: alert.title,
          time: alert.routine?.time_local?.substring(0, 5) || alert.scheduled_at.substring(11, 16),
          pet_name: alert.pet?.name || 'Mascota',
          is_completed: isCompletedOrSkipped,
          status: finalStatus
        };
      });

      setTodayActivities(combinedActivities);

      // 5. Actualizar estadísticas
      const completedCount = combinedActivities.filter(a => a.is_completed).length;
      const totalCount = combinedActivities.length;
      setTodayStats({ completed: completedCount, total: totalCount });

    } catch (e) {
      console.error("Error fetching today's activities:", e);
      setError(e.message || "Error al cargar el horario de hoy.");
      setTodayActivities([]);
      setTodayStats({ completed: 0, total: 0 });
    } finally {
      setLoadingTodayActivities(false);
    }
  }, [user, todayDate]); // 'todayDate' es estable

  // --- Main useEffect (ACTUALIZADO) ---
  useEffect(() => {
    if (!user) return; 

    // --- 👇 LLAMA A TODAS LAS FUNCIONES DE STATS GLOBALES ---
    fetchPendingCount(); 
    fetchTodayActivities(); // Carga stats de "Actividades Hoy"
    fetchMascotasACargoCount(); // <-- ¡AÑADIDO! Carga stats de "Mascotas a Cargo"
    // --------------------------------------------------------

    // Carga los datos específicos de la pestaña activa
    if (tab === "horario") {
      // (ya se llamó arriba, pero podemos ser explícitos)
      // fetchTodayActivities(); 
    } else if (tab === "asignadas") {
      fetchAssignedPetsForDashboard(); 
    } else if (tab === "reportes") {
      fetchPetsForReports();
    }
    
    // --- (Este bloque ya no es necesario) ---
    // if(tab !== "horario") {
    //     fetchTodayActivities();
    // }
    
    // --- Realtime Subscription ---
    const channel = supabase.channel('caregiver-dashboard-updates')
      .on('postgres_changes',
          { event: '*', schema: 'petcare', table: 'pet_member'},
          (payload) => {
            fetchPendingCount();
            fetchMascotasACargoCount(); // Recarga el contador si cambia una membresía
            if (tab === "horario") fetchTodayActivities();
            if (tab === "asignadas") fetchAssignedPetsForDashboard();
            if (tab === "reportes") fetchPetsForReports();
          }
      )
      .on('postgres_changes',
          { event: '*', schema: 'petcare', table: 'alert'}, 
          (payload) => {
            fetchTodayActivities(); // Recarga horario y stats
            if (tab === "reportes") fetchPetsForReports();
          }
      )
      .on('postgres_changes', 
          { event: '*', schema: 'petcare', table: 'activity_log'}, 
          (payload) => {
            fetchTodayActivities(); // Recarga horario y stats
            if (tab === "reportes") fetchPetsForReports();
          }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Añade la nueva función al array de dependencias
  }, [user, tab, fetchPendingCount, fetchTodayActivities, fetchMascotasACargoCount, fetchAssignedPetsForDashboard, fetchPetsForReports]);


  // --- Event Handlers ---
  const handleCreateReport = (petId, petName) => {
    navigate(`/caregiver/reportes/crear/${petId}`, { 
      state: { petName, from: '/caregiver' } 
    });
  };
  
  const handleViewReport = (petId, petName) => {
    navigate(`/caregiver/reportes/ver/${petId}/${todayDate}`, { 
      state: { petName, from: '/caregiver' } 
    });
  };

  const handleMarkActivity = (petId, petName) => {
    navigate(`/caregiver/reportes/crear/${petId}`, { 
      state: { petName, from: '/caregiver' } 
    });
  };

  // --- stats ---
  const stats = {
    mascotasACargo: mascotasACargoCount, // <-- Ahora usará el estado correcto
    actividadesCompletadas: todayStats.completed,
    totalActividades: todayStats.total,
  };

  // --- JSX (Sin cambios) ---
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header y Botón Invitaciones */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Dashboard de Cuidador</h1>
          <p className="mt-1 text-gray-500">Gestiona el cuidado de las mascotas asignadas</p>
        </div>
        <button
          className="relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          onClick={() => navigate("/caregiver/invitations")}
        >
          <span>Invitaciones</span>
          {invitacionesPendientes > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {invitacionesPendientes}
            </span>
          )}
        </button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Mascotas a Cargo"
          value={stats.mascotasACargo}
          helper="mascotas activas"
          icon="🐾"
        />
         <StatCard
          title="Actividades Hoy"
          value={`${stats.actividadesCompletadas}/${stats.totalActividades}`}
          helper="completadas"
          icon="📋"
        />
        <StatCard
          title="Progreso Diario"
          value={`${stats.totalActividades > 0 ? Math.round((stats.actividadesCompletadas / stats.totalActividades) * 100) : 0}%`}
          helper="del día completado"
          icon="🕒"
        />
      </section>

      {/* Pestañas de Navegación */}
      <div className="mt-8">
        <Tabs activeTab={tab} setActiveTab={setTab} />
      </div>

      {/* Contenido Principal de las Pestañas */}
      <div className="mt-6">
      
        {/* --- Contenido "Horario de Hoy" --- */}
        {tab === "horario" && (
          loadingTodayActivities ? (
            <div className="text-center py-10 text-gray-500">Cargando horario de hoy...</div>
          ) : todayActivities.length === 0 ? (
            <EmptyState 
              title="No tienes actividades programadas para hoy." 
              description="Cuando un dueño te asigne una mascota con rutinas, aparecerán aquí." 
            />
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-gray-900">Actividades del Día</h2>
              <p className="text-sm text-gray-500">Marca las actividades completadas para cada mascota.</p>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
                {todayActivities.map((activity) => (
                  <ActivityRow 
                    key={activity.alert_id} 
                    activity={activity} 
                    onMark={() => handleMarkActivity(activity.pet_id, activity.pet_name)} 
                  />
                ))}
              </div>
            </div>
          )
        )}

        {/* Contenido de Mascotas Asignadas */}
        {tab === "asignadas" && (
          loadingAssignedPetsDashboard ? (
            <div className="text-center py-10 text-gray-500">Cargando mascotas asignadas...</div>
          ) : assignedPetsForDashboard.length === 0 ? (
            <EmptyState
              title="Aún no tienes mascotas asignadas."
              description="Una vez que aceptes una invitación, la mascota aparecerá aquí."
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"> 
              {assignedPetsForDashboard.map((pet) => (
                <AssignedPetCard key={pet.pet_id} pet={pet} />
              ))}
            </div>
          )
        )}

        {tab === "compartidas" && ( <EmptyState title="Mascotas Compartidas" description="Aquí aparecerán las mascotas que otros dueños te han compartido para su cuidado." /> )}
        
        {/* Contenido de la Pestaña "Reportes" */}
        {tab === "reportes" && (
          loadingPetsForReports ? (
            <div className="text-center py-10 text-gray-500">Cargando mascotas para reportes...</div>
          ) : petsForReports.length === 0 ? (
            <EmptyState title="No tienes mascotas asignadas." description="Acepta una invitación de dueño para empezar a cuidar una mascota." />
          ) : (
            <div className="space-y-4"> 
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Reportes de Cuidado</h1>
                  <p className="mt-1 text-gray-500">
                    Registra las actividades diarias para los dueños de las mascotas
                  </p>
                </div>
              </div>
              {petsForReports.map((pet) => (
                <div
                  key={pet.pet_id}
                  className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Info Mascota y Dueño */}
                  <div className="flex items-center space-x-3">
                    {pet.image_url ? (
                      <img
                        src={pet.image_url}
                        alt={pet.name}
                        className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.75-2.846m.904-2.185l.16-.068A2.25 2.25 0 0112 11.25c.818 0 1.58.322 2.006.852l.16.068m-.16-.068a.75.75 0 11-1.006-1.13l1.006 1.13zM12 9l-3.248-1.53M12 18.75l-3.248-1.53M12 9.75L15.248 8.22M12 18.75l3.248-1.53M3 16.5V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v9.75m-18 0V19.5a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 19.5V16.5m-18 0h16.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75v9.75m16.5-1.5H3.75m.75 0l-.008-.008A.75.75 0 013 15.75v-1.5m1.5-1.5H3.75m-.75 0l-.008-.008A.75.75 0 013 12.75v-1.5m1.5-1.5H3.75M.75 8.25h16.5V6.75a.75.75 0 00-.75-.75H1.5a.75.75 0 00-.75.75v1.5zM12 12.75h.008v.008H12v-.008z" />
                          </svg>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-800">{pet.name}</p>
                      <p className="text-sm text-gray-500">Dueño: {pet.owner_name}</p>
                    </div>
                  </div>
                  {/* Botones de Acción */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {pet.has_report_for_today ? (
                      <button
                        onClick={() => handleViewReport(pet.pet_id, pet.name)}
                        className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        Ver Reporte Hoy
                      </button>
                    ) : (
                       <button
                        className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed whitespace-nowrap"
                        disabled
                      >
                        Ver Reporte Hoy
                      </button>
                    )}
                    <button
                      onClick={() => handleCreateReport(pet.pet_id, pet.name)}
                      className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90 whitespace-nowrap"
                    >
                      {pet.has_report_for_today ? 'Editar Reporte Hoy' : 'Crear Reporte'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Muestra el error si existe */}
        {error && <div className="mt-4 text-center text-red-600">Error al cargar datos: {error}</div>}
      </div>

      <div className="sr-only">Bienvenido, {caregiverName}</div>
    </div>
  );
}

// --- Helper Components ---

function StatCard({ title, value, helper, icon }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-gray-800">{value}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { key: "horario", label: "Horario de Hoy" },
    { key: "asignadas", label: "Mascotas Asignadas" },
    { key: "compartidas", label: "Mascotas Compartidas" },
    { key: "reportes", label: "Reportes" }, 
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)} 
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === tab.key
              ? "bg-gray-800 text-white" 
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center text-gray-600">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      {description && <p className="mt-2 text-sm">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// --- Componente para la Fila de Actividad ---
function ActivityRow({ activity, onMark }) {
  const isCompleted = activity.is_completed;
  
  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg ${
        isCompleted ? 'bg-green-50' : 'bg-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className={`font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
            {activity.title}
          </p>
          <p className={`text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>
            {activity.time} • {activity.pet_name}
          </p>
        </div>
      </div>
      <button
        onClick={onMark}
        disabled={isCompleted}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
          isCompleted
            ? 'bg-black text-white cursor-default'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        {isCompleted ? (activity.status === 'skipped' ? 'Saltado' : 'Completado') : 'Marcar'}
      </button>
    </div>
  );
}