// src/pages/caregiver/CaregiverHome.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient"; // Make sure the path is correct

export default function CaregiverHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("horario");
  const [invitacionesPendientes, setInvitacionesPendientes] = useState(0);

  const caregiverName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Cuidador";

  useEffect(() => {
    if (!user) return;

    const fetchPendingCount = async () => {
      // Busca invitaciones para este usuario que tengan status 'pending'
      const { count, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select(null, { count: "exact", head: true }) // Correcto
        .eq("member_user_id", user.id) // Filtra por ID (asegúrate que 'member_user_id' sea el nombre correcto)
        .eq("member_role_id", "caregiver") // Opcional: Asegura que sea rol cuidador
        // 👇 CORREGIDO: Filtra solo por invitaciones pendientes
        .eq("status", "pending"); 

      if (error) {
        console.error("Error al buscar conteo de invitaciones:", error);
      } else if (count !== null) {
        setInvitacionesPendientes(count);
      }
    };

    fetchPendingCount();

    // --- OPCIONAL PERO RECOMENDADO: Escuchar cambios ---
    // Esto hará que el contador se actualice en tiempo real si usas Supabase Realtime
    const channel = supabase.channel('pending-invites-count')
      .on('postgres_changes', 
          { 
            event: '*', // Escucha INSERT, UPDATE, DELETE
            schema: 'petcare', 
            table: 'pet_member', 
            // Opcional: Filtra por cambios que afecten a este usuario
            // filter: `member_user_id=eq.${user.id}` 
          }, 
          (payload) => {
            console.log('Cambio detectado en pet_member, recargando conteo...', payload);
            // Vuelve a contar cuando algo cambie en la tabla
            fetchPendingCount(); 
          }
      )
      .subscribe();

    // Limpia la suscripción cuando el componente se desmonte
    return () => {
      supabase.removeChannel(channel);
    };
    // --- FIN OPCIONAL ---

  }, [user]); // Dependencia: user

  const stats = {
    mascotasACargo: 0,
    actividadesCompletadas: 0,
    totalActividades: 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header y Botón de Invitaciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            Dashboard de Cuidador
          </h1>
          <p className="mt-1 text-gray-500">
            Gestiona el cuidado de las mascotas asignadas
          </p>
        </div>
        <button
          className="relative inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          onClick={() => navigate("/caregiver/invitations")} // Usa la ruta correcta
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
          value={`${
            stats.totalActividades > 0
              ? Math.round(
                  (stats.actividadesCompletadas / stats.totalActividades) * 100
                )
              : 0
          }%`}
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
        {tab === "horario" && ( <EmptyState title="No tienes actividades..." /> )}
        {tab === "asignadas" && ( <EmptyState title="Aún no tienes mascotas..." /> )}
        {tab === "compartidas" && ( <EmptyState title="Mascotas Compartidas..." /> )}
        {tab === "reportes" && ( <EmptyState title="No hay reportes..." /> )}
      </div>

      <div className="sr-only">Bienvenido, {caregiverName}</div>
    </div>
  );
}

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
