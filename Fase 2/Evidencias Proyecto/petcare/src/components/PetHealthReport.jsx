// src/pages/PetHealthReport.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { PDFDownloadLink } from '@react-pdf/renderer';
import PetHealthReportPDF from './PetHealthReportPDF';
import { supabase } from "../supabaseClient";
import { generateWeightChartImage } from '../utils/chartGenerator';


export default function PetHealthReport() {
  const { id } = useParams();
  const navigate = useNavigate();


  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [owner, setOwner] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [weightChartImage, setWeightChartImage] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      // 1) Mascota
      const { data: p, error: pe } = await supabase
        .schema("petcare")
        .from("pet")
        .select("*")
        .eq("pet_id", id)
        .maybeSingle();

      if (pe) {
        setError(pe.message);
        setLoading(false);
        return;
      }
      if (!p) {
        setError("Mascota no encontrada.");
        setLoading(false);
        return;
      }
      setPet(p);

      // 2) Owner (sin RPC; directo a tablas)
      const [u1, u2] = await Promise.all([
        supabase
          .schema("petcare")
          .from("app_user")
          .select("user_id, full_name, email")
          .eq("user_id", p.user_id)
          .maybeSingle(),
        supabase
          .schema("petcare")
          .from("user_pii")
          .select("phone, address_line")
          .eq("user_id", p.user_id)
          .maybeSingle(),
      ]);

      const ownerData = {
        full_name: u1.data?.full_name ?? "",
        email: u1.data?.email ?? "",
        phone: u2.data?.phone ?? "",
        address_line: u2.data?.address_line ?? "",
      };
      setOwner(ownerData);

      // 3) Eventos (para vacunas + historia)
      const { data: evs, error: ee } = await supabase
        .schema("petcare")
        .from("event")
        .select(`
          event_id, ts, e_type_id, details, var_weight,
          event_type_catalog(display_name),
          vaccine_event(next_due_date)
        `)
        .eq("pet_id", id)
        .order("ts", { ascending: false });

      if (ee) {
        setError(ee.message);
        setLoading(false);
        return;
      }
      setEvents(evs || []);
      setLoading(false);
    })();
  }, [id]);

  // ==== helpers ====
  const speciesName = (sid) => speciesCache[sid] || "—";


  // Si quieres mapear ids -> nombre sin otro fetch, puedes mantener un diccionario manual:
  const speciesCache = useMemo(
    () => ({
      // rellena si lo necesitas, o déjalo vacío y que muestre "—"
      // 1: "Perro", 2: "Gato", ...
    }),
    []
  );


  const calcAge = (birth) => {
    if (!birth) return "";
    const today = new Date();
    const d = new Date(birth);
    let y = today.getFullYear() - d.getFullYear();
    let m = today.getMonth() - d.getMonth();
    if (m < 0) { y -= 1; m += 12; }
    if (y === 0) return `${m} ${m === 1 ? "mes" : "meses"}`;
    return `${y} ${y === 1 ? "año" : "años"}${m ? `, ${m}m` : ""}`;
  };

  const today = new Date();
  const in60d = new Date();
  in60d.setDate(in60d.getDate() + 60);

  const vaccineRows = useMemo(
    () =>
      (events || []).filter((e) =>
        (e.event_type_catalog?.display_name || "").toLowerCase().includes("vacuna")
      ),
    [events]
  );

  const vaccTotals = useMemo(() => {
    const total = vaccineRows.length;
    let upcoming = 0;
    let overdue = 0;
    for (const v of vaccineRows) {
      const due = v?.vaccine_event?.next_due_date
        ? new Date(v.vaccine_event.next_due_date)
        : null;
      if (!due) continue;
      if (due < today) overdue++;
      else if (due <= in60d) upcoming++;
    }
    return { total, upcoming, overdue };
  }, [vaccineRows]);

  // “Puntaje” simple (0..100) SOLO para mostrar algo:
  const healthScore = useMemo(() => {
    if (!pet) return 50;
    let s = 50;
    if (pet.neutered) s += 5;
    if (pet.current_weight) s += 5;
    // vacunas: +20 si no hay vencidas, +10 si hay próximas, -10 si hay vencidas
    if (vaccTotals.overdue === 0) s += 20; else s -= 10;
    if (vaccTotals.upcoming > 0) s += 10;
    // cap
    if (s > 100) s = 100;
    if (s < 0) s = 0;
    return s;
  }, [pet, vaccTotals]);

  // Historial 6 meses
  const last6m = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return (events || []).filter((e) => new Date(e.ts) >= d);
  }, [events]);

  // Variaciones de peso de últimos 6 meses
  const weightVariations = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);

    return (events || [])
      .filter((e) => e.var_weight && new Date(e.ts) >= d)
      .map((e) => {
        const v = typeof e.var_weight === "string"
          ? JSON.parse(e.var_weight)
          : e.var_weight;

        return {
          date: v.date,      // "2025-11-13"
          value: v.value,    // 8
          ts: e.ts           // para ordenar
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // más antiguo → nuevo
  }, [events]);

  // Generar gráfico de peso cuando hay datos disponibles
  useEffect(() => {
    (async () => {
      if (weightVariations && weightVariations.length > 0) {
        const chartImage = await generateWeightChartImage(weightVariations);
        setWeightChartImage(chartImage);
      }
    })();
  }, [weightVariations]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando reporte…
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
          >
            ← Volver
          </button>
        </div>
        <div className="rounded-xl border bg-red-50 text-red-700 p-4">
          {error || "No se pudo generar el reporte."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 print:px-0">
      {/* Acciones */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
          >
            ← Volver
          </button>
          <div className="pl-2">
            <div className="text-sm text-gray-500">Reporte de Salud</div>
            <div className="text-xl font-semibold">{pet.name}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg border hover:bg-gray-50 text-sm"
          >
            Imprimir / PDF
          </button>
          <PDFDownloadLink
            document={
              <PetHealthReportPDF
                pet={pet}
                owner={owner}
                events={last6m}
                vaccTotals={vaccTotals}
                healthScore={healthScore}
                weightVariations={weightVariations}
                weightChartImage={weightChartImage}
              />
            }
            fileName={`reporte-salud-${pet.name}-${new Date().toISOString().split('T')[0]}.pdf`}
            className="px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 text-sm"
          >
            {({ loading }) => loading ? 'Generando PDF...' : 'Descargar PDF'}
          </PDFDownloadLink>
        </div>
      </div>

      {/* Encabezado del reporte */}
      <div className="rounded-xl border bg-black text-white p-5">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Reporte de Salud de Mascota</div>
          <div className="text-sm opacity-90">
            Generado el{" "}
            {new Date().toLocaleDateString("es-CL", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </div>

      {/* Datos principales */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Card title="Información de la Mascota">
          <InfoLine label="Nombre" value={pet.name || "—"} />
          <InfoLine label="Especie" value={speciesName(pet.species_id)} />
          <InfoLine label="Raza" value={pet.breed || "—"} />
          <InfoLine label="Edad" value={calcAge(pet.birth_date) || "—"} />
          <InfoLine label="Peso" value={pet.current_weight ? `${pet.current_weight} kg` : "—"} />
          <InfoLine label="Esterilizado" value={pet.neutered ? "Sí" : "No"} />
          {pet.microchip && <InfoLine label="Microchip" value={pet.microchip} />}
        </Card>

        <Card title="Información del Dueño">
          <InfoLine label="Nombre" value={owner?.full_name || "—"} />
          <InfoLine label="Email" value={owner?.email || "—"} />
          <InfoLine label="Teléfono" value={owner?.phone || "—"} />
          {owner?.address_line && <InfoLine label="Dirección" value={owner.address_line} />}
        </Card>
      </div>

      {/* Puntaje salud */}
      <Card className="mt-4" title="Puntuación de Salud General">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full border-4 border-yellow-400 flex items-center justify-center text-xl font-bold">
            {healthScore}
          </div>
          <div className="flex-1">
            <div className="h-2 rounded bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-black"
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Puntaje estimado según vacunas, peso y estado general. (Referencia aproximada)
            </div>
          </div>
        </div>
      </Card>

      {/* Vacunación */}
      <Card className="mt-4" title="Estado de Vacunación">
        <div className="grid md:grid-cols-3 gap-4">
          <StatBox label="Total de vacunas registradas" value={vaccTotals.total} />
          <StatBox label="Próximas (60 días)" value={vaccTotals.upcoming} />
          <StatBox label="Vencidas" value={vaccTotals.overdue} danger={vaccTotals.overdue > 0} />
        </div>
        {vaccineRows.length === 0 && (
          <div className="text-sm text-gray-600 mt-6">
            No hay vacunas registradas.
          </div>
        )}
      </Card>

      {/* Historial 6 meses */}
      <Card className="mt-4" title="Historial Médico Reciente">
        <div className="text-sm text-gray-500 mb-3">
          Últimos 6 meses — Total de {last6m.length} registros
        </div>
        {last6m.length === 0 ? (
          <div className="text-sm text-gray-600">
            No hay registros en los últimos 6 meses.
          </div>
        ) : (
          <ul className="divide-y">
            {last6m.map((e) => (
              <li key={e.event_id} className="py-2 flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {e.event_type_catalog?.display_name || "Evento"}
                  </div>
                  {e.var_weight && (
                    <div className="text-sm text-gray-600">
                      {typeof e.var_weight === "object" ? JSON.stringify(e.var_weight) : String(e.var_weight)}
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(e.ts).toLocaleDateString("es-CL")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4" title="Variaciones de Peso">
        {weightVariations.length === 0 ? (
          <div className="text-sm text-gray-600">
            No se han registrado variaciones en el peso.
          </div>
        ) : (
          <ul className="divide-y">
            {weightVariations.map((w, i) => {
              const fecha = new Date(w.date).toLocaleDateString("es-CL", {
                day: "numeric",
                month: "long",
                year: "numeric"
              });

              return (
                <li key={i} className="py-2">
                  <span className="font-medium">{w.value} kg</span>
                  <span className="text-sm text-gray-600">
                    {`, registrado el ${fecha}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Recomendaciones simples */}
      <Card className="mt-4" title="Recomendaciones">
        <ul className="space-y-2 text-sm">
          {last6m.length === 0 && (
            <li className="rounded-lg bg-gray-50 p-2">
              No hay registros recientes. Se recomienda un chequeo general cada 6–12 meses.
            </li>
          )}
          {vaccTotals.overdue > 0 && (
            <li className="rounded-lg bg-red-50 text-red-700 p-2">
              Hay vacunas vencidas. Agenda una cita para regularizar el calendario de vacunación.
            </li>
          )}
          {!pet?.microchip && (
            <li className="rounded-lg bg-gray-50 p-2">
              Considera colocar un microchip para mayor seguridad.
            </li>
          )}
        </ul>
      </Card>

      {/* Pie */}
      <div className="text-center text-xs text-gray-500 mt-6 pb-6">
        Este reporte fue generado automáticamente por PetCare Pro.
        <br />
        Fecha de generación:{" "}
        {new Date().toLocaleString("es-CL")}
      </div>

      {/* Estilos impresión básicos */}
      <style>{`
        @media print {
          @page { margin: 16mm; }
          .print\\:hidden { display: none !important; }
          button, a[href] { display: none !important; }
          body { color: #000; }
        }
      `}</style>
    </div>
  );
}

// ===== UI helpers =====
function Card({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl border bg-white p-5 ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      {children}
    </section>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function StatBox({ label, value, danger = false }) {
  return (
    <div className={`rounded-xl border p-4 ${danger ? "bg-red-50 border-red-200 text-red-700" : "bg-gray-50"}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs mt-1">{label}</div>
    </div>
  );
}
