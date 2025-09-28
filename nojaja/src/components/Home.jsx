// src/components/Home.jsx
import { useState } from "react";
// Si usas un hook de usuario:
import { useAuth } from "../context/AuthContext.jsx";

export default function Home() {
  const { user } = useAuth(); // opcional: para “Bienvenido, …”
  const [tab, setTab] = useState("mascotas");

  // Mock de datos (conecta acá tu API / Supabase)
  const ownerName = user?.user_metadata?.name || user?.email?.split("@")[0] || "usuario";
  const stats = {
    mascotas: 2,
    citasSemana: 2,
    historiales: 1,
  };

  const pets = [
    {
      id: "1",
      name: "Max",
      species: "Perro",
      breed: "Golden Retriever",
      age: "4 años",
      weight: "30 kg",
      lastCheck: "14/01/2024",
      vaccines: 1,
      records: 1,
      image:
        "https://images.unsplash.com/photo-1558944351-c87bafc4f9a6?q=80&w=1600&auto=format&fit=crop",
    },
    {
      id: "2",
      name: "Luna",
      species: "Gato",
      breed: "Siamés",
      age: "3 años",
      weight: "4 kg",
      lastCheck: null,
      vaccines: 0,
      records: 0,
      image:
        "https://images.unsplash.com/photo-1592194996308-7b43878e84a6?q=80&w=1600&auto=format&fit=crop",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Top actions row (derecha) */}
      <div className="flex items-center justify-end gap-3 pt-6">
        <button
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          onClick={() => alert("Invitar Cuidador")}
        >
          <span className="i">👥</span> Invitar Cuidador
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-white text-sm hover:opacity-90"
          onClick={() => alert("Registrar Mascota")}
        >
          <span className="i">＋</span> Registrar Mascota
        </button>
      </div>

      {/* Header */}
      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard de Dueño</h1>
        <p className="mt-1 text-gray-500">Gestiona la información y cuidado de tus mascotas</p>
      </header>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Mis Mascotas"
          value={stats.mascotas}
          helper="mascotas registradas"
          icon="♡"
        />
        <StatCard
          title="Citas Próximas"
          value={stats.citasSemana}
          helper="esta semana"
          icon="🗓️"
        />
        <StatCard
          title="Historiales"
          value={stats.historiales}
          helper="registros médicos"
          icon="📄"
        />
      </section>

      {/* Tabs */}
      <div className="mt-6">
        <Tabs value={tab} onChange={setTab} />
      </div>

      {/* Content per tab */}
      <div className="mt-4">
        {tab === "mascotas" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {pets.map((p) => (
              <PetCard key={p.id} pet={p} />
            ))}
          </div>
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

      {/* Bienvenida (arriba a la derecha tipo “Bienvenido, …”) */}
      <div className="sr-only">Bienvenido, {ownerName}</div>
    </div>
  );
}

/* ----------------------- Componentes UI ----------------------- */

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

function PetCard({ pet }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4">
        <h4 className="text-lg font-semibold">{pet.name}</h4>
        <span className="rounded-full border px-2 py-0.5 text-xs text-gray-600">{pet.species}</span>
      </div>

      {/* Image */}
      <div className="px-5 pt-3">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100">
          <img
            src={pet.image}
            alt={pet.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 text-sm">
        <Row label="Raza" value={pet.breed} />
        <Row label="Edad" value={pet.age} />
        <Row label="Peso" value={pet.weight} />
        <Row
          label="Último chequeo"
          value={pet.lastCheck ? pet.lastCheck : <span className="text-gray-400">—</span>}
        />

        <div className="col-span-2 mt-2 flex items-center gap-2">
          {pet.vaccines > 0 && (
            <Badge>
              {pet.vaccines} vacuna{pet.vaccines > 1 ? "s" : ""}
            </Badge>
          )}
          {pet.records > 0 && <Badge light>{pet.records} registro</Badge>}
        </div>

        {/* Actions */}
        <div className="col-span-2 mt-3 flex gap-3">
          <button
            className="flex-1 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={() => alert(`Ver historial de ${pet.name}`)}
          >
            Ver Historial
          </button>
          <button
            className="flex-1 rounded-xl bg-black px-3 py-2 text-sm text-white hover:opacity-90"
            onClick={() => alert(`Ver citas de ${pet.name}`)}
          >
            🗓️ Ver Citas
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Badge({ children, light = false }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs",
        light ? "border" : "bg-black text-white",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, actionLabel, onAction }) {
  return (
    <div className="rounded-2xl border bg-white p-10 text-center text-gray-600">
      <p className="mb-4 text-lg">{title}</p>
      <button onClick={onAction} className="rounded-xl bg-black px-4 py-2 text-white hover:opacity-90">
        {actionLabel}
      </button>
    </div>
  );
}
