// src/components/Home.jsx
import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useMyPets from "../hooks/useMyPets";
import useAllMyDocuments from "../hooks/useAllMyDocuments";
import PetCard from "../components/PetCard.jsx";
import { useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function Home() {
  const { user } = useAuth();
  const { pets, loading: petsLoading, refreshing } = useMyPets();
  const { documents, loading: docsLoading } = useAllMyDocuments();
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [tab, setTab] = useState("mascotas");
  const [expandedPetId, setExpandedPetId] = useState(null); // Estado para controlar la fila expandida
  const navigate = useNavigate();

  // --- NUEVO --- (Estados para el modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  // --- FIN NUEVO ---

  const ownerName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "usuario";

  useEffect(() => {
    if (!user) return;

    const fetchUpcomingAppointments = async () => {
      try {
        // Obtener todas las mascotas del dueño
        const { data: pets, error: petsErr } = await supabase
          .schema("petcare")
          .from("pet")
          .select("pet_id")
          .eq("user_id", user.id);

        if (petsErr || !pets?.length) {
          setUpcomingCount(0);
          return;
        }

        const petIds = pets.map((p) => p.pet_id);

        // Rango de fechas: hoy → 7 días más
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        const { data: events, error: eventsErr } = await supabase
          .schema("petcare")
          .from("event")
          .select("event_id, ts, e_type_id")
          .in("pet_id", petIds)
          .in("e_type_id", ["routine_check", "vaccine_administered"])
          .gte("ts", today.toISOString())
          .lte("ts", nextWeek.toISOString());

        if (eventsErr) throw eventsErr;
        setUpcomingCount(events?.length || 0);
      } catch (err) {
        console.error("Error cargando citas próximas:", err);
        setUpcomingCount(0);
      }
    };

    fetchUpcomingAppointments();
  }, [user]);

  // Agrupa los documentos por mascota
  const documentsByPet = useMemo(() => {
    return documents.reduce((acc, doc) => {
      const petId = doc.owner_pet_id;
      if (!acc[petId]) {
        acc[petId] = {
          petId: petId,
          petName: doc.pet?.name || 'Mascota Desconocida',
          docs: [],
        };
      }
      acc[petId].docs.push(doc);
      return acc;
    }, {});
  }, [documents]);

  const groupedDocuments = Object.values(documentsByPet);

  const stats = {
    mascotas: pets.length,
    citasSemana: upcomingCount,
    historiales: documents.length,
  };

  const handleToggleExpand = (petId) => {
    setExpandedPetId(currentId => (currentId === petId ? null : petId));
  };

  // --- NUEVO --- (Función para guardar la invitación)
  const handleInviteSubmit = async (email, petId) => {
    if (!email || !petId || !user) return false;
    setIsInviting(true);
    setInviteError(null);

    try {
      // -----------------------------------------------------------------
      // 👇 PASO 1: Llamar a la función 'rpc' que valida el rol 'caregiver'
      // -----------------------------------------------------------------
      const { data: rpcData, error: rpcError } = await supabase
        .schema("petcare") 
        .rpc('get_user_id_by_email', { 
          email_to_find: email.toLowerCase().trim() 
        });

      if (rpcError || !rpcData) {
        console.error("Error RPC:", rpcError);
        // Mensaje de error mejorado
        throw new Error("No se encontró un usuario 'cuidador' con ese email.");
      }
      
      const memberId = rpcData; // La función devuelve el UUID directamente

      // -----------------------------------------------------------------
      // 👇 PASO 2: Insertar en 'pet_member'
      // -----------------------------------------------------------------
      const { error: insertError } = await supabase
        .schema("petcare")
        .from("pet_member")
        .insert({
          pet_id: petId,
          member_user_id: memberId, 
          member_role_id: "caregiver", // El rol en la tabla pet_member
          permissions: '{"read"}',
          created_at: new Date().toISOString(),
          invited_at: new Date().toISOString(),
          invited_by: user.id, 
          // status: 'pending' // Se establece por defecto en la BD si agregaste la columna
        });

      if (insertError) throw insertError; // Lanza el error para el catch

      // Éxito
      setIsInviting(false);
      setIsModalOpen(false); // Cierra el modal
      return true;

    } catch (err) {
      setIsInviting(false);
      console.error("Error al invitar cuidador:", err.message);
      if (err.code === '23505') { 
        setInviteError("Este usuario ya es miembro del equipo de esta mascota.");
      } else {
        setInviteError(err.message); // Muestra el error "No se encontró un 'cuidador'..."
      }
      return false;
    }
  };
  // --- FIN NUEVO ---


  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Top actions */}
      <div className="flex items-center justify-end gap-3 pt-6">
        <button
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => setIsModalOpen(true)} // 👈 MODIFICADO
        >
          <span className="i">👥</span> Invitar Cuidador
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-white text-sm hover:opacity-90"
          onClick={() => navigate("/app/pets/new")}
        >
          <span className="i">＋</span> Registrar Mascota
        </button>
      </div>

      {/* Header */}
      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard de Dueño</h1>
        <p className="mt-1 text-gray-500">
          Gestiona la información y cuidado de tus mascotas
        </p>
      </header>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Mis Mascotas" value={stats.mascotas} helper="registradas" icon="♡" />
        <StatCard title="Citas Próximas" value={stats.citasSemana} helper="esta semana" icon="🗓️" />
        <StatCard title="Historiales" value={stats.historiales} helper="registros médicos" icon="📄" />
      </section>

      {/* Tabs */}
      <div className="mt-6">
        <Tabs value={tab} onChange={setTab} />
      </div>

      {/* Content */}
      <div className="mt-4">
        {tab === "mascotas" && (
          petsLoading ? (
            <GridSkeleton />
          ) : pets.length === 0 ? (
            <EmptyState
              title="Aún no tienes mascotas registradas."
              actionLabel="Registrar Mascota"
              onAction={() => navigate("/app/pets/new")}
            />
          ) : (
            <>
              {refreshing && (
                <div className="text-xs text-gray-500 mb-2">Actualizando…</div>
              )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pets.map((p) => (
                  <PetCard key={p.pet_id} pet={p} />
                ))}
              </div>
            </>
          )
        )}

        {tab === "citas" && (
          <AppointmentsTab />
        )}

        {/* 👇 SECCIÓN DE HISTORIAL MODIFICADA CON TABLA EXPANDIBLE */}
        {tab === "historial" && (
          docsLoading ? (
            <div className="text-center text-gray-500 py-10">Cargando historial médico...</div>
          ) : groupedDocuments.length === 0 ? (
            <EmptyState
              title="Aún no has agregado ningún historial médico."
              actionLabel="Ir a Mascotas para añadir"
              onAction={() => setTab("mascotas")}
            />
          ) : (
            <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left font-semibold">Mascota</th>
                    <th scope="col" className="px-6 py-3 text-left font-semibold">Documentos</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Expandir</span></th>
                  </tr>
                </thead>
                {groupedDocuments.map((group) => (
                  <PetDocumentGroup
                    key={group.petId}
                    petName={group.petName}
                    docs={group.docs}
                    isExpanded={expandedPetId === group.petId}
                    onToggle={() => handleToggleExpand(group.petId)}
                  />
                ))}
              </table>
            </div>
          )
        )}

        {tab === "analisis" && (
          <EmptyState
            title="Sin datos suficientes para análisis"
            actionLabel="Explorar Reportes"
            onAction={() => alert("Explorar Reportes")}
          />
        )}
      </div>

      <div className="sr-only">Bienvenido, {ownerName}</div>

      {/* --- NUEVO --- (Renderizado del modal) */}
      {isModalOpen && (
        <InviteMemberModal
          pets={pets}
          onClose={() => {
            setIsModalOpen(false);
            setInviteError(null);
          }}
          onSubmit={handleInviteSubmit}
          loading={isInviting}
          serverError={inviteError}
        />
      )}
      {/* --- FIN NUEVO --- */}

    </div>
  );
}

