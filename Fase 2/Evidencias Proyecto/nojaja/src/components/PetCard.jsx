// src/components/PetCard.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

const SPECIES = { dog: "Perro", cat: "Gato", other: "Otro" };
const SEX = { male: "Macho", female: "Hembra", unknown: "Desconocido" };

export default function PetCard({ pet }) {
  const {
    pet_id,
    name,
    species_id,
    breed,
    sex_id,
    birth_date,
    weight_kg,
    image_url,
  } = pet;

  const navigate = useNavigate();
  const labelSpecies = SPECIES[species_id] ?? species_id;
  const labelSex = SEX[sex_id] ?? sex_id;

  const openDetail = () => navigate(`/app/pets/${pet_id}`);
  const stop = (e) => e.stopPropagation(); // evita que el click de los botones abra el detalle

  return (
    <div
      onClick={openDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openDetail()}
      className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition cursor-pointer"
    >
      {/* Imagen */}
      <div className="aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-gray-100">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            Sin foto
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{name}</h3>
          <span className="rounded-full border px-2 py-0.5 text-xs">
            {labelSpecies}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600">
          {breed && (
            <>
              <dt className="col-span-1">Raza</dt>
              <dd className="col-span-1">{breed}</dd>
            </>
          )}

          <dt>Sexo</dt>
          <dd>{labelSex}</dd>

          {birth_date && (
            <>
              <dt>Nacimiento</dt>
              <dd>{new Date(birth_date).toLocaleDateString()}</dd>
            </>
          )}

          {weight_kg != null && (
            <>
              <dt>Peso</dt>
              <dd>{Number(weight_kg).toFixed(1)} kg</dd>
            </>
          )}
        </dl>

        {/* Acciones (no deben abrir el detalle del card) */}
        <div className="mt-4 flex gap-2">
          <Link
            to={`/app/pets/${pet_id}`} // detalle
            onClick={stop}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Ver historial
          </Link>
          <Link
            to={`/app/pets/${pet_id}/appointments`} // citas
            onClick={stop}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Ver citas
          </Link>
        </div>
      </div>
    </div>
  );
}
