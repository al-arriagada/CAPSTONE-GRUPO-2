// src/pages/caregiver/invitations.jsx

import React, { useState, useEffect, useMemo } from "react";
import { Link} from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../supabaseClient.js";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default function Invitations() { // Asegúrate que este nombre coincida con tu router.jsx
  const { user } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null); 
  const [error, setError] = useState(null);

  // --- Función Separada para Cargar Invitaciones ---
  const fetchInvitations = async (showLoadingIndicator = true) => {
    if (!user) {
        setInvitations([]);
        setLoading(false); 
        return; 
    }
    if (showLoadingIndicator) setLoading(true);
    console.log('Buscando invitaciones para user ID:', user.id); 

    const { data, error } = await supabase
      .schema("petcare")
      .from("pet_member")
      // 👇 Asegúrate que estas columnas existan en tu tabla pet_member
      .select(`
        pet_id, 
        member_user_id,
        created_at,
        status,           
        member_role_id, 
        pet:pet(name),
        owner:app_user!invited_by(full_name) 

      `)
      .eq("member_user_id", user.id) 
      .eq("member_role_id", "caregiver") 
      .in("status", ["pending", "accepted"]); 

    if (error) {
      console.error("Error al cargar invitaciones:", error);
      setError(error.message); 
      setInvitations([]); 
    } else {
      console.log('Invitaciones recibidas (SIN comillas):', data); 
      setInvitations(data || []); 
      setError(null); 
    }
    if (showLoadingIndicator) setLoading(false); 
  };

  // --- useEffect llama a fetchInvitations al inicio ---
  useEffect(() => {
    fetchInvitations(true); 
  }, [user]); 

  // --- Lógica para Aceptar ---
  const handleAccept = async (petId) => { 
    setUpdatingId(petId); 
    const { error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .update({
        status: "accepted", // <-- CORREGIDO: Sin comillas
        // accepted_at: new Date().toISOString(), // Descomenta si creas esta columna
      })
      .eq("pet_id", petId) 
      .eq("member_user_id", user.id); // O user_id

    setUpdatingId(null); 

    if (error) {
      console.error("Error al aceptar invitación (Supabase):", error);
      alert("Error al aceptar la invitación: " + error.message);
    } else {
      // Vuelve a cargar SIN mostrar el indicador grande de carga
      fetchInvitations(false); 
    }
  };

  // --- Lógica para Rechazar ---
  const handleReject = async (petId) => {
    setUpdatingId(petId); 
    const { error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .update({ status: "rejected" }) // <-- CORREGIDO: Sin comillas
      .eq("pet_id", petId) 
      .eq("member_user_id", user.id); // O user_id

    setUpdatingId(null); 

    if (error) {
       console.error("Error al rechazar invitación (Supabase):", error);
      alert("Error al rechazar la invitación: " + error.message);
    } else {
      // Vuelve a cargar SIN mostrar el indicador grande de carga
       fetchInvitations(false); 
    }
  };

  // --- useMemo para separar listas ---
  const { pendingInvitations, activeCares } = useMemo(() => {
    return invitations.reduce(
      (acc, inv) => {
        // 👇 CORREGIDO: Compara status SIN comillas
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

  // --- JSX ---
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/caregiver" 
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
        Volver al Dashboard
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Invitaciones de Cuidado</h1>
        <p className="mt-1 text-gray-500">Gestiona las invitaciones para cuidar mascotas</p>
      </header>

      {loading && <div className="text-center py-10">Cargando invitaciones...</div>} 
      {error && <div className="text-center py-10 text-red-600">Error: {error}</div>}

      {!loading && (
        <div className="space-y-10">
          {/* Sección Pendientes */}
          <section>
             <div className="flex items-center gap-3 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-gray-500"><path d="M3.25 4.25a.75.75 0 000 1.5h13.5a.75.75 0 000-1.5H3.25zM3 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 10zm0 5.25a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" /></svg>
              <h2 className="text-xl font-semibold text-gray-800">Invitaciones Pendientes ({pendingInvitations.length})</h2>
            </div>
            {pendingInvitations.length > 0 ? (
              <div className="space-y-4">
                {pendingInvitations.map((inv) => (
                  <PendingInvitationCard
                    key={inv.pet_id} 
                    invitation={inv}
                    onAccept={() => handleAccept(inv.pet_id)} 
                    onReject={() => handleReject(inv.pet_id)} 
                    isUpdating={updatingId === inv.pet_id}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No tienes invitaciones pendientes</p>
            )}
          </section>

          {/* Sección Activos */}
          <section>
             <div className="flex items-center gap-3 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green-600"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
              <h2 className="text-xl font-semibold text-gray-800">Cuidados Activos ({activeCares.length})</h2>
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

// Tarjeta Pendiente 
function PendingInvitationCard({ invitation, onAccept, onReject, isUpdating }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${isUpdating ? 'opacity-50' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
         <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{invitation.owner?.full_name || "Dueño"}</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pendiente</span>
          </div>
          {invitation.message && <p className="mt-2 text-gray-600 italic">"{invitation.message}"</p>}
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <button onClick={onReject} disabled={isUpdating} className="w-1/2 sm:w-auto flex-1 justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">{isUpdating ? '...' : 'Rechazar'}</button>
          <button onClick={onAccept} disabled={isUpdating} className="w-1/2 sm:w-auto flex-1 justify-center rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">{isUpdating ? '...' : 'Aceptar'}</button>
        </div>
      </div>
       <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 text-sm text-gray-600">
          <p><strong>Mascota:</strong> {invitation.pet?.name || "N/A"}</p>
          <p><strong>Recibida:</strong> {formatDate(invitation.created_at)}</p>
          {invitation.expires_at && <p><strong>Expira:</strong> {formatDate(invitation.expires_at)}</p>}
        </div>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-800 self-start sm:self-center">Ver Detalles</button>
      </div>
    </div>
  );
}

// Tarjeta Activa
function ActiveCareCard({ care }) {
   return (
     <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{care.owner?.full_name || "Dueño"}</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">Aceptada</span>
          </div>
          <div className="mt-4 space-y-1 text-sm text-gray-600">
            <p><strong>Mascota:</strong> {care.pet?.name || "N/A"}</p>
             {care.accepted_at && <p><strong>Aceptada:</strong> {formatDate(care.accepted_at)}</p>}
             {!care.accepted_at && <p><strong>Invitación creada:</strong> {formatDate(care.created_at)}</p>}
          </div>
        </div>
        <div className="flex-shrink-0">
          <button className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Ver Mascota</button>
        </div>
      </div>
    </div>
   );
}