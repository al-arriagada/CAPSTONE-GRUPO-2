import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function PetExpensesChart({ userId }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const loadAnalytics = async () => {
      const { data, error } = await supabase
        .schema("analytics")
        .from("v_monthly_pet_expenses")
        .select("anio, mes, nombre_categoria, total_gasto")
        .eq("user_id", userId);

      if (error) console.error("Error cargando datos:", error);
      else {
        // Recharts espera arrays con labels legibles
        const formatted = data.map((d) => ({
          period: `${d.mes}/${d.anio}`,
          categoria: d.nombre_categoria,
          total: Number(d.total_gasto),
        }));
        setData(formatted);
      }
    };
    loadAnalytics();
  }, [userId]);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Gastos Mensuales por Categoría</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="total" fill="#6366F1" name="Total CLP" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
