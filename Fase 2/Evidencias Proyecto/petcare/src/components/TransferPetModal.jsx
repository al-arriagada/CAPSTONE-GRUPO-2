// src/components/TransferPetModal.jsx
import React, { useState } from "react";
import { initiatePetTransfer } from "../services/pets";

export default function TransferPetModal({ open, onClose, petId, petName }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState({
        newOwnerEmail: "",
        reason: "",
        confirmUnderstanding: false,
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        // Validations
        if (!formData.newOwnerEmail.trim()) {
            setError("El email del nuevo dueño es requerido");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.newOwnerEmail)) {
            setError("El email no es válido");
            return;
        }

        if (!formData.reason.trim()) {
            setError("Debes proporcionar una razón para la transferencia");
            return;
        }

        if (!formData.confirmUnderstanding) {
            setError("Debes confirmar que entiendes esta acción");
            return;
        }

        setLoading(true);

        try {
            await initiatePetTransfer(
                petId,
                formData.newOwnerEmail,
                formData.reason
            );

            setSuccess("Transferencia iniciada exitosamente. Se ha notificado al nuevo dueño.");

            // Reset form
            setFormData({
                newOwnerEmail: "",
                reason: "",
                confirmUnderstanding: false,
            });

            // Close modal after 2 seconds
            setTimeout(() => {
                onClose(true); // Pass true to indicate success
            }, 2000);

        } catch (err) {
            console.error("Error al iniciar transferencia:", err);
            setError(err.message || "No se pudo iniciar la transferencia");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({
                newOwnerEmail: "",
                reason: "",
                confirmUnderstanding: false,
            });
            setError("");
            setSuccess("");
            onClose(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="border-b px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Transferir Mascota</h2>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Pet Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Mascota:</strong> {petName}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            Esta mascota será transferida a un nuevo dueño
                        </p>
                    </div>

                    {/* Warning */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex gap-2">
                            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-yellow-800">Advertencia</p>
                                <p className="text-xs text-yellow-700 mt-1">
                                    Esta acción transferirá la propiedad de la mascota. El nuevo dueño deberá confirmar para completar la transferencia.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* New Owner Email */}
                    <div>
                        <label htmlFor="newOwnerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                            Email del nuevo dueño <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            id="newOwnerEmail"
                            name="newOwnerEmail"
                            value={formData.newOwnerEmail}
                            onChange={handleChange}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            placeholder="ejemplo@correo.com"
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            El usuario debe estar registrado en el sistema
                        </p>
                    </div>

                    {/* Reason */}
                    <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                            Razón de la transferencia <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="reason"
                            name="reason"
                            value={formData.reason}
                            onChange={handleChange}
                            disabled={loading}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none"
                            placeholder="Ej: Adopción permanente, cambio de responsable familiar, etc."
                            required
                        />
                    </div>

                    {/* Confirmation Checkbox */}
                    <div className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            id="confirmUnderstanding"
                            name="confirmUnderstanding"
                            checked={formData.confirmUnderstanding}
                            onChange={handleChange}
                            disabled={loading}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            required
                        />
                        <label htmlFor="confirmUnderstanding" className="text-sm text-gray-700">
                            Entiendo que esta acción transferirá la propiedad de <strong>{petName}</strong> y que el nuevo dueño deberá aceptar la transferencia.
                        </label>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                            {success}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={loading}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !formData.confirmUnderstanding}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Procesando...
                                </>
                            ) : (
                                "Confirmar Transferencia"
                            )}
                        </button>
                    </div>

                </form>

            </div>
        </div>
    );
}
