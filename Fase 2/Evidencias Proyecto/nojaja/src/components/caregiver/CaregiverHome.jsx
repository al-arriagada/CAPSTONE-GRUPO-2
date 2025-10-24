// src/pages/caregiver/CaregiverHome.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient";
import AssignedPetCard from "../../components/caregiver/AssignedPetCard.jsx"; // Adjust path if needed

// Helper simple para obtener YYYY-MM-DD
const getTodayDateString = () => new Date().toISOString().split('T')[0];

export default function CaregiverHome() {
  const { user } = useAuth();
  const navigate = useNavigate(); // Todavía la necesitamos para CreateReportPage/ViewReportPage
  const [tab, setTab] = useState("asignadas"); 
  const [invitacionesPendientes, setInvitacionesPendientes] = useState(0);
  
  // Mascotas para la pestaña "Asignadas" (vista de tarjeta)
  const [assignedPetsForDashboard, setAssignedPetsForDashboard] = useState([]);
  const [mascotasACargoCount, setMascotasACargoCount] = useState(0);
  const [loadingAssignedPetsDashboard, setLoadingAssignedPetsDashboard] = useState(true);
  
  // Mascotas para la pestaña "Reportes" (vista de lista con botones)
  const [petsForReports, setPetsForReports] = useState([]);
  const [loadingPetsForReports, setLoadingPetsForReports] = useState(true);

  const [error, setError] = useState(null); 
  const todayDate = getTodayDateString(); // Fecha de hoy para los reportes

  const caregiverName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Cuidador";

  // Función para contar invitaciones pendientes
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
      console.error("Error fetching invitation count:", error);
    } else if (count !== null) {
      setInvitacionesPendientes(count);
    }
  }, [user]);

  // Función para buscar mascotas asignadas para el dashboard (tarjetas)
  const fetchAssignedPetsForDashboard = useCallback(async () => {
      if (!user) {
        setAssignedPetsForDashboard([]);
        setMascotasACargoCount(0);
        setLoadingAssignedPetsDashboard(false);
        return;
      }

      setLoadingAssignedPetsDashboard(true);
      setError(null); // Clear previous errors
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
              setAssignedPetsForDashboard([]);
              setMascotasACargoCount(0);
              setLoadingAssignedPetsDashboard(false);
              return;
          }
          const petIds = acceptedMembers.map(member => member.pet_id);

          const { data: petsData, error: petsError } = await supabase
              .schema("petcare")
              .from("pet")
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
                  .schema("petcare")
                  .from("user_pii")
                  .select("user_id, phone")
                  .in("user_id", ownerIds);
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
          setMascotasACargoCount(combinedPetsData.length || 0);

      } catch (errorCatch) {
          console.error("Error fetching assigned pets for dashboard:", errorCatch);
          setError(errorCatch.message || "Error cargando mascotas para el dashboard.");
          setAssignedPetsForDashboard([]);
          setMascotasACargoCount(0);
      } finally {
          setLoadingAssignedPetsDashboard(false);
      }
  }, [user]);

  // Función para buscar mascotas y su estado de reporte para la pestaña "Reportes"
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

        // ----- CONSULTA para verificar reportes existentes HOY -----
        // Asumiendo que tienes una tabla `daily_care_report`
        let reportsMap = new Map(); // Mapa para pet_id -> report_id (o true si existe)
        const { data: existingReports, error: reportsError } = await supabase
            .schema("petcare")
            .from("daily_care_report") // Tabla de reportes diarios
            .select("pet_id, report_id") // Asume que report_id es la PK
            .eq("caregiver_user_id", user.id)
            .eq("report_date", todayDate) // Solo reportes de hoy
            .in("pet_id", petIds); // Solo para las mascotas asignadas

        if (reportsError) {
            console.warn("Error al buscar reportes existentes:", reportsError);
        } else if (existingReports) {
            reportsMap = new Map(existingReports.map(r => [r.pet_id, r.report_id || true])); // Guarda el ID o true
        }
        // FIN CONSULTA

        const petsWithReportStatus = petsData.map(pet => ({
            ...pet,
            owner_name: pet.owner_profile?.full_name || 'N/A',
            has_report_for_today: reportsMap.has(pet.pet_id),
            today_report_id: reportsMap.get(pet.pet_id) // ID del reporte si existe
        }));

        setPetsForReports(petsWithReportStatus);

    } catch (e) {
        console.error("Error fetching pets for reports tab:", e);
        setError(e.message || "Ocurrió un error al cargar las mascotas para reportes.");
        setPetsForReports([]);
    } finally {
        setLoadingPetsForReports(false);
    }
  }, [user, todayDate]); // Dependencias para la función memoizada

  // --- Main useEffect ---
  useEffect(() => {
    fetchPendingCount();
    fetchAssignedPetsForDashboard(); // Siempre cargar para la pestaña "asignadas" y el contador

    // Cargar mascotas para reportes SOLO SI la pestaña de reportes está activa
    // o si el usuario y la fecha cambian (para re-evaluar reportes de hoy)
    if (tab === "reportes" || user) { // Podríamos ser más específicos, pero esto asegura la carga
        fetchPetsForReports();
    }
    
    // --- Realtime Subscription ---
    const channel = supabase.channel('caregiver-dashboard-updates')
      .on('postgres_changes',
          { event: '*', schema: 'petcare', table: 'pet_member'},
          (payload) => {
            console.log('Change detected in pet_member, refetching data...', payload);
            fetchPendingCount();
            fetchAssignedPetsForDashboard();
            fetchPetsForReports(); // También recarga los reportes
          }
      )
      .on('postgres_changes',
          { event: '*', schema: 'petcare', table: 'daily_care_report'}, // Monitorear cambios en reportes
          (payload) => {
            console.log('Change detected in daily_care_report, refetching report data...', payload);
            fetchPetsForReports(); // Solo recarga los reportes si hay un cambio
          }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, tab, fetchPendingCount, fetchAssignedPetsForDashboard, fetchPetsForReports]); // Dependencies


  // --- Event Handlers for Reports Tab ---
  const handleCreateReport = (petId, petName) => {
    navigate(`/caregiver/reportes/crear/${petId}`, { state: { petName } });
  };

  const handleViewReport = (petId, reportId, petName) => {
    // navigate(`/caregiver/reportes/ver/${reportId}`, { state: { petId, petName, reportDate: todayDate } });
    navigate(`/caregiver/reportes/ver/${petId}/${reportId}`, { state: { petName, reportDate: todayDate } });
  };


  // Update stats (these will still be 0/0 unless you add logic to count activities)
  const stats = {
    mascotasACargo: mascotasACargoCount,
    actividadesCompletadas: 0, 
    totalActividades: 0,      
  };

  // --- JSX ---
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header and Invitations Button */}
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

      {/* Stat Cards */}
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

      {/* Navigation Tabs (Directly handles tab state) */}
      <div className="mt-8">
        <Tabs activeTab={tab} setActiveTab={setTab} />
      </div>

      {/* Main Tab Content */}
      <div className="mt-6">
        {tab === "horario" && ( <EmptyState title="No tienes actividades programadas para hoy." description="Cuando un dueño te asigne una mascota con rutinas, aparecerán aquí." /> )}

        {/* Assigned Pets Content (Uses AssignedPetCard) */}
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
        
        {/* 👇 NEW: Reports Tab Content (Integrated) 👇 */}
        {tab === "reportes" && (
          loadingPetsForReports ? (
            <div className="text-center py-10 text-gray-500">Cargando mascotas para reportes...</div>
          ) : petsForReports.length === 0 ? (
            <EmptyState title="No tienes mascotas asignadas para generar reportes." description="Acepta una invitación de dueño para empezar a cuidar una mascota." />
          ) : (
            <div className="space-y-4">
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
                        onClick={() => handleViewReport(pet.pet_id, pet.today_report_id, pet.name)}
                        className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                      >
                        Ver Reporte Hoy
                      </button>
                    ) : (
                      // Deshabilitado si no hay reporte hoy
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
        {/* 👆 END: Reports Tab Content (Integrated) 👆 */}

        {/* Display error if exists */}
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

// Tabs Component (Simplified, no longer navigates)
function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { key: "horario", label: "Horario de Hoy" },
    { key: "asignadas", label: "Mascotas Asignadas" },
    { key: "compartidas", label: "Mascotas Compartidas" },
    { key: "reportes", label: "Reportes" }, // This tab will now render content directly
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)} // Just changes the active tab state
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