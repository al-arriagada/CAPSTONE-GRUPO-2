// src/components/PetExpensesChart.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

export default function PetExpensesChart({ petId }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    topCategory: { name: 'N/A', amount: 0 },
    monthlyAverage: 0
  });

  useEffect(() => {
    if (!petId) return;
    loadExpenses();
  }, [petId]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema("petcare")
        .from("expense")
        .select(`
          expense_id,
          category_id,
          amount,
          currency_id,
          spent_at,
          expense_category_catalog:category_id(display_name)
        `)
        .eq("pet_id", petId)
        .order("spent_at", { ascending: true });

      if (error) throw error;

      setExpenses(data || []);
      calculateStats(data || []);
    } catch (err) {
      console.error("Error loading expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (expenseData) => {
    if (!expenseData.length) {
      setStats({ total: 0, topCategory: { name: 'N/A', amount: 0 }, monthlyAverage: 0 });
      return;
    }

    // Total
    const total = expenseData.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    // Category totals
    const categoryTotals = {};
    expenseData.forEach(exp => {
      const categoryName = exp.expense_category_catalog?.display_name || exp.category_id;
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + parseFloat(exp.amount || 0);
    });

    // Top category
    const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCategoryEntry
      ? { name: topCategoryEntry[0], amount: topCategoryEntry[1] }
      : { name: 'N/A', amount: 0 };

    // Monthly average (last 6 months)
    const monthlyAverage = total / 6;

    setStats({ total, topCategory, monthlyAverage });
  };

  // Prepare data for Doughnut chart (by category)
  const getCategoryChartData = () => {
    const categoryTotals = {};
    expenses.forEach(exp => {
      const categoryName = exp.expense_category_catalog?.display_name || exp.category_id;
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + parseFloat(exp.amount || 0);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Color palette
    const backgroundColors = [
      'rgba(59, 130, 246, 0.8)',   // blue
      'rgba(16, 185, 129, 0.8)',   // green
      'rgba(251, 146, 60, 0.8)',   // orange
      'rgba(239, 68, 68, 0.8)',    // red
      'rgba(168, 85, 247, 0.8)',   // purple
      'rgba(236, 72, 153, 0.8)',   // pink
    ];

    return {
      labels,
      datasets: [{
        label: 'Gastos por Categoría',
        data,
        backgroundColor: backgroundColors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }]
    };
  };

  // Prepare data for Line chart (last 6 months)
  const getMonthlyChartData = () => {
    const now = new Date();
    const monthsData = [];

    // Generate last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      monthsData.push({ month: monthName, total: 0 });
    }

    // Sum expenses per month
    expenses.forEach(exp => {
      const expDate = new Date(exp.spent_at);
      const monthIndex = monthsData.findIndex(m => {
        const mDate = new Date(now.getFullYear(), now.getMonth() - (5 - monthsData.indexOf(m)), 1);
        return expDate.getFullYear() === mDate.getFullYear() &&
          expDate.getMonth() === mDate.getMonth();
      });

      if (monthIndex >= 0) {
        monthsData[monthIndex].total += parseFloat(exp.amount || 0);
      }
    });

    return {
      labels: monthsData.map(m => m.month),
      datasets: [{
        label: 'Gasto Mensual',
        data: monthsData.map(m => m.total),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500">Cargando análisis...</p>
        </div>
      </div>
    );
  }

  if (!expenses.length) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="mt-2 text-gray-500">No hay gastos registrados</p>
        <p className="mt-1 text-sm text-gray-400">
          Registra gastos para ver el análisis
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <p className="text-sm opacity-90">Total Gastado</p>
          <p className="text-3xl font-bold mt-1">${stats.total.toLocaleString('es-CL')}</p>
          <p className="text-xs opacity-75 mt-1">CLP</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <p className="text-sm opacity-90">Categoría Top</p>
          <p className="text-2xl font-bold mt-1">{stats.topCategory.name}</p>
          <p className="text-sm opacity-75 mt-1">${stats.topCategory.amount.toLocaleString('es-CL')} CLP</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <p className="text-sm opacity-90">Promedio Mensual</p>
          <p className="text-3xl font-bold mt-1">${stats.monthlyAverage.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
          <p className="text-xs opacity-75 mt-1">CLP / mes</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Doughnut Chart - By Category */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Gastos por Categoría</h3>
          <div className="h-64">
            <Doughnut data={getCategoryChartData()} options={chartOptions} />
          </div>
        </div>

        {/* Line Chart - Monthly Trend */}
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Evolución Mensual</h3>
          <div className="h-64">
            <Line data={getMonthlyChartData()} options={chartOptions} />
          </div>
        </div>

      </div>

    </div>
  );
}
