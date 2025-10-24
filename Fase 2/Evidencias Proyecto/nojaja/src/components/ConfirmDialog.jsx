// src/components/ConfirmDialog.jsx
import React from "react";

// Este es el mismo componente que tenías en PetDetail.jsx
export default function ConfirmDialog({
  open,
  title = "Confirmar acción",
  description = "¿Estás segur@?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  danger = false,
  requireText = false,
  expectedText = "",
  disabled = false,
}) {
  const [typed, setTyped] = React.useState("");

  React.useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const normalize = (s) =>
    (s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const matchOK = !requireText || normalize(typed) === normalize(expectedText);
  const canConfirm = !disabled && matchOK;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{description}</p>

        {requireText && (
          <div className="mt-4">
            <label className="text-sm text-gray-700">
              Para continuar, escribe el nombre exacto:{" "}
              <span className="font-semibold">{expectedText}</span>
            </label>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) onConfirm();
              }}
              className="mt-2 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              placeholder={`Escribe: ${expectedText}`}
              disabled={disabled}
            />
            {typed && !matchOK && (
              <p className="text-xs text-red-600 mt-1">El texto no coincide.</p>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={disabled}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-white disabled:opacity-50 ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-black hover:bg-gray-800"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}