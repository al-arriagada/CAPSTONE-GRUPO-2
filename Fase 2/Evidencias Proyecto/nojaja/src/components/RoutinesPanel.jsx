// src/components/RoutinesPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import NewRoutineModal from "./NewRoutine.jsx"; // ⬅️ importa el modal

export default function RoutinesPanel({ petId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  // ⬇️ estado para abrir/cerrar el modal
  const [showNew, setShowNew] = useState(false);

  const fetchRoutines = async () => {
    if (!user?.id || !petId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .schema("petcare")
      .from("routine")
      .select(
        "routine_id, pet_id, routine_type_id, rrule, time_local, active, updated_at, title"
      )
      .eq("user_id", user.id) // si quieres que miembros vean también, quita esta línea y usa RLS para pet_member
      .eq("pet_id", petId)
      .order("active", { ascending: false })
      .order("time_local", { ascending: true });

    if (error) setError(error.message);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRoutines();
    // Live updates (requiere RLS ok)
    const channel = supabase
      .channel("routines-ch")
      .on(
        "postgres_changes",
        { event: "*", schema: "petcare", table: "routine", filter: `pet_id=eq.${petId}` },
        () => fetchRoutines()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, petId]);

  const counts = useMemo(() => {
    const act = rows.filter((r) => r.active).length;
    return { active: act, inactive: rows.length - act };
  }, [rows]);

  const toggleActive = async (r) => {
    const { error } = await supabase
      .schema("petcare") // ⬅️ importante: usar schema
      .from("routine")
      .update({ active: !r.active })
      .eq("routine_id", r.routine_id);

    if (!error) {
      setRows((prev) =>
        prev.map((x) =>
          x.routine_id === r.routine_id ? { ...x, active: !x.active } : x
        )
      );
    }
  };

  const removeRoutine = async (r) => {
    if (!confirm("¿Eliminar rutina?")) return;
    const { error } = await supabase
      .schema("petcare") // ⬅️ importante: usar schema
      .from("routine")
      .delete()
      .eq("routine_id", r.routine_id);
    if (!error) {
      setRows((prev) => prev.filter((x) => x.routine_id !== r.routine_id));
    }
  };

  const timeHHmm = (t) => (t ? t.slice(0, 5) : "—");

  const ruleBadge = (rrule) => {
    if (!rrule) return null;
    const upper = rrule.toUpperCase();
    const txt = upper.includes("FREQ=DAILY")
      ? "Diaria"
      : upper.includes("FREQ=WEEKLY")
      ? "Semanal"
      : upper.includes("FREQ=MONTHLY")
      ? "Mensual"
      : "Única";
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
        {txt}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">↻</span>
          <div>
            <h3 className="text-lg font-semibold">Rutinas</h3>
            <p className="text-sm text-slate-500">
              {counts.active} activas • {counts.inactive} inactiva
              {counts.inactive === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-black text-white px-4 py-2 text-sm"
            onClick={() => setShowNew(true)} // ⬅️ abre modal
          >
            + Nueva
          </button>
          <button
            className="rounded-xl border px-3 py-2 text-slate-600"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Contraer" : "Expandir"}
          >
            {open ? "▾" : "▸"}
          </button>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="px-2 sm:px-4 pb-4">
          {loading && (
            <div className="p-4 text-sm text-slate-500">Cargando rutinas…</div>
          )}
          {error && (
            <div className="p-4 text-sm text-red-600">Error: {error}</div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="p-4 text-sm text-slate-500">Sin rutinas aún.</div>
          )}

          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li
                key={r.routine_id}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🍽️</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {r.title || r.routine_type_id || "Rutina"}
                      </span>
                      {ruleBadge(r.rrule)} {/* ⬅️ corregido: r.rrule */}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-1">
                      <span>🕒</span>
                      <span>{timeHHmm(r.time_local)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                      r.active
                        ? "border-blue-200 text-blue-700 bg-blue-50"
                        : "border-slate-200 text-slate-600"
                    }`}
                    onClick={() => toggleActive(r)}
                    title={r.active ? "Desactivar" : "Activar"}
                  >
                    🔔
                  </button>

                  <button
                    className="rounded-lg border px-2.5 py-1.5 text-sm text-slate-700"
                    onClick={() => {
                      // TODO: abrir modal de edición
                    }}
                    title="Editar"
                  >
                    ✏️
                  </button>

                  <button
                    className="rounded-lg border px-2.5 py-1.5 text-sm text-red-600 border-red-200"
                    onClick={() => removeRoutine(r)}
                    title="Eliminar"
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal Nueva Rutina */}
      {showNew && (
        <NewRoutineModal
          petId={petId}
          onClose={() => setShowNew(false)}
          onCreated={fetchRoutines} // ⬅️ refresca listado al crear
        />
      )}
    </div>
  );
}
