// src/components/AnalyticsDashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useMyPets from "../hooks/useMyPets.js";
import ComplianceCard from "./ComplianceCard.jsx";
import WalkTrendCard from "./WalkTrendCard.jsx";
import ActivityIndicatorsCard from "./ActivityIndicatorsCard.jsx";
import CaregiverPayCard from "./CaregiverPayCard.jsx";

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { pets, loading: petsLoading } = useMyPets();

  const [selectedPetFilter, setSelectedPetFilter] = useState("all");

  // Si solo hay una mascota, seleccionarla por defecto
  useEffect(() => {
    if (pets && pets.length === 1) {
      setSelectedPetFilter(pets[0].pet_id);
    } else {
      setSelectedPetFilter("all");
    }
  }, [pets]);

  const handleBack = () => {
    navigate("/app");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header / Barra superior */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
        >
          ← Volver al Dashboard
        </button>

        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Análisis de Rutinas y Gastos
        </h1>
      </div>

      {/* Selector de mascota */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <label
          htmlFor="pet-filter-selector-analytics"
          className="text-sm font-medium text-gray-700"
        >
          Mostrar análisis para:
        </label>
        <select
          id="pet-filter-selector-analytics"
          value={selectedPetFilter}
          onChange={(e) => setSelectedPetFilter(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm bg-white"
          disabled={petsLoading || !pets || pets.length === 0}
        >
          <option value="all">Todas las Mascotas</option>
          {pets &&
            pets.map((pet) => (
              <option key={pet.pet_id} value={pet.pet_id}>
                {pet.name}
              </option>
            ))}
        </select>
      </div>

      {/* Contenido principal */}
      {petsLoading ? (
        <p className="text-gray-500">Cargando mascotas...</p>
      ) : !pets || pets.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-gray-600">
          <p className="mb-4 text-lg">
            Registra una mascota para ver análisis.
          </p>
          <button
            onClick={() => navigate("/app/pets/new")}
            className="rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
          >
            Registrar Mascota
          </button>
        </div>
      ) : (
        <>
          {selectedPetFilter === "all" ? (
            // Vista agregada: todas las mascotas
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ComplianceCard petId="all" />
              <WalkTrendCard petId="all" />
              <CaregiverPayCard petId="all" />
              <ActivityIndicatorsCard petId="all" />
            </div>
          ) : (
            // Vista filtrada: una mascota específica
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ComplianceCard petId={selectedPetFilter} />
              <WalkTrendCard petId={selectedPetFilter} />
              <CaregiverPayCard petId={selectedPetFilter} />
              <ActivityIndicatorsCard petId={selectedPetFilter} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
