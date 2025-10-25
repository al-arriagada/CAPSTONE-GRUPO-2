// src/pages/caregiver/CaregiverHome.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient";
// 👇 Importa la tarjeta de mascota diseñada para el cuidador
import AssignedPetCard from "../../components/caregiver/AssignedPetCard.jsx"; // Ajusta la ruta si es necesario

// Helper simple para obtener YYYY-MM-DD
const getTodayDateString = () => new Date().toISOString().split('T')[0];

export default function CaregiverHome() {
  const { user } = useAuth();
  const navigate = useNavigate(); // La necesitamos para navegar a "Crear/Ver Reporte"
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

  // --- Función para contar invitaciones pendientes ---
  const fetchPendingCount = useCallback(async () => {
    if (!user) return;
    const { count, error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .select(null, { count: "exact", head: true })
      .eq("member_user_id", user.id) // Asegúrate que 'member_user_id' sea el nombre correcto
      .eq("member_role_id", "caregiver")
      .eq("status", "pending"); // Busca status SIN comillas

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
        setMascotasACargoCount(0);
        setLoadingAssignedPetsDashboard(false);
        return;
      }
      setLoadingAssignedPetsDashboard(true);
      setError(null); 
      try {
          // ----- CONSULTA 1: IDs aceptados -----
          const { data: acceptedMembers, error: membersError } = await supabase
              .schema("petcare").from("pet_member").select("pet_id")
              .eq("member_user_id", user.id).eq("member_role_id", "caregiver").eq("status", "accepted");
          if (membersError) throw membersError;
          if (!acceptedMembers || acceptedMembers.length === 0) {
              setAssignedPetsForDashboard([]);
              setMascotasACargoCount(0);
              setLoadingAssignedPetsDashboard(false);
              return;
          }
          const petIds = acceptedMembers.map(member => member.pet_id);

          // ----- CONSULTA 2: Detalles de Mascotas y Nombres -----
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

          // ----- CONSULTA 3: Teléfonos -----
          const ownerIds = petsData.map(pet => pet.user_id).filter(Boolean);
          let ownerPhones = {};
          if (ownerIds.length > 0) {
              const { data: piiData, error: piiError } = await supabase
                  .schema("petcare").from("user_pii").select("user_id, phone").in("user_id", ownerIds);
              if (piiError) console.warn("Error fetching owner phones:", piiError);
              else if (piiData) ownerPhones = piiData.reduce((map, pii) => { map[pii.user_id] = pii.phone; return map; }, {});
          }

          // ----- Combinar y Actualizar -----
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
          setError(errorCatch.message || "Error cargando mascotas.");
          setAssignedPetsForDashboard([]);
          setMascotasACargoCount(0);
      } finally {
          setLoadingAssignedPetsDashboard(false);
      }
  }, [user]);

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
        // ----- CONSULTA 1: IDs aceptados (repite lógica) -----
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

        // ----- CONSULTA 2: Detalles simples (para la lista) -----
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

        // ----- CONSULTA 3: CORREGIDA - Verificar 'alert' en lugar de 'daily_care_report' -----
        const todayStart = `${todayDate}T00:00:00.000Z`;
        const todayEnd = `${todayDate}T23:59:59.999Z`;

        let reportsMap = new Set(); // Usamos un Set para IDs de mascotas
        const { data: existingAlerts, error: alertsError } = await supabase
            .schema("petcare")
            .from("alert") // Busca en la tabla 'alert'
            .select("pet_id") // Solo necesitamos saber qué mascotas tienen
            .eq("completed_by", user.id) // Hechos por este cuidador
            .gte("scheduled_at", todayStart) // Programados para hoy
            .lte("scheduled_at", todayEnd)
            .in("status_id", ["completed", "omitted"]); // Que estén marcados

        if (alertsError) {
            console.warn("Error al buscar reportes existentes en 'alert':", alertsError);
        } else if (existingAlerts) {
            // Añade los pet_id al Set
            reportsMap = new Set(existingAlerts.map(r => r.pet_id));
        }
        // ----- FIN CONSULTA 3 -----

        // Combina datos
        const petsWithReportStatus = petsData.map(pet => ({
            ...pet,
            owner_name: pet.owner_profile?.full_name || 'N/A',
            // Revisa si el Set incluye el ID de esta mascota
            has_report_for_today: reportsMap.has(pet.pet_id), 
            // today_report_id ya no es necesario, usaremos la fecha
        }));

        setPetsForReports(petsWithReportStatus);

    } catch (e) {
        console.error("Error fetching pets for reports tab:", e);
        setError(e.message || "Ocurrió un error al cargar las mascotas para reportes.");
        setPetsForReports([]);
    } finally {
        setLoadingPetsForReports(false);
    }
  }, [user, todayDate]); // Depende del usuario y la fecha

  // --- Main useEffect ---
  useEffect(() => {
    if (!user) return; 

    fetchPendingCount(); 

    // Carga los datos de la pestaña activa
    if (tab === "asignadas") {
        fetchAssignedPetsForDashboard(); 
    } else if (tab === "reportes") {
        fetchPetsForReports();
    }
    
    // --- Realtime Subscription ---
    const channel = supabase.channel('caregiver-dashboard-updates')
      .on('postgres_changes',
          { event: '*', schema: 'petcare', table: 'pet_member'},
          (payload) => {
            console.log('Cambio detectado en pet_member, recargando datos...', payload);
            fetchPendingCount();
            if (tab === "asignadas") fetchAssignedPetsForDashboard();
            if (tab === "reportes") fetchPetsForReports();
          }
      )
      .on('postgres_changes', // Monitorea 'alert' para actualizar la pestaña de reportes
          { event: '*', schema: 'petcare', table: 'alert'}, 
          (payload) => {
            console.log('Cambio detectado en alert, recargando reportes...', payload);
            if (tab === "reportes") fetchPetsForReports();
          }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, tab, fetchPendingCount, fetchAssignedPetsForDashboard, fetchPetsForReports]); // Depende de user y tab


  // --- Event Handlers for Reports Tab ---
  const handleCreateReport = (petId, petName) => {
    navigate(`/caregiver/reportes/crear/${petId}`, { state: { petName } });
  };
  
  const handleViewReport = (petId, petName) => {
    // Navega usando petId y la fecha de hoy
    navigate(`/caregiver/reportes/ver/${petId}/${todayDate}`, { state: { petName } });
  };


  // --- stats ---
  const stats = {
    mascotasACargo: mascotasACargoCount,
    actividadesCompletadas: 0,
    totalActividades: 0,
  };

  // --- JSX ---
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
          onClick={() => navigate("/caregiver/invitations")} // Asegúrate que esta ruta es correcta
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

      {/* Pestañas de Navegación (Simplificadas) */}
      <div className="mt-8">
        <Tabs activeTab={tab} setActiveTab={setTab} />
      </div>

      {/* Contenido Principal de las Pestañas */}
      <div className="mt-6">
        {tab === "horario" && ( <EmptyState title="No tienes actividades programadas para hoy." description="Cuando un dueño te asigne una mascota con rutinas, aparecerán aquí." /> )}

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
        {/* Fin Contenido Mascotas Asignadas */}

        {tab === "compartidas" && ( <EmptyState title="Mascotas Compartidas" description="Aquí aparecerán las mascotas que otros dueños te han compartido para su cuidado." /> )}
        
        {/* 👇 Contenido de la Pestaña "Reportes" (Integrado) 👇 */}
        {tab === "reportes" && (
          loadingPetsForReports ? (
            <div className="text-center py-10 text-gray-500">Cargando mascotas para reportes...</div>
          ) : petsForReports.length === 0 ? (
            <EmptyState title="No tienes mascotas asignadas." description="Acepta una invitación de dueño para empezar a cuidar una mascota." />
          ) : (
            // Este es el contenido de Screenshot_7.png
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
                        // 👇 Navega a la ruta 'ver' con el petId y la fecha de hoy
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
                      {/* El texto cambia si ya existe un reporte */}
                      {pet.has_report_for_today ? 'Editar Reporte Hoy' : 'Crear Reporte'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {/* 👆 FIN: Contenido Pestaña Reportes 👆 */}

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

// 👇 Componente Tabs (Simplificado, ya no navega) 👇
function Tabs({ activeTab, setActiveTab }) {
  const tabs = [
    { key: "horario", label: "Horario de Hoy" },
    { key: "asignadas", label: "Mascotas Asignadas" },
    { key: "compartidas", label: "Mascotas Compartidas" },
    { key: "reportes", label: "Reportes" }, // Ahora es solo una pestaña local
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)} // Solo cambia el estado local
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === tab.key
              ? "bg-gray-800 text-white" // Se marca como activo
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