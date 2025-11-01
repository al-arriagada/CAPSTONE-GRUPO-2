// src/components/Home.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useMyPets from "../hooks/useMyPets.js";
import useAllMyDocuments from "../hooks/useAllMyDocuments.js";
import PetCard from "../components/PetCard.jsx";
import { supabase } from "../supabaseClient.js";
import AssignedPetCard from "../components/caregiver/AssignedPetCard.jsx";
import ComplianceCard from "./ComplianceCard.jsx";
import WalkTrendCard from "./WalkTrendCard.jsx"
import ActivityIndicatorsCard from './ActivityIndicatorsCard.jsx';
import CaregiverPayCard from './CaregiverPayCard.jsx';
// Importa el componente de REGISTRO de gastos
import CaregiverExpensesLog from "./CaregiverExpensesLog.jsx"; 

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pets, loading: petsLoading, refreshing } = useMyPets();
  const { documents, loading: docsLoading } = useAllMyDocuments();

  const [upcomingCount, setUpcomingCount] = useState(0);
  const [tab, setTab] = useState("mascotas");
  const [expandedPetId, setExpandedPetId] = useState(null);
  const [selectedPetFilter, setSelectedPetFilter] = useState('all');

  // Estados de invitaciones
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [familyInvites, setFamilyInvites] = useState(0);

  const ownerName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "usuario";

  /* ------------------------------------------------------- */
  /* Citas de la semana */
  /* ------------------------------------------------------- */
  useEffect(() => {
    // Si solo hay una mascota, selecciónala por defecto.
    if (pets && pets.length === 1) {
      setSelectedPetFilter(pets[0].pet_id);
    } else {
      setSelectedPetFilter('all'); 
    }
  }, [pets]);

  useEffect(() => {
    if (!user) return;

    const fetchUpcomingAppointments = async () => {
      try {
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

  // --- Mascotas compartidas entre dueños ---
  const [sharedPets, setSharedPets] = useState([]);
  const [loadingSharedPets, setLoadingSharedPets] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSharedPets = async () => {
      setLoadingSharedPets(true);
      try {
        // 1️⃣ Obtener los pet_id compartidos con este usuario (status=accepted y rol=owner)
        const { data: sharedLinks, error: memberError } = await supabase
          .schema("petcare")
          .from("pet_member")
          .select("pet_id")
          .eq("member_user_id", user.id)
          .eq("member_role_id", "owner")
          .eq("status", "accepted");

        if (memberError) throw memberError;
        if (!sharedLinks?.length) {
          setSharedPets([]);
          setLoadingSharedPets(false);
          return;
        }

        const petIds = sharedLinks.map((s) => s.pet_id);

        // 2️⃣ Obtener detalles de las mascotas compartidas y su dueño original
        const { data: petsData, error: petsError } = await supabase
          .schema("petcare")
          .from("pet")
          .select(`
          pet_id,
          name,
          breed,
          birth_date,
          image_url,
          species_id,
          user_id,
          current_weight,
          owner:app_user!user_id(full_name)
        `)
          .in("pet_id", petIds);

        if (petsError) throw petsError;

        // 3️⃣ Combinar con teléfonos de los dueños
        const ownerIds = petsData.map((p) => p.user_id).filter(Boolean);
        let phonesMap = {};

        if (ownerIds.length > 0) {
          const { data: phonesData } = await supabase
            .schema("petcare")
            .from("user_pii")
            .select("user_id, phone")
            .in("user_id", ownerIds);

          if (phonesData) {
            phonesMap = phonesData.reduce((acc, item) => {
              acc[item.user_id] = item.phone;
              return acc;
            }, {});
          }
        }

        const combinedPets = petsData.map((p) => ({
          ...p,
          owner: {
            full_name: p.owner?.full_name,
            phone: phonesMap[p.user_id] || null,
          },
        }));

        setSharedPets(combinedPets);
      } catch (err) {
        console.error("Error al cargar mascotas compartidas:", err);
        setSharedPets([]);
      } finally {
        setLoadingSharedPets(false);
      }
    };

    fetchSharedPets();
  }, [user]);
  // --- FIN Mascotas Compartidas ---


  /* ------------------------------------------------------- */
  /* Contador de invitaciones familiares */
  /* ------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { count, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select("*", { count: "exact", head: true })
        .eq("member_user_id", user.id)
        .eq("member_role_id", "owner")
        .eq("status", "pending");

      if (!error && count !== null) setFamilyInvites(count);
    })();
  }, [user]);

  /* ------------------------------------------------------- */
  /* Agrupar documentos por mascota */
  /* ------------------------------------------------------- */
  const documentsByPet = useMemo(() => {
    return documents.reduce((acc, doc) => {
      const petId = doc.owner_pet_id;
      if (!acc[petId]) {
        acc[petId] = {
          petId,
          petName: doc.pet?.name || "Mascota Desconocida",
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

  const handleToggleExpand = (petId) =>
    setExpandedPetId((id) => (id === petId ? null : petId));

  /* ------------------------------------------------------- */
  /* Enviar invitación: cuidador o familiar */
  /* ------------------------------------------------------- */
  const handleInviteSubmit = async (email, petId, inviteType) => {
    if (!email || !petId || !user) return false;
    setIsInviting(true);
    setInviteError(null);

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .schema("petcare")
        .rpc("get_user_id_by_email", { email_to_find: email.toLowerCase().trim() });

      if (rpcError || !rpcData) {
        throw new Error(
          inviteType === "family"
            ? "No se encontró un usuario 'dueño/familiar' con ese correo."
            : "No se encontró un usuario 'cuidador' con ese correo."
        );
      }

      const memberId = rpcData;

      const { error: insertError } = await supabase
        .schema("petcare")
        .from("pet_member")
        .insert({
          pet_id: petId,
          member_user_id: memberId,
          member_role_id: inviteType === "family" ? "owner" : "caregiver",
          permissions:
            inviteType === "family"
              ? ["view", "upload_docs", "create_events"]
              : ["view"],
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          status: "pending",
        });

      if (insertError) throw insertError;

      setIsInviting(false);
      setIsModalOpen(false);
      return true;
    } catch (err) {
      setIsInviting(false);
      setInviteError(err.message);
      return false;
    }
  };

  /* ------------------------------------------------------- */
  /* Render */
  /* ------------------------------------------------------- */
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Acciones principales */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-6">
        <button
          className="relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => navigate("/owner/invitations")}
        >
          <span>Invitaciones Familiares</span>
          {familyInvites > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {familyInvites}
            </span>
          )}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => setIsModalOpen(true)}
        >
          <span>👥</span> Invitar Usuario
        </button>
        
        {/* --- 👇 BOTÓN "Registrar Gasto" ELIMINADO --- */}

        <button
          className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-white text-sm hover:opacity-90"
          onClick={() => navigate("/app/pets/new")}
        >
          <span>＋</span> Registrar Mascota
        </button>
      </div>

      {/* Header */}
      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard de Dueño</h1>
        <p className="mt-1 text-gray-500">
          Gestiona la información y cuidado de tus mascotas
        </p>
      </header>

      {/* Estadísticas */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Mis Mascotas" value={stats.mascotas} helper="registradas" icon="♡" />
        <StatCard title="Citas Próximas" value={stats.citasSemana} helper="esta semana" icon="🗓️" />
        <StatCard title="Historiales" value={stats.historiales} helper="registros médicos" icon="📄" />
      </section>

      {/* Tabs */}
      <div className="mt-6">
        <Tabs value={tab} onChange={setTab} />
      </div>

      {/* Contenido de Tabs */}
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
              {refreshing && <div className="text-xs text-gray-500 mb-2">Actualizando…</div>}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pets.map((p) => (
                  <PetCard key={p.pet_id} pet={p} />
                ))}
              </div>
            </>
          )
        )}

        {/* --- Apartado Mascotas Compartidas --- */}
        {tab === "compartidas" && (
          loadingSharedPets ? (
            <div className="text-center py-10 text-gray-500">Cargando mascotas compartidas...</div>
          ) : sharedPets.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              No tienes mascotas compartidas por otros dueños.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sharedPets.map((pet) => (
                <AssignedPetCard key={pet.pet_id} pet={pet} />
              ))}
            </div>
          )
        )}

        {tab === "citas" && <AppointmentsTab />}

        {tab === "historial" && (
          docsLoading ? (
            <div className="text-center text-gray-500 py-10">Cargando historial médico...</div>
          ) : groupedDocuments.length === 0 ? (
            <EmptyState
              title="Aún no has agregado ningún historial médico."
              actionLabel="Ir a Mascotas"
              onAction={() => setTab("mascotas")}
            />
          ) : (
            <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Mascota</th>
                    <th className="px-6 py-3 text-left font-semibold">Documentos</th>
                    <th className="px-6 py-3"></th>
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

        {/* --- Pestaña Análisis (AHORA INCLUYE GASTOS DE CUIDADOR) --- */}
        {tab === "analisis" && (
          <div>
            <div className="mb-6 flex items-center gap-4">
              <label htmlFor="pet-filter-selector-analisis" className="text-sm font-medium text-gray-700">
                Mostrar análisis para:
              </label>
              <select
                id="pet-filter-selector-analisis"
                value={selectedPetFilter}
                onChange={(e) => setSelectedPetFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm bg-white"
                disabled={petsLoading || !pets || pets.length === 0}
              >
                <option value="all">Todas las Mascotas</option>
                {pets && pets.map((pet) => (
                  <option key={pet.pet_id} value={pet.pet_id}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </div>

            {petsLoading ? (
              <p>Cargando mascotas...</p>
            ) : !pets || pets.length === 0 ? (
              <EmptyState
                title="Registra una mascota para ver análisis."
                actionLabel="Registrar Mascota"
                onAction={() => navigate("/app/pets/new")}
              />
            ) : selectedPetFilter === 'all' ? (
              // Si selecciona "Todas"
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ComplianceCard petId="all" />
                  <WalkTrendCard petId="all" />
                  <CaregiverPayCard petId="all" /> {/* <-- Tarjeta de Gastos movida aquí */}
                  <ActivityIndicatorsCard petId="all" />
              </div>
            ) : (
              // Si selecciona una mascota específica
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ComplianceCard petId={selectedPetFilter} />
                <WalkTrendCard petId={selectedPetFilter} />
                <CaregiverPayCard petId={selectedPetFilter} /> {/* <-- Tarjeta de Gastos movida aquí */}
                <ActivityIndicatorsCard petId={selectedPetFilter} />
              </div>
            )}
          </div>
        )}

        {/* --- Pestaña "Gastos" (AHORA MUESTRA EL REGISTRO) --- */}
        {tab === "gastos" && (
          <div>
            <div className="mb-6 flex items-center gap-4">
              <label htmlFor="pet-filter-selector-gastos" className="text-sm font-medium text-gray-700">
                Registrar pago de cuidador para:
              </label>
              <select
                id="pet-filter-selector-gastos"
                value={selectedPetFilter}
                onChange={(e) => setSelectedPetFilter(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm bg-white"
                disabled={petsLoading || !pets || pets.length === 0}
              >
                {/* Opción 'Todas' deshabilitada/cambiada para forzar selección */}
                <option value="all" disabled={pets.length > 0}>
                  {pets.length > 0 ? "Selecciona una mascota..." : "Primero registra una mascota"}
                </option>
                {pets && pets.map((pet) => (
                  <option key={pet.pet_id} value={pet.pet_id}>
                    {pet.name}
                  </option>
                ))}
              </select>
            </div>

            {petsLoading ? (
               <p>Cargando mascotas...</p>
            ) : !pets || pets.length === 0 ? (
               <EmptyState
                title="Registra una mascota para añadir gastos."
                actionLabel="Registrar Mascota"
                onAction={() => navigate("/app/pets/new")}
              />
            ) : selectedPetFilter === 'all' ? (
               // Muestra un mensaje pidiendo seleccionar una mascota
               <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center text-gray-600">
                 <h3 className="text-lg font-semibold text-gray-800">Selecciona una mascota</h3>
                 <p className="mt-2 text-sm">Elige una mascota del menú superior para registrar el pago de su cuidador.</p>
               </div>
            ) : (
              // Muestra el componente de REGISTRO
              <CaregiverExpensesLog petId={selectedPetFilter} />
            )}
          </div>
        )}
        
      </div>

      <div className="sr-only">Bienvenido, {ownerName}</div>

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
    </div>
  );
}

/* ---------------------- UI helpers ---------------------- */

function PetDocumentGroup({ petName, docs, isExpanded, onToggle }) {
  return (
    <tbody className="divide-y divide-gray-200">
      <tr onClick={onToggle} className="cursor-pointer hover:bg-gray-50">
        <td className="px-6 py-4 font-medium text-gray-900">{petName}</td>
        <td className="px-6 py-4 text-gray-500">{docs.length} documento(s)</td>
        <td className="px-6 py-4">▼</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan="3" className="p-0">
            <div className="px-6 py-4 bg-gray-50/50">
              <ul className="divide-y divide-gray-200">
                {docs.map((doc) => (
                  <li key={doc.doc_id} className="py-2 flex justify-between">
                    <span>{doc.title}</span>
                    <button
                      onClick={() => window.open(doc.public_url, "_blank")}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Descargar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </tbody>
  );
}

function StatCard({ title, value, helper, icon }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <p className="text-sm text-gray-500">{helper}</p>
    </div>
  );
}

// --- Pestaña "Gastos" añadida a la lista ---
function Tabs({ value, onChange }) {
  const items = [
    { key: "mascotas", label: "Mis Mascotas" },
    { key: "compartidas", label: "Mascotas Compartidas" },
    { key: "citas", label: "Citas" },
    { key: "historial", label: "Historial Médico" },
    { key: "analisis", label: "Análisis" },
    { key: "gastos", label: "Gastos" }, // <-- AÑADIDO
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`rounded-xl border px-3 py-1.5 text-sm ${value === it.key
            ? "bg-black text-white border-black"
            : "bg-white hover:bg-gray-50"
            }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ title, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border bg-white p-10 text-center text-gray-600">
      <p className="mb-4 text-lg">{title}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------- */
/* Modal de invitación */
/* ------------------------------------------------------- */
function InviteMemberModal({ pets, onClose, onSubmit, loading, serverError }) {
  const [email, setEmail] = useState("");
  const [selectedPetId, setSelectedPetId] = useState(pets[0]?.pet_id || "");
  const [inviteType, setInviteType] = useState("caregiver");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError("Por favor, ingresa un correo electrónico válido.");
      return;
    }
    if (!selectedPetId) {
      setLocalError("Por favor, selecciona una mascota.");
      return;
    }

    await onSubmit(email, selectedPetId, inviteType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold text-gray-900">Invitar Usuario</h2>
        <p className="mt-1 text-sm text-gray-600">
          Puedes invitar a un cuidador o a un familiar (otro dueño) para compartir una mascota.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo de invitación
            </label>
            <select
              value={inviteType}
              onChange={(e) => setInviteType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
            >
              <option value="family">Familiar / Dueño</option>
              <option value="caregiver">Cuidador</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mascota
            </label>
            <select
              value={selectedPetId}
              onChange={(e) => setSelectedPetId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
              disabled={loading || pets.length === 0}
            >
              <option value="" disabled>
                {pets.length > 0
                  ? "Selecciona una mascota..."
                  : "No tienes mascotas registradas"}
              </option>
              {pets.map((p) => (
                <option key={p.pet_id} value={p.pet_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(localError || serverError) && (
          <p className="mt-4 text-sm font-medium text-red-600">
            {localError || serverError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar Invitación"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------- */
/* Skeleton para mascotas cargando */
/* ------------------------------------------------------- */
function GridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border bg-white p-4"
        >
          <div className="mb-4 h-40 w-full rounded-xl bg-gray-200" />
          <div className="mb-2 h-5 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>
      ))}
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