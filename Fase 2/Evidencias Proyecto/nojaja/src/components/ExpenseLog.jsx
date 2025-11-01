import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function ExpenseLog() {
    const { id } = useParams();
    const petId = id;
    const { user } = useAuth();

    const [expenses, setExpenses] = useState([]);
    const [formData, setFormData] = useState({
        category_id: "",
        amount: "",
        currency_id: "CLP",
        spent_at: "",
        comuna_id: "",
    });

    const [categories, setCategories] = useState([]);
    const [currencies, setCurrencies] = useState([]);

    useEffect(() => {
        if (!user) return;
        loadCategories();
        loadCurrencies();
        fetchExpenses();
    }, [user, petId]);

    // Cargar categorías
    async function loadCategories() {
        const { data, error } = await supabase
            .schema("petcare")
            .from("expense_category_catalog")
            .select("category_id, display_name")
            .order("display_name", { ascending: true });

        if (error) console.error("Error loading categories:", error);
        else setCategories(data || []);
    }

    // Cargar monedas
    async function loadCurrencies() {
        const { data, error } = await supabase
            .schema("petcare")
            .from("currency")
            .select("currency_id")
            .order("currency_id", { ascending: true });

        if (error) console.error("Error loading currencies:", error);
        else setCurrencies(data || []);
    }

    // Obtener gastos existentes
    async function fetchExpenses() {
        const { data, error } = await supabase
            .schema("petcare")
            .from("expense")
            .select(
                `
        expense_id,
        category_id,
        amount,
        currency_id,
        spent_at,
        expense_category_catalog:category_id(display_name)
        `
            )
            .eq("user_id", user.id)
            .eq("pet_id", petId)
            .order("spent_at", { ascending: false });

        if (error) console.error("Error fetching expenses:", error);
        else setExpenses(data || []);
    }

    // Manejar cambios del formulario
    function handleChange(e) {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Guardar nuevo gasto
    async function handleSubmit(e) {
        e.preventDefault();

        if (!formData.amount || !formData.category_id || !formData.spent_at) {
            alert("Por favor completa todos los campos requeridos.");
            return;
        }

        const { error } = await supabase
            .schema("petcare")
            .from("expense")
            .insert([
                {
                    user_id: user.id,
                    pet_id: petId,
                    category_id: formData.category_id,
                    amount: formData.amount,
                    currency_id: formData.currency_id || "CLP", // ✅ valor por defecto
                    spent_at: formData.spent_at,
                    comuna_id: formData.comuna_id || null,
                },
            ]);

        if (error) {
            console.error("Error inserting expense:", error);
            alert("Error al guardar el gasto.");
        } else {
            setFormData({
                category_id: "",
                amount: "",
                currency_id: "CLP",
                spent_at: "",
                comuna_id: "",
            });
            fetchExpenses();
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h2 className="text-xl font-semibold mb-4">💸 Registro de Gastos</h2>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-xl shadow">
                {/* Categoría */}
                <div>
                    <label className="block text-sm font-medium mb-1">Categoría</label>
                    <select
                        name="category_id"
                        value={formData.category_id}
                        onChange={handleChange}
                        className="w-full border rounded-md p-2"
                        required
                    >
                        <option value="">Selecciona una categoría</option>
                        {categories.map((cat) => (
                            <option key={cat.category_id} value={cat.category_id}>
                                {cat.display_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Monto y Moneda en una línea */}
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">Monto</label>
                        <input
                            type="number"
                            name="amount"
                            value={formData.amount}
                            onChange={handleChange}
                            className="w-full border rounded-md p-2"
                            required
                        />
                    </div>

                    <div className="w-28">
                        <label className="block text-sm font-medium mb-1">Moneda</label>
                        <select
                            name="currency_id"
                            value={formData.currency_id}
                            onChange={handleChange}
                            className="w-full border rounded-md p-2"
                        >
                            {currencies.map((c) => (
                                <option key={c.currency_id} value={c.currency_id}>
                                    {c.currency_id}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Fecha */}
                <div>
                    <label className="block text-sm font-medium mb-1">Fecha</label>
                    <input
                        type="date"
                        name="spent_at"
                        value={formData.spent_at}
                        onChange={handleChange}
                        className="w-full border rounded-md p-2"
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700"
                >
                    Guardar Gasto
                </button>
            </form>

            {/* Lista de gastos */}
            <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">📋 Historial de Gastos</h3>
                {expenses.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay registros aún.</p>
                ) : (
                    <ul className="space-y-2">
                        {expenses.map((exp) => (
                            <li
                                key={exp.expense_id}
                                className="border rounded-md p-3 bg-gray-50 flex justify-between"
                            >
                                <div>
                                    <p className="font-medium">
                                        {exp.expense_category_catalog?.display_name || exp.category_id}
                                    </p>
                                    <p className="text-sm text-gray-500">{exp.spent_at}</p>
                                </div>
                                <p className="font-semibold">
                                    {exp.amount} {exp.currency_id}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
