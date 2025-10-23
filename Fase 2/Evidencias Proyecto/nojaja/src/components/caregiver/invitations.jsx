// src/pages/caregiver/CaregiverInvitations.jsx

import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient.js";
// import { formatDate } from "../../utils/formatDate"; 

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function CaregiverInvitations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carga todas las invitaciones (pendientes y aceptadas) usando status
  useEffect(() => {
    if (!user) return;

    const fetchInvitations = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select(`
          pet_id, 
          member_user_id,
          created_at,
          expires_at,
          // accepted_at, // <-- ELIMINADO
          message,
          status, // <-- Columna clave
          pet:pet(name),
          owner:app_user!invited_by(full_name)
        `)
        .eq("member_user_id", user.id)
        .in("status", ["pending", "accepted"]); // <-- Filtra por status

      if (error) {
        console.error("Error al cargar invitaciones:", error);
        setError(error.message);
      } else {
        console.log('Invitaciones recibidas:', data); 
        setInvitations(data || []);
      }
      setLoading(false);
    };

    fetchInvitations();
  }, [user]);

  // Lógica para Aceptar una invitación (Actualiza solo status)
  const handleAccept = async (petId) => { 
    const { error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .update({
        status: "accepted", // <-- Actualiza status
        // accepted_at: new Date().toISOString(), // <-- ELIMINADO
      })
      .eq("pet_id", petId) 
      .eq("member_user_id", user.id); 

    if (error) {
      alert("Error al aceptar la invitación: " + error.message);
    } else {
      // Actualiza el estado local para mover la tarjeta
      setInvitations(
        invitations.map((inv) =>
          inv.pet_id === petId ? { ...inv, status: "accepted" } : inv // <-- Actualiza solo status local
        )
      );
    }
  };

  // Lógica para Rechazar una invitación (Actualiza status a 'rejected')
  const handleReject = async (petId) => {
    const { error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .update({ status: "rejected" }) // <-- Actualiza status
      .eq("pet_id", petId) 
      .eq("member_user_id", user.id); 

    if (error) {
      alert("Error al rechazar la invitación: " + error.message);
    } else {
      // Actualiza el estado local para quitar la tarjeta (ya no se mostrará)
      setInvitations(invitations.filter((inv) => inv.pet_id !== petId)); 
    }
  };

  // Separa las invitaciones en dos listas usando status
  const { pendingInvitations, activeCares } = useMemo(() => {
    return invitations.reduce(
      (acc, inv) => {
        if (inv.status === "pending") { 
          acc.pendingInvitations.push(inv);
        } else if (inv.status === "accepted") { 
          acc.activeCares.push(inv);
        }
        return acc;
      },
      { pendingInvitations: [], activeCares: [] }
    );
  }, [invitations]);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/app/caregiver" 
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
        </svg>
        Volver al Dashboard
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Invitaciones de Cuidado
        </h1>
        <p className="mt-1 text-gray-500">
          Gestiona las invitaciones para cuidar mascotas
        </p>
      </header>

      {loading && <div className="text-center py-10">Cargando invitaciones...</div>}
      {error && <div className="text-center py-10 text-red-600">Error: {error}</div>}

      {!loading && (
        <div className="space-y-10">
          {/* Sección de Invitaciones Pendientes */}
          <section>
            <div className="flex items-center gap-3 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-gray-500">
                 <path d="M3.25 4.25a.75.75 0 000 1.5h13.5a.75.75 0 000-1.5H3.25zM3 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 10zm0 5.25a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" />
               </svg>
              <h2 className="text-xl font-semibold text-gray-800">
                Invitaciones Pendientes ({pendingInvitations.length})
              </h2>
            </div>
            {pendingInvitations.length > 0 ? (
              <div className="space-y-4">
                {pendingInvitations.map((inv) => (
                  <PendingInvitationCard
                    key={inv.pet_id} 
                    invitation={inv}
                    onAccept={() => handleAccept(inv.pet_id)} 
                    onReject={() => handleReject(inv.pet_id)} 
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No tienes invitaciones pendientes</p>
            )}
          </section>

          {/* Sección de Cuidados Activos */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green-600">
                 <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
               </svg>
              <h2 className="text-xl font-semibold text-gray-800">
                Cuidados Activos ({activeCares.length})
              </h2>
            </div>
            {activeCares.length > 0 ? (
              <div className="space-y-4">
                {activeCares.map((care) => (
                  <ActiveCareCard key={care.pet_id} care={care} /> 
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">Aún no estás cuidando ninguna mascota</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* ----------------------- Helper Components ----------------------- */

// Tarjeta para Invitaciones Pendientes
function PendingInvitationCard({ invitation, onAccept, onReject }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {invitation.owner?.full_name || "Dueño"}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
              Pendiente 
            </span>
          </div>
          <p className="mt-2 text-gray-600 italic">"{invitation.message || "Sin mensaje"}"</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onReject}
            className="w-1/2 sm:w-auto flex-1 justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Rechazar
          </button>
          <button
            onClick={onAccept}
            className="w-1/2 sm:w-auto flex-1 justify-center rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Aceptar
          </button>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 text-sm text-gray-600">
          <p><strong>Mascotas:</strong> {invitation.pet?.name || "N/A"}</p>
          <p><strong>Recibida:</strong> {formatDate(invitation.created_at)}</p>
          <p><strong>Expira:</strong> {formatDate(invitation.expires_at)}</p>
        </div>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-800 self-start sm:self-center">
          Ver Detalles
        </button>
      </div>
    </div>
  );
}

// Tarjeta para Cuidados Activos
function ActiveCareCard({ care }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {care.owner?.full_name || "Dueño"}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Aceptada
            </span>
          </div>
          <div className="mt-4 space-y-1 text-sm text-gray-600">
            <p><strong>Mascotas:</strong> {care.pet?.name || "N/A"}</p>
            {/* 👇 ELIMINADO: Ya no mostramos la fecha de aceptación */}
            {/* <p><strong>Aceptada:</strong> {formatDate(care.accepted_at)}</p> */}
            {/* 👇 OPCIONAL: Puedes mostrar la fecha de creación si quieres */}
             <p><strong>Invitación creada:</strong> {formatDate(care.created_at)}</p> 
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            // onClick={() => navigate(`/app/pets/${care.pet_id}`)} // Navega a la mascota
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver Mascota
          </button>
        </div>
      </div>
    </div>
  );
}