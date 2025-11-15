// src/components/owner/OwnerInvitations.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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

export default function OwnerInvitations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);

  // --- Cargar invitaciones familiares ---
  const fetchInvitations = async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);

    const { data, error } = await supabase
      .schema("petcare")
      .from("pet_member")
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
      .eq("member_role_id", "owner")
      .in("status", ["pending", "accepted"]);

    if (error) {
      console.error("Error al cargar invitaciones familiares:", error);
      setError(error.message);
      setInvitations([]);
    } else {
      setInvitations(data || []);
      setError(null);
    }

    if (showLoading) setLoading(false);
  };

  useEffect(() => {
    fetchInvitations(true);
  }, [user]);

  // --- Aceptar invitación ---
  const handleAccept = async (petId) => {
    setUpdatingId(petId);
    const { error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .update({ status: "accepted" })
      .eq("pet_id", petId)
      .eq("member_user_id", user.id);
    setUpdatingId(null);

    if (error) {
      alert("Error al aceptar invitación: " + error.message);
    } else {
      fetchInvitations(false);
    }
  };

  // --- Rechazar invitación ---
  const handleReject = async (petId) => {
    setUpdatingId(petId);
    const { error } = await supabase
      .schema("petcare")
      .from("pet_member")
      .update({ status: "rejected" })
      .eq("pet_id", petId)
      .eq("member_user_id", user.id);
    setUpdatingId(null);

    if (error) {
      alert("Error al rechazar invitación: " + error.message);
    } else {
      fetchInvitations(false);
    }
  };

  // --- Agrupar invitaciones ---
  const { pendingInvitations, acceptedInvitations } = useMemo(() => {
    return invitations.reduce(
      (acc, inv) => {
        if (inv.status === "pending") acc.pendingInvitations.push(inv);
        else if (inv.status === "accepted") acc.acceptedInvitations.push(inv);
        return acc;
      },
      { pendingInvitations: [], acceptedInvitations: [] }
    );
  }, [invitations]);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <Link
        to="/app"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
        Volver al Dashboard
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Invitaciones Familiares
        </h1>
        <p className="mt-1 text-gray-500">
          Gestiona las invitaciones para compartir mascotas con otros dueños.
        </p>
      </header>

      {loading && <div className="text-center py-10">Cargando invitaciones...</div>}
      {error && <div className="text-center py-10 text-red-600">Error: {error}</div>}

      {!loading && (
        <div className="space-y-10">
          {/* Pendientes */}
          <section>
            <div className="flex items-center gap-3 mb-4">
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
                    isUpdating={updatingId === inv.pet_id}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">
                No tienes invitaciones pendientes
              </p>
            )}
          </section>

          {/* Aceptadas */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Mascotas Compartidas ({acceptedInvitations.length})
              </h2>
            </div>
            {acceptedInvitations.length > 0 ? (
              <div className="space-y-4">
                {acceptedInvitations.map((inv) => (
                  <AcceptedInvitationCard key={inv.pet_id} invitation={inv} />
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">
                No tienes mascotas compartidas
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------------- Helper Components ---------------- */

function PendingInvitationCard({ invitation, onAccept, onReject, isUpdating }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        isUpdating ? "opacity-50" : ""
      }`}
    >
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
          <p className="mt-2 text-gray-600">
            <strong>Mascota:</strong> {invitation.pet?.name || "N/A"}
          </p>
          <p className="text-sm text-gray-500">
            Recibida: {formatDate(invitation.created_at)}
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onReject}
            disabled={isUpdating}
            className="w-1/2 sm:w-auto flex-1 justify-center rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isUpdating ? "..." : "Rechazar"}
          </button>
          <button
            onClick={onAccept}
            disabled={isUpdating}
            className="w-1/2 sm:w-auto flex-1 justify-center rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {isUpdating ? "..." : "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AcceptedInvitationCard({ invitation }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {invitation.pet?.name || "Mascota"}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Aceptada
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Compartida por {invitation.owner?.full_name || "otro dueño"}
          </p>
        </div>
      </div>
    </div>
  );
}