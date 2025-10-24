// src/pages/caregiver/CaregiverHome.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient";

import AssignedPetCard from "../../components/caregiver/AssignedPetCard.jsx"; // Ajusta la ruta si es necesario

export default function CaregiverHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("asignadas"); // Inicia en 'asignadas'
  const [invitacionesPendientes, setInvitacionesPendientes] = useState(0);
  const [assignedPets, setAssignedPets] = useState([]);
  const [mascotasACargoCount, setMascotasACargoCount] = useState(0);
  const [loadingAssignedPets, setLoadingAssignedPets] = useState(true);
  const [error, setError] = useState(null); // Estado para errores

  const caregiverName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Cuidador";

  // --- useEffect Ampliado ---
  useEffect(() => {
    if (!user) {
        // Limpia estados si el usuario se desloguea
        setInvitacionesPendientes(0);
        setAssignedPets([]);
        setMascotasACargoCount(0);
        setLoadingAssignedPets(false);
        setError(null);
        return;
    }

    // 1. Contar invitaciones pendientes
    const fetchPendingCount = async () => {
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
    };

    // 2. Buscar mascotas asignadas (aceptadas) - MÉTODO CON 3 CONSULTAS
    const fetchAssignedPets = async () => {
        setLoadingAssignedPets(true);
        setAssignedPets([]);
        setMascotasACargoCount(0);
        setError(null);

        try {
            // ----- CONSULTA 1: Obtener los IDs de las mascotas aceptadas -----
            console.log("Consulta 1: Buscando IDs de mascotas aceptadas...");
            const { data: acceptedMembers, error: membersError } = await supabase
              .schema("petcare")
              .from("pet_member")
              .select("pet_id")
              .eq("member_user_id", user.id) // Asegúrate que 'member_user_id' sea el nombre correcto
              .eq("member_role_id", "caregiver")
              .eq("status", "accepted"); // Busca status SIN comillas

            console.log("Consulta 1 - Resultado:", { acceptedMembers, membersError });
            if (membersError) throw membersError;
            if (!acceptedMembers || acceptedMembers.length === 0) {
                console.log("Consulta 1: No se encontraron mascotas aceptadas.");
                setLoadingAssignedPets(false);
                return;
            }
            const petIds = acceptedMembers.map(member => member.pet_id);
            console.log("Consulta 1: IDs de mascotas encontradas:", petIds);

            // ----- CONSULTA 2: Obtener detalles de mascotas y nombre del dueño -----
            console.log("Consulta 2: Buscando detalles de mascotas y nombre dueño...");
            const { data: petsData, error: petsError } = await supabase
              .schema("petcare")
              .from("pet")
              // 👇 Asegúrate que todas estas columnas existan
              .select(`
                  pet_id, name, breed, birth_date, image_url,
                  species_id, user_id,
                  current_weight, 
                  owner_profile: app_user!user_id ( user_id, full_name )
              `)
              .in("pet_id", petIds);

            console.log("Consulta 2 - Resultado:", { petsData, petsError });
            if (petsError) throw petsError;
            if (!petsData) throw new Error("No se encontraron detalles de mascotas.");

            const ownerIds = petsData.map(pet => pet.user_id).filter(Boolean);

            // ----- CONSULTA 3: Obtener teléfonos de los dueños (user_pii) -----
            let ownerPhones = {};
            if (ownerIds.length > 0) {
                console.log("Consulta 3: Buscando teléfonos para dueños:", ownerIds);
                const { data: piiData, error: piiError } = await supabase
                  .schema("petcare")
                  .from("user_pii")
                  .select("user_id, phone")
                  .in("user_id", ownerIds);

                console.log("Consulta 3 - Resultado:", { piiData, piiError });
                if (piiError) {
                    console.warn("Error al buscar teléfonos (continuando sin ellos):", piiError);
                } else if (piiData) {
                    ownerPhones = piiData.reduce((map, pii) => {
                        map[pii.user_id] = pii.phone;
                        return map;
                    }, {});
                }
            }

            // ----- Combinar Datos y Actualizar Estado -----
            const combinedPetsData = petsData.map(pet => ({
                ...pet,
                owner: {
                    user_id: pet.owner_profile?.user_id,
                    full_name: pet.owner_profile?.full_name,
                    phone: ownerPhones[pet.user_id] || null
                }
            }));

            console.log("Actualizando estado con mascotas combinadas:", combinedPetsData);
            setAssignedPets(combinedPetsData);
            setMascotasACargoCount(combinedPetsData.length || 0);

        } catch (errorCatch) {
            console.error("Error DETALLADO al buscar mascotas asignadas:", errorCatch);
            setError(errorCatch.message || "Ocurrió un error desconocido");
            setAssignedPets([]);
            setMascotasACargoCount(0);
        } finally {
            setLoadingAssignedPets(false);
        }
    };

    fetchPendingCount();
    fetchAssignedPets();

    // --- Suscripción Realtime ---
    const channel = supabase.channel('caregiver-dashboard-updates')
      .on('postgres_changes',
          { event: '*', schema: 'petcare', table: 'pet_member'},
          (payload) => {
            console.log('Cambio detectado en pet_member, recargando datos...', payload);
            fetchPendingCount();
            fetchAssignedPets();
          }
      )
      .subscribe();

    // Limpia la suscripción al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
    // --- FIN Realtime ---

  }, [user]); // Dependencia: user

  // Actualiza stats con el conteo real
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

      {/* Pestañas de Navegación */}
      <div className="mt-8">
        <Tabs activeTab={tab} setActiveTab={setTab} />
      </div>

      {/* Contenido Principal de las Pestañas */}
      <div className="mt-6">
        {tab === "horario" && ( <EmptyState title="No tienes actividades programadas para hoy." description="Cuando un dueño te asigne una mascota con rutinas, aparecerán aquí." /> )}

        {/* Contenido de Mascotas Asignadas */}
        {tab === "asignadas" && (
          loadingAssignedPets ? (
            <div className="text-center py-10 text-gray-500">Cargando mascotas asignadas...</div>
          ) : assignedPets.length === 0 ? (
            <EmptyState
              title="Aún no tienes mascotas asignadas."
              description="Una vez que aceptes una invitación, la mascota aparecerá aquí."
            />
          ) : (
            // 👇 Usa AssignedPetCard aquí
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"> {/* Ajusta columnas */}
              {assignedPets.map((pet) => (
                <AssignedPetCard key={pet.pet_id} pet={pet} />
              ))}
            </div>
          )
        )}
        {/* Fin Contenido Mascotas Asignadas */}

        {tab === "compartidas" && ( <EmptyState title="Mascotas Compartidas" description="Aquí aparecerán las mascotas que otros dueños te han compartido para su cuidado." /> )}
        {tab === "reportes" && ( <EmptyState title="No hay reportes para mostrar." description="Completa actividades para empezar a generar reportes de cuidado." /> )}

        {/* Muestra el error si existe */}
        {error && <div className="mt-4 text-center text-red-600">Error al cargar datos: {error}</div>}
      </div>

      <div className="sr-only">Bienvenido, {caregiverName}</div>
    </div>
  );
}

// ... (Tus componentes helper StatCard, Tabs, EmptyState sin cambios) ...
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