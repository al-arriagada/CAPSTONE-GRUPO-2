import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function PetDiet({ petId: propPetId }) {
  const { id } = useParams();
  const petId = propPetId || id;
  const { user } = useAuth();

  const [diets, setDiets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [foodTypes, setFoodTypes] = useState([]);
  const [form, setForm] = useState({
    food_type_id: "",
    brand: "",
    start_date: "",
    end_date: "",
    price: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && petId) {
      console.log("🐶 Pet ID:", petId);
      console.log("👤 Auth user ID:", user.id);
    }
  }, [user, petId]);

  // 🟢 Cargar tipos de alimento
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("food_type")
        .select("food_type_id, name")
        .order("name");

      if (error) {
        console.error("Error loading food types:", error);
      } else {
        setFoodTypes(data || []);
      }
    })();
  }, [user]);

  // 🟢 Cargar dietas de la mascota
  useEffect(() => {
    if (!user || !petId) return;
    fetchDiets();
  }, [user, petId]);

  const fetchDiets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pet_diet")
        .select("pet_diet_id, food_type_id, brand, start_date, end_date, price")
        .eq("pet_id", petId)
        .order("start_date", { ascending: false });

      if (error) throw error;

      // 🔹 Enlazamos el nombre desde el catálogo local cargado previamente
      const dietsWithNames = (data || []).map((d) => ({
        ...d,
        food_type: foodTypes.find((f) => f.food_type_id === d.food_type_id) || {},
      }));

      setDiets(dietsWithNames);
    } catch (err) {
      console.error("Error cargando dietas:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🧹 Resetear formulario
  const resetForm = () => {
    setForm({
      food_type_id: "",
      brand: "",
      start_date: "",
      end_date: "",
      price: "",
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
  const handleEdit = (diet) => {
    setForm({
      food_type_id: diet.food_type_id,
      brand: diet.brand || "",
      start_date: diet.start_date || "",
      end_date: diet.end_date || "",
      price: diet.price || "",
    });
    setEditing(diet.pet_diet_id);
    setShowModal(true);
  };

  // 💾 Guardar registro (nuevo o editado)
  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    if (!user) {
      setError("Debes iniciar sesión para registrar la dieta.");
      return;
    }

    if (!form.food_type_id || !form.brand.trim() || !form.start_date) {
      setError("Por favor completa todos los campos obligatorios.");
      return;
    }

    if (form.price && isNaN(Number(form.price))) {
      setError("El precio debe ser un número válido.");
      return;
    }

    try {
      if (editing) {
        // Actualizar
        const { error } = await supabase
          .from("pet_diet")
          .update({
            food_type_id: form.food_type_id,
            brand: form.brand.trim(),
            start_date: form.start_date,
            end_date: form.end_date || null,
            price: form.price ? Number(form.price) : null,
          })
          .eq("pet_diet_id", editing)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insertar nuevo
        const { error } = await supabase.from("pet_diet").insert([
          {
            pet_id: petId,
            user_id: user.id,
            food_type_id: form.food_type_id,
            brand: form.brand.trim(),
            start_date: form.start_date,
            end_date: form.end_date || null,
            price: form.price ? Number(form.price) : null,
          },
        ]);

        if (error) throw error;
      }

      await fetchDiets();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Error guardando dieta:", err);
      setError("Ocurrió un error al guardar. Inténtalo nuevamente.");
    }
  };

  // ❌ Eliminar registro
  const handleDelete = async (dietId) => {
    if (!window.confirm("¿Seguro que deseas eliminar este registro?")) return;

    try {
      const { error } = await supabase
        .from("pet_diet")
        .delete()
        .eq("pet_diet_id", dietId)
        .eq("user_id", user.id);

      if (error) throw error;
      setDiets((prev) => prev.filter((d) => d.pet_diet_id !== dietId));
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8 text-gray-600">
        Debes iniciar sesión para gestionar la dieta.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Registro de Dieta</h1>
        <button
          onClick={handleOpenNew}
          className="rounded-xl bg-black text-white px-4 py-2 text-sm hover:opacity-90"
        >
          + Añadir alimento
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">Cargando dietas...</div>
      ) : diets.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          No hay registros de alimentación.
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Tipo</th>
                <th className="px-6 py-3 text-left font-semibold">Marca</th>
                <th className="px-6 py-3 text-left font-semibold">Inicio</th>
                <th className="px-6 py-3 text-left font-semibold">Fin</th>
                <th className="px-6 py-3 text-left font-semibold">Precio</th>
                <th className="px-6 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {diets.map((d) => (
                <tr key={d.pet_diet_id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">{d.food_type?.name || "-"}</td>
                  <td className="px-6 py-3">{d.brand || "-"}</td>
                  <td className="px-6 py-3">{d.start_date}</td>
                  <td className="px-6 py-3">{d.end_date || "—"}</td>
                  <td className="px-6 py-3">
                    {d.price
                      ? `$${Number(d.price).toLocaleString("es-CL")}`
                      : "—"}
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <button
                      onClick={() => handleEdit(d)}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(d.pet_diet_id)}
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
              {editing ? "Editar alimento" : "Registrar alimento"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de alimento
                </label>
                <select
                  value={form.food_type_id}
                  onChange={(e) =>
                    setForm({ ...form, food_type_id: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                >
                  <option value="">Selecciona...</option>
                  {foodTypes.map((f) => (
                    <option key={f.food_type_id} value={f.food_type_id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Marca
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={form.end_date || ""}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Precio (opcional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-black focus:border-black text-sm"
                />
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
