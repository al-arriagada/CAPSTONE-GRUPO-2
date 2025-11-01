// src/components/CaregiverExpensesLog.jsx
// Este componente es específico para registrar pagos a cuidadores.

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function CaregiverExpensesLog({ petId: propPetId }) {
  const { id } = useParams();
  const petId = propPetId || id;
  const { user } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // Guardará el expense_id
  const [form, setForm] = useState({
    notes: "", 
    spent_at: "",
    amount: "",
  });
  const [error, setError] = useState("");

  // 🟢 (Eliminamos la carga de categorías, ya no es necesaria)

  // 🟢 Cargar SOLO gastos de cuidador
  useEffect(() => {
    if (!user || !petId) return;
    fetchExpenses();
  }, [user, petId]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("petcare")
        .from("expense")
        .select("expense_id, notes, spent_at, amount, category_id")
        .eq("pet_id", petId)
        .eq("category_id", "caregiver") // <-- ¡FILTRO IMPORTANTE!
        .order("spent_at", { ascending: false });

      if (error) throw error;
      
      setExpenses(data || []); // Ya no necesitamos mapear nombres

    } catch (err) {
      console.error("Error cargando gastos de cuidador:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🧹 Resetear formulario
  const resetForm = () => {
    setForm({
      notes: "",
      spent_at: "",
      amount: "",
    });
    setError("");
    setEditing(null);
  };

  // 🆕 Abrir modal
  const handleOpenNew = () => {
    resetForm();
    setShowModal(true);
  };

  // ✏️ Editar registro
  const handleEdit = (expense) => {
    setForm({
      notes: expense.notes || "",
      spent_at: expense.spent_at || "",
      amount: expense.amount || "",
    });
    setEditing(expense.expense_id);
    setShowModal(true);
  };

  // 💾 Guardar registro (nuevo o editado)
  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("Debes iniciar sesión para registrar el pago.");
      return;
    }

    if (!form.spent_at || !form.amount) {
      setError("Por favor completa Fecha y Monto.");
      return;
    }

    if (isNaN(Number(form.amount))) {
      setError("El monto debe ser un número válido.");
      return;
    }

    const expenseData = {
      category_id: "caregiver", // <-- ¡VALOR FIJO!
      notes: form.notes.trim() || null, 
      spent_at: form.spent_at,
      amount: Number(form.amount),
    };

    try {
      if (editing) {
        // Actualizar
        const { error } = await supabase
          .schema("petcare")
          .from("expense")
          .update(expenseData)
          .eq("expense_id", editing)
          .eq("user_id", user.id); 

        if (error) throw error;
      } else {
        // Insertar nuevo
        const { error } = await supabase
          .schema("petcare")
          .from("expense")
          .insert([
            {
              ...expenseData,
              pet_id: petId,
              user_id: user.id,
            },
          ]);

        if (error) throw error;
      }

      await fetchExpenses();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Error guardando gasto de cuidador:", err);
      setError("Ocurrió un error al guardar. Inténtalo nuevamente.");
    }
  };

  // ❌ Eliminar registro
  const handleDelete = async (expenseId) => {
    if (!window.confirm("¿Seguro que deseas eliminar este pago?")) return;

    try {
      const { error } = await supabase
        .schema("petcare")
        .from("expense")
        .delete()
        .eq("expense_id", expenseId)
        .eq("user_id", user.id); 

      if (error) throw error;
      setExpenses((prev) => prev.filter((e) => e.expense_id !== expenseId));
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8 text-gray-600">
        Debes iniciar sesión para gestionar los pagos.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Registro de Pagos a Cuidadores</h1>
        <button
          onClick={handleOpenNew}
          className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90"
        >
          + Añadir Pago
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">Cargando pagos...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          No hay pagos a cuidadores registrados.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {/* Columna "Categoría" eliminada */}
                <th className="px-6 py-3 text-left font-semibold">Notas</th>
                <th className="px-6 py-3 text-left font-semibold">Fecha</th>
                <th className="px-6 py-3 text-left font-semibold">Monto</th>
                <th className="px-6 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.map((e) => (
                <tr key={e.expense_id} className="hover:bg-gray-50">
                  {/* Columna "Categoría" eliminada */}
                  <td className="px-6 py-3">{e.notes || "-"}</td>
                  <td className="px-6 py-3">{e.spent_at}</td>
                  <td className="px-6 py-3">
                    {e.amount
                      ? `$${Number(e.amount).toLocaleString("es-CL")}`
                      : "—"}
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <button
                      onClick={() => handleEdit(e)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(e.expense_id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 🧾 Modal de formulario */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <h2 className="text-lg font-semibold mb-4">
              {editing ? "Editar Pago" : "Registrar Pago"}
            </h2>

            <div className="space-y-4">
              
              {/* Bloque de "Categoría" eliminado */}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notas (Opcional)
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ej: Pago cuidador, Semana 1..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha del Pago
                  </label>
                  <input
                    type="date"
                    value={form.spent_at}
                    onChange={(e) =>
                      setForm({ ...form, spent_at: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Monto (CLP)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={form.amount}
                    placeholder="10000"
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-sm font-medium">{error}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90"
              >
                {editing ? "Guardar cambios" : "Registrar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}