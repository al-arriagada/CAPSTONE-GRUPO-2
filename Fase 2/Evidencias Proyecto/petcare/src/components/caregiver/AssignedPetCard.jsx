// src/components/caregiver/AssignedPetCard.jsx

import React from 'react';


const calculateAge = (birthDate) => {
  if (!birthDate) return 'N/A';
  try {
    const today = new Date();
    const birth = new Date(birthDate);
    // Verifica si la fecha es válida
    if (isNaN(birth.getTime())) return 'Fecha inválida'; 
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    // Asegura que la edad no sea negativa si la fecha es futura
    return age >= 0 ? `${age} ${age === 1 ? 'año' : 'años'}` : 'Fecha futura'; 
  } catch (e) {
    console.error("Error calculating age:", e);
    return 'Error';
  }
};

const getSpecieName = (specieId) => {
  // --- AJUSTA ESTOS VALORES según tu tabla `species_catalog` ---
  const speciesMap = {
    1: 'Perro', // Ejemplo
    2: 'Gato',  // Ejemplo
    // Añade más IDs y nombres aquí
  };
  // --- FIN AJUSTE ---
  return speciesMap[specieId] || 'Desconocido';
};

// --- Componente Principal ---

export default function AssignedPetCard({ pet }) {
  // Asegura que 'pet' no sea nulo o indefinido antes de intentar acceder a sus propiedades
  if (!pet) {
      console.warn("AssignedPetCard recibió una prop 'pet' nula o indefinida.");
      return null; // O muestra un estado de error/carga si prefieres
  }

  const age = calculateAge(pet.birth_date);
  const specie = getSpecieName(pet.specie_id); // Usa el ID correcto de tu tabla pet

  const handleContactOwner = () => {
    if (pet.owner?.phone) {
      // Intenta abrir WhatsApp o la app de teléfono
      window.location.href = `tel:${pet.owner.phone}`;
      console.log(`Intentando contactar a ${pet.owner?.full_name} al ${pet.owner.phone}`);
    } else {
      alert('Número de teléfono del dueño no disponible.');
    }
  };

  const handleRegisterActivity = () => {
    // Aquí deberías navegar a la pantalla de registro de actividad,
    // pasando el pet.pet_id si es necesario.
    // Ejemplo: navigate(`/caregiver/pets/${pet.pet_id}/log`);
    alert(`Registrar actividad para ${pet.name}`);
  };

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Encabezado con Imagen y Tipo */}
      <div className="relative">
        <div className="aspect-[16/9] w-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {pet.image_url ? (
            <img 
              src={pet.image_url} 
              alt={pet.name || 'Mascota'} 
              className="w-full h-full object-cover" 
              onError={(e) => { e.target.style.display = 'none'; /* Oculta si hay error */ }}
            />
          ) : (
            // Icono placeholder si no hay imagen
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          )}
        </div>
        <span className="absolute top-2 right-2 inline-flex items-center rounded-md bg-white/80 backdrop-blur-sm px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-500/10">
          {specie}
        </span>
      </div>

      {/* Contenido Principal */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{pet.name || 'Sin Nombre'}</h3>

        {/* Detalles de la Mascota */}
        <div className="space-y-1 text-sm text-gray-600 mb-4">
          <div className="flex justify-between"><span className="font-medium text-gray-800">Raza:</span> <span>{pet.breed || 'N/A'}</span></div>
          <div className="flex justify-between"><span className="font-medium text-gray-800">Edad:</span> <span>{age}</span></div>
          {/* Asegúrate que la columna se llame 'current_weight' en tu tabla 'pet' */}
          <div className="flex justify-between"><span className="font-medium text-gray-800">Peso:</span> <span>{pet.current_weight ? `${pet.current_weight} kg` : 'N/A'}</span></div>
        </div>

        {/* Información del Dueño */}
        <div className="mb-4">
          <h4 className="font-semibold text-gray-800 mb-1">Información del Dueño</h4>
          <p className="text-sm text-gray-600">Nombre: {pet.owner?.full_name || 'N/A'}</p>
          <p className="text-sm text-gray-600">
             📞 <span className="ml-1">{pet.owner?.phone || 'N/A'}</span>
          </p>
        </div>

        {/* Instrucciones de Cuidado */}
        <div className="mb-4 flex-grow">
          <h4 className="font-semibold text-gray-800 mb-1">Instrucciones de Cuidado</h4>
          {/* Asegúrate que la columna se llame 'care_instructions' en tu tabla 'pet' */}
          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
            {pet.care_instructions || 'No hay instrucciones específicas.'}
          </p>
        </div>

        {/* Botones de Acción */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex gap-3">
          <button 
            onClick={handleContactOwner}
            className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={!pet.owner?.phone} // Deshabilita si no hay teléfono
          >
            Contactar Dueño
          </button>
          <button 
            onClick={handleRegisterActivity}
            className="flex-1 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Registrar Actividad
          </button>
        </div>
      </div>
    </div>
  );
}