/* ----------------------- UI helpers ----------------------- */

// 👇 COMPONENTE PARA LA FILA DE LA MASCOTA Y SUS DOCUMENTOS EXPANDIBLES
function PetDocumentGroup({ petName, docs, isExpanded, onToggle }) {
  return (
    <tbody className="divide-y divide-gray-200">
      <tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50">
        <td className="px-6 py-4 font-medium text-gray-900">{petName}</td>
        <td className="px-6 py-4 text-gray-500">{docs.length} documento(s)</td>
        <td className="px-6 py-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 text-gray-400 transition-transform transform ${isExpanded ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan="3" className="p-0">
            <div className="px-6 py-4 bg-gray-50/50">
              <ul className="divide-y divide-gray-200">
                {docs.map(doc => (
                  <DocumentSubRow key={doc.doc_id} document={doc} />
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

// 👇 COMPONENTE PARA LA FILA DE CADA DOCUMENTO INDIVIDUAL
function DocumentSubRow({ document }) {
  const handleDownload = () => {
    if (!document.public_url) return;
    const link = document.createElement("a");
    link.href = document.public_url;
    link.download = document.title;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="font-medium text-gray-800">{document.title}</p>
        <p className="text-xs text-gray-500">
          Subido: {new Date(document.created_at).toLocaleDateString("es-CL")}
        </p>
      </div>
      <button
        onClick={handleDownload}
        disabled={!document.public_url}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        Descargar
      </button>
    </li>
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
        <span className="text-3xl font-semibold">{value}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{helper}</p>
    </div>
  );
}

function Tabs({ value, onChange }) {
  const items = [
    { key: "mascotas", label: "Mis Mascotas" },
    { key: "citas", label: "Citas" },
    { key: "historial", label: "Historial Médico" },
    { key: "analisis", label: "Análisis" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={[
              "rounded-xl border px-3 py-1.5 text-sm",
              active ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50",
            ].join(" ")}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border bg-white p-4">
          <div className="mb-4 h-40 w-full rounded-xl bg-gray-200" />
          <div className="mb-2 h-5 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border bg-white p-10 text-center text-gray-600">
      <p className="mb-4 text-lg">{title}</p>
      <button
        onClick={onAction}
        className="rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function AppointmentsTab() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString("es-CL", {
      dateStyle: "long",
      timeStyle: "short"
    });
  };

  const getIcon = (type) =>
    type === "vaccine_administered" ? "💉" : "👨‍⚕️";

  useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      setLoading(true);

      try {
        // 1️⃣ Obtener todas las mascotas del dueño logueado
        const { data: pets, error: petsError } = await supabase
          .schema("petcare")
          .from("pet")
          .select("pet_id, name")
          .eq("user_id", user.id);

        if (petsError) throw petsError;
        if (!pets || pets.length === 0) {
          setAppointments([]);
          setLoading(false);
          return;
        }

        const petIds = pets.map((p) => p.pet_id);

        // 2️⃣ Obtener los eventos (citas) de todas sus mascotas
        const { data: events, error: eventsError } = await supabase
          .schema("petcare")
          .from("event")
          .select(`
            event_id,
            pet_id,
            e_type_id,
            ts,
            clinic_id,
            vet_id,
            e_description,
            pet(name),
            clinic(name, address, phone),
            vet(full_name)
          `)
          .in("pet_id", petIds)
          .in("e_type_id", ["routine_check", "vaccine_administered"])
          .order("ts", { ascending: false }); // ← más reciente primero

        if (eventsError) throw eventsError;
        setAppointments(events || []);
      } catch (err) {
        console.error("Error cargando citas:", err);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user]);

  if (!user) {
    return <div className="text-center py-10 text-gray-600">Inicia sesión para ver tus citas.</div>;
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Cargando citas...</div>;
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        No hay citas registradas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {appointments.map((a) => (
        <div
          key={a.event_id}
          className="border rounded-2xl p-4 hover:shadow-md transition"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{getIcon(a.e_type_id)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">
                      {a.e_type_id === "vaccine_administered"
                        ? "Vacunación"
                        : "Control Veterinario"}
                    </h4>
                    {new Date(a.ts) > new Date() ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Programado</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Realizado</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDate(a.ts)} — {a.pet?.name || "Mascota"}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                {a.clinic?.name && (
                  <p>🏥 {a.clinic.name}</p>
                )}
                {a.vet?.full_name && (
                  <p>👨‍⚕️ {a.vet.full_name}</p>
                )}
                {a.clinic?.address && (
                  <p>📍 {a.clinic.address}</p>
                )}
                {a.e_description && (
                  <p>📝 {a.e_description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


// --- NUEVO --- (Componente del modal)
function InviteMemberModal({ pets, onClose, onSubmit, loading, serverError }) {
  const [email, setEmail] = useState("");
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.pet_id || "");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    // Limpia el error del servidor anterior si existe
    // if (serverError) setInviteError(null); // <- Causa error si setInviteError no se pasa

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError("Por favor, ingresa un correo electrónico válido.");
      return;
    }
    if (!selectedPetId) {
      setLocalError("Por favor, selecciona una mascota.");
      return;
    }
    
    // Llama a la función 'handleInviteSubmit' que está en Home
    await onSubmit(email, selectedPetId); // 👈 Corregido
  };

  return (
    // Fondo oscuro (backdrop)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Contenedor del modal */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold text-gray-900">Invitar Cuidador</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ingresa el correo del cuidador para la mascota seleccionada.
        </p> {/* 👈 CORREGIDO (antes </loc>) */}

        {/* Formulario */}
        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo electrónico del cuidador
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cuidador@ejemplo.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="pet" className="block text-sm font-medium text-gray-700">
              Mascota
            </label>
            <select
              id="pet"
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
              disabled={loading || pets.length === 0}
            >
              <option value="" disabled>
                {pets.length > 0 ? "Elige una mascota..." : "No tienes mascotas registradas"}
              </option>
              {pets.map((pet) => (
                <option key={pet.pet_id} value={pet.pet_id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sección de "Rol" eliminada */}
          
        </div>

        {/* Errores */}
        {(localError || serverError) && (
          <p className="mt-4 text-sm font-medium text-red-600">
            {localError || serverError}
          </p>
        )}

        {/* Botones de acción */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || pets.length === 0}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Invitando..." : "Enviar Invitación"}
          </button>
        </div>
      </form>
    </div>
  );
}
// --- FIN NUEVO ---