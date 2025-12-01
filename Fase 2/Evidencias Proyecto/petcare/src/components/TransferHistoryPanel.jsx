// src/components/TransferHistoryPanel.jsx
import React, { useEffect, useState } from "react";
import { getPetTransferHistory } from "../services/pets";

export default function TransferHistoryPanel({ petId }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        loadHistory();
    }, [petId]);

    const loadHistory = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await getPetTransferHistory(petId);
            setHistory(data);
        } catch (err) {
            console.error("Error loading transfer history:", err);
            setError(err.message || "No se pudo cargar el historial");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("es-CL", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-500">Cargando historial...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-gray-500">No hay historial de transferencias</p>
                <p className="mt-1 text-sm text-gray-400">
                    Esta mascota no ha sido transferida anteriormente
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">

            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold">Historial de Transferencias</h3>
                <span className="ml-auto bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {history.length} {history.length === 1 ? "transferencia" : "transferencias"}
                </span>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                {/* Transfer records */}
                <div className="space-y-6">
                    {history.map((transfer, index) => (
                        <div key={transfer.history_id} className="relative pl-10">

                            {/* Timeline dot */}
                            <div className="absolute left-2.5 top-2 w-3 h-3 bg-blue-600 border-4 border-white rounded-full shadow" />

                            {/* Card */}
                            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">

                                {/* Transfer info */}
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {formatDate(transfer.transfer_date)}
                                        </div>

                                        {/* Owners */}
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-gray-700">
                                                    {transfer.previous_owner?.full_name || "Dueño anterior"}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    ({transfer.previous_owner?.email})
                                                </span>
                                            </div>

                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>

                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium text-gray-700">
                                                    {transfer.new_owner?.full_name || "Nuevo dueño"}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    ({transfer.new_owner?.email})
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${transfer.confirmed_by_previous
                                            ? "bg-green-100 text-green-800"
                                            : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                        {transfer.confirmed_by_previous ? "Confirmada" : "Pendiente"}
                                    </div>
                                </div>

                                {/* Reason */}
                                {transfer.reason && (
                                    <div className="mt-3 pt-3 border-t">
                                        <p className="text-xs font-medium text-gray-600 mb-1">Razón:</p>
                                        <p className="text-sm text-gray-700">{transfer.reason}</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
