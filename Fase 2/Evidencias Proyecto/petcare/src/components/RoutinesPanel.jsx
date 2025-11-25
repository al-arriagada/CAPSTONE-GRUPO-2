// src/components/RoutinesPanel.jsx
import { useEffect, useMemo, useState, useCallback } from "react"; // ⬅️ Añade useCallback
import { supabase } from "../supabaseClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import NewRoutineModal from "./NewRoutine.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

// ⬇️ Importa el nuevo sub-componente
import RoutineListItem from "./RoutineListItem.jsx";

export default function RoutinesPanel({ petId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // Tus 'routines' (reglas)
  const [error, setError] = useState(null);

  // --- 1. NUEVO ESTADO PARA LAS ALERTAS DE HOY ---
  const [todayAlerts, setTodayAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // 'closed' | 'new' | 'edit'
  const [modalMode, setModalMode] = useState("closed");
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [deletingRoutine, setDeletingRoutine] = useState(null);

  // --- 2. FUNCIÓN PARA CARGAR AMBAS COSAS ---
  const fetchData = useCallback(async () => {
    if (!user?.id || !petId) return;
    setLoading(true);
    setLoadingAlerts(true);
    setError(null);

    // Fechas para "hoy"
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [routinesResult, alertsResult] = await Promise.all([
      // Cargar Reglas (Routines)
      supabase
        .schema("petcare")
        .from("routine")
        .select(
          "routine_id, pet_id, routine_type_id, rrule, time_local, active, updated_at, title"
        )
        .eq("user_id", user.id)
        .eq("pet_id", petId)
        .order("active", { ascending: false })
        .order("time_local", { ascending: true }),

      // Cargar Tareas de Hoy (Alerts)
      supabase
        .schema("petcare")
        .from("alert")
        .select("alert_id, routine_id, status_id, scheduled_at")
        .eq("user_id", user.id)
        .eq("pet_id", petId)
        .in('status_id', ['scheduled', 'sent']) // Solo pendientes
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
    ]);

    if (routinesResult.error) setError(routinesResult.error.message);
    setRows(routinesResult.data || []);
    setLoading(false);

    if (alertsResult.error) setError(alertsResult.error.message);
    setTodayAlerts(alertsResult.data || []);
    setLoadingAlerts(false);

  }, [user?.id, petId]); // ⬅️ useCallback depende de user y petId

  useEffect(() => {
    fetchData();
    // Live updates
    const channel = supabase
      .channel(`routines-panel-ch-${petId}`) // Canal único por mascota
      .on(
        "postgres_changes",
        { event: "*", schema: "petcare", table: "routine", filter: `pet_id=eq.${petId}` },
        fetchData // Recarga todo si cambia una rutina
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "petcare", table: "alert", filter: `pet_id=eq.${petId}` },
        fetchData // Recarga todo si cambia una alerta
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, petId]); // ⬅️ Usar fetchData y petId

  const counts = useMemo(() => {
    const act = rows.filter((r) => r.active).length;
    return { active: act, inactive: rows.length - act };
  }, [rows]);

  const toggleActive = async (r) => {
    const { error } = await supabase
      .schema("petcare")
      .from("routine")
      .update({ active: !r.active })
      .eq("routine_id", r.routine_id);
    if (!error) {
      // La suscripción de Supabase recargará los datos,
      // pero actualizamos localmente para una UI más rápida.
      setRows((prev) =>
        prev.map((x) =>
          x.routine_id === r.routine_id ? { ...x, active: !x.active } : x
        )
      );
    }
  };

  //Lógica de eliminación
  const handleRemove = async (r) => {
    if (!r) return;
    const { error } = await supabase
      .schema("petcare")
      .from("routine")
      .delete()
      .eq("routine_id", r.routine_id);

    if (!error) {
      // Dejamos que la suscripción de Supabase actualice la lista
      setRows((prev) => prev.filter((x) => x.routine_id !== r.routine_id));
      setDeletingRoutine(null);
    } else {
      alert(error.message);
    }
  };

  const timeHHmm = (t) => (t ? t.slice(0, 5) : "—");
  const ruleBadge = (rrule) => {
    if (!rrule) return <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">Única</span>;
    const upper = rrule.toUpperCase();
    const txt = upper.includes("FREQ=DAILY")
      ? "Diaria"
      : upper.includes("FREQ=WEEKLY")
        ? "Semanal"
        : upper.includes("FREQ=MONTHLY")
          ? "Mensual"
          : "Personalizada";
    return (
      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
        {txt}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Header (sin cambios) */}
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
            onClick={() => {
              setSelectedRoutine(null);
              setModalMode("new");
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
          {loading && (<div className="p-4 text-sm text-slate-500">Cargando rutinas…</div>)}
          {error && (<div className="p-4 text-sm text-red-600">Error: {error}</div>)}
          {!loading && !error && rows.length === 0 && (<div className="p-4 text-sm text-slate-500">Sin rutinas aún.</div>)}

          {/* --- 3. Renderiza el NUEVO componente de lista --- */}
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              // Encuentra la alerta de hoy para esta rutina
              const alertForToday = loadingAlerts ? null : todayAlerts.find(
                (a) => a.routine_id === r.routine_id
              );

              return (
                <RoutineListItem
                  key={r.routine_id}
                  routine={r}
                  alert={alertForToday} // Pasa la alerta (o undefined)
                  onToggleActive={() => toggleActive(r)}
                  onEdit={() => {
                    setSelectedRoutine(r);
                    setModalMode("edit");
                  }}
                  onDelete={() => setDeletingRoutine(r)}
                  timeHHmm={timeHHmm}
                  ruleBadge={ruleBadge}
                  // Pasa la función de recarga para que el botón "Completar" pueda usarla
                  onRefresh={fetchData}
                />
              );
            })}
          </ul>
        </div>
      )}

      {/* Renderizado de Modales */}

      {/* Modal para Nueva Rutina o Edición */}
      {modalMode !== "closed" && (
        <NewRoutineModal
          petId={petId}
          onClose={() => setModalMode("closed")}
          onCreated={() => {
            fetchData(); // ⬅️ Usa fetchData
            setModalMode("closed");
          }}
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