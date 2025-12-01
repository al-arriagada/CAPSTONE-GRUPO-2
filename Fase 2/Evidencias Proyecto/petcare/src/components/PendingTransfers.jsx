// src/components/PendingTransfers.jsx
import React, { useEffect, useState } from "react";
import { getMyPendingTransfers, confirmPetTransfer } from "../services/pets";

export default function PendingTransfers() {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState(null);

    useEffect(() => {
        loadPendingTransfers();
    }, []);

    const loadPendingTransfers = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await getMyPendingTransfers();
            setTransfers(data);
        } catch (err) {
            console.error("Error loading pending transfers:", err);
            setError(err.message || "No se pudieron cargar las transferencias pendientes");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmClick = (transfer) => {
        setSelectedTransfer(transfer);
        setShowConfirmModal(true);
    };

    const handleConfirm = async () => {
        if (!selectedTransfer) return;

        setShowConfirmModal(false);
        setConfirming(selectedTransfer.history_id);
        setError("");
        setSuccess("");

        try {
            await confirmPetTransfer(selectedTransfer.confirmation_token);
            setSuccess(`¡${selectedTransfer.pet?.name} ahora es tuya!`);

            // Reload transfers after 1 second
            setTimeout(() => {
                loadPendingTransfers();
                setSuccess("");
            }, 1500);

        } catch (err) {
            console.error("Error confirming transfer:", err);
            setError(err.message || "No se pudo confirmar la transferencia");
        } finally {
            setConfirming(null);
            setSelectedTransfer(null);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("es-CL", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    if (transfers.length === 0) {
        return null; // Don't show anything if no pending transfers
    }

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">

            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-900">
                        Transferencias Pendientes
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                        Tienes {transfers.length} {transfers.length === 1 ? "mascota" : "mascotas"} esperando tu confirmación
                    </p>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    {success}
                </div>
            )}

            {/* Transfer cards */}
            <div className="space-y-3">
                {transfers.map((transfer) => (
                    <div
                        key={transfer.history_id}
                        className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                    >
                        <div className="flex items-start gap-4">

                            {/* Pet image/icon */}
                            <div className="flex-shrink-0">
                                {transfer.pet?.image_url ? (
                                    <img
                                        src={transfer.pet.image_url}
                                        alt={transfer.pet.name}
                                        className="w-16 h-16 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* Transfer info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 mb-1">
                                    {transfer.pet?.name}
                                </h4>
                                <p className="text-sm text-gray-600 mb-1">
                                    <span className="font-medium">De:</span> {transfer.previous_owner?.full_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {formatDate(transfer.transfer_date)}
                                </p>
                                {transfer.reason && (
                                    <p className="text-sm text-gray-700 mt-2 italic">
                                        "{transfer.reason}"
                                    </p>
                                )}
                            </div>

                            {/* Action button */}
                            <div className="flex-shrink-0">
                                <button
                                    onClick={() => handleConfirmClick(transfer)}
                                    disabled={confirming === transfer.history_id}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {confirming === transfer.history_id ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Confirmando...
                                        </>
                                    ) : (
                                        "Aceptar"
                                    )}
                                </button>
                            </div>

                        </div>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && selectedTransfer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        {/* Icon */}
                        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full mb-4">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                            Confirmar Transferencia
                        </h3>

                        {/* Message */}
                        <p className="text-gray-600 text-center mb-6">
                            ¿Estás seguro de que deseas aceptar la transferencia de <span className="font-semibold text-gray-900">{selectedTransfer.pet?.name}</span>?
                        </p>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    setSelectedTransfer(null);
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
