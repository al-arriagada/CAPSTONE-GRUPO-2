// src/components/RoutinesPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import NewRoutineModal from "./NewRoutine.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx"; // ⬅️ 1. Importar

export default function RoutinesPanel({ petId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  // ⬇️ 2. Estados para manejar los modales
  // 'closed' | 'new' | 'edit'
  const [modalMode, setModalMode] = useState("closed");
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [deletingRoutine, setDeletingRoutine] = useState(null);

  const fetchRoutines = async () => {
    // ... (tu función fetchRoutines no cambia) ...
    if (!user?.id || !petId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .schema("petcare")
      .from("routine")
      .select(
        "routine_id, pet_id, routine_type_id, rrule, time_local, active, updated_at, title"
      )
      .eq("user_id", user.id)
      .eq("pet_id", petId)
      .order("active", { ascending: false })
      .order("time_local", { ascending: true });
    if (error) setError(error.message);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRoutines();
    // ... (tu suscripción de Supabase no cambia) ...
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
    // ... (no cambia) ...
    const act = rows.filter((r) => r.active).length;
    return { active: act, inactive: rows.length - act };
  }, [rows]);

  const toggleActive = async (r) => {
    // ... (no cambia) ...
    const { error } = await supabase
      .schema("petcare")
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

  // ⬇️ 3. Lógica de eliminación (ahora separada)
  const handleRemove = async (r) => {
    if (!r) return;
    const { error } = await supabase
      .schema("petcare")
      .from("routine")
      .delete()
      .eq("routine_id", r.routine_id);
    
    if (!error) {
      setRows((prev) => prev.filter((x) => x.routine_id !== r.routine_id));
      setDeletingRoutine(null); // Cierra el modal
    } else {
      alert(error.message); // Muestra error si falla
    }
  };

  const timeHHmm = (t) => (t ? t.slice(0, 5) : "—");
  const ruleBadge = (rrule) => {
    // ... (no cambia) ...
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
        {/* ... (título y contadores no cambian) ... */}
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
            // ⬇️ 4. Cambiar el 'onClick'
            onClick={() => {
              setSelectedRoutine(null); // Limpia selección
              setModalMode("new");      // Abre en modo 'new'
            }}
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
          {/* ... (estados de loading, error, empty no cambian) ... */}
          {loading && ( <div className="p-4 text-sm text-slate-500">Cargando rutinas…</div> )}
          {error && ( <div className="p-4 text-sm text-red-600">Error: {error}</div> )}
          {!loading && !error && rows.length === 0 && ( <div className="p-4 text-sm text-slate-500">Sin rutinas aún.</div> )}

          <ul className="flex flex-col gap-3">
            {rows.map((r) => (
              <li
                key={r.routine_id}
                className="flex items-center justify-between rounded-xl border px-4 py-3"
              >
                {/* ... (info de la rutina no cambia) ... */}
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🍽️</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {r.title || r.routine_type_id || "Rutina"}
                      </span>
                      {ruleBadge(r.rrule)}
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

                  {/* ⬇️ 5. Cambiar el 'onClick' de Editar */}
                  <button
                    className="rounded-lg border px-2.5 py-1.5 text-sm text-slate-700"
                    onClick={() => {
                      setSelectedRoutine(r); // Guarda la rutina a editar
                      setModalMode("edit");   // Abre en modo 'edit'
                    }}
                    title="Editar"
                  >
                    ✏️
                  </button>

                  {/* ⬇️ 6. Cambiar el 'onClick' de Eliminar */}
                  <button
                    className="rounded-lg border px-2.5 py-1.5 text-sm text-red-600 border-red-200"
                    onClick={() => setDeletingRoutine(r)} // Abre el modal de confirm.
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

      {/* ⬇️ 7. Renderizado de Modales */}
      
      {/* Modal para Nueva Rutina o Edición */}
      {modalMode !== "closed" && (
        <NewRoutineModal
          petId={petId}
          onClose={() => setModalMode("closed")}
          onCreated={() => {
            fetchRoutines();
            setModalMode("closed");
          }}
          // Pasa la rutina seleccionada si estamos en modo 'edit'
          routineToEdit={modalMode === "edit" ? selectedRoutine : null}
        />
      )}

      {/* Modal de Confirmación para Eliminar */}
      {deletingRoutine && (
        <ConfirmDialog
          open={!!deletingRoutine}
          title="Eliminar Rutina"
          description={`¿Estás seguro de que quieres eliminar la rutina "${deletingRoutine.title}"? Esta acción no se puede deshacer.`}
          confirmText="Sí, eliminar"
          danger
          onConfirm={() => handleRemove(deletingRoutine)}
          onCancel={() => setDeletingRoutine(null)}
        />
      )}
    </div>
  );
}