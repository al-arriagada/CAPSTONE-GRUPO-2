// src/components/Home.jsx
import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useMyPets from "../hooks/useMyPets";
import useAllMyDocuments from "../hooks/useAllMyDocuments";
import PetCard from "../components/PetCard.jsx";

export default function Home() {
  const { user } = useAuth();
  const { pets, loading: petsLoading, refreshing } = useMyPets();
  const { documents, loading: docsLoading } = useAllMyDocuments();
  const [tab, setTab] = useState("mascotas");
  const [expandedPetId, setExpandedPetId] = useState(null); // Estado para controlar la fila expandida
  const navigate = useNavigate();

  const ownerName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "usuario";

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
    citasSemana: 0,
    historiales: documents.length,
  };

  const handleToggleExpand = (petId) => {
    setExpandedPetId(currentId => (currentId === petId ? null : petId));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Top actions */}
      <div className="flex items-center justify-end gap-3 pt-6">
        <button
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => alert("Invitar Cuidador")}
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
          <EmptyState
            title="No hay citas para mostrar"
            actionLabel="Agregar Cita"
            onAction={() => alert("Agregar Cita")}
          />
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