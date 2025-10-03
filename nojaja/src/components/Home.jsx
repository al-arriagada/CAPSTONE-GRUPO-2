// src/components/Home.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useMyPets from "../hooks/useMyPets";          // ⬅️ hook que lista mascotas
import PetCard from "../components/PetCard.jsx";     // ⬅️ tarjeta real

export default function Home() {
  const { user } = useAuth();
  const { pets, loading, refreshing } = useMyPets();
  const [tab, setTab] = useState("mascotas");
  const navigate = useNavigate();

  const ownerName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "usuario";

  // Stats básicas (cuando tengas citas/historial reales, reemplázalas)
  const stats = {
    mascotas: pets.length,
    citasSemana: 0,
    historiales: 0,
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
          loading ? (
            <GridSkeleton />
          ) : pets.length === 0 ? (
            <EmptyState
              title="Aún no tienes mascotas registradas."
              actionLabel="Registrar Mascota"
              onAction={() => navigate("/app/pets/new")}
            />
          ) : (
            <>
              {/* si quieres, un spinner pequeño arriba a la derecha */}
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
            actionLabel="Agendar Cita"
            onAction={() => alert("Agendar Cita")}
          />
        )}

        {tab === "historial" && (
          <EmptyState
            title="Aún no has agregado historial"
            actionLabel="Añadir Registro"
            onAction={() => alert("Añadir Registro")}
          />
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
