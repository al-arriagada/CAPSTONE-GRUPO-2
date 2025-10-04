import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";

const SPECIES = { dog: "Perro", cat: "Gato", other: "Otro" };
const SEX = { male: "Macho", female: "Hembra", unknown: "Desconocido" };

export default function PetDetail() {
  const { id } = useParams();           // pet_id
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .schema("petcare")
        .from("pet")
        .select("*")
        .eq("pet_id", id)
        .maybeSingle();

      if (!abort) {
        if (error) console.error(error);
        setPet(data ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { abort = true; };
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta mascota? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    const { error } = await supabase
      .schema("petcare").from("pet")
      .delete()
      .eq("pet_id", id);
    setDeleting(false);
    if (error) {
      console.error(error);
      alert("No se pudo eliminar.");
      return;
    }
    // vuelve al dashboard y tu hook useMyPets se refrescará
    navigate("/app");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }
  if (!pet) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-gray-600">Mascota no encontrada.</p>
        <Link className="text-black underline" to="/app">Volver</Link>
      </div>
    );
  }

  const canEdit = user && pet.user_id === user.id;
  const labelSpecies = SPECIES[pet.species_id] ?? pet.species_id;
  const labelSex = SEX[pet.sex_id] ?? pet.sex_id;

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold">{pet.name}</h1>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Link
                to={`/app/pets/${pet.pet_id}/edit`}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Editar
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-black px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </>
          )}
          <Link to="/app" className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
            Volver
          </Link>
        </div>
      </div>

      {/* Imagen */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-gray-100">
        <img
          src={pet.image_url || "/placeholder-pet.jpg"}
          alt={pet.name}
          className="h-[320px] w-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Info label="Especie" value={labelSpecies} />
        <Info label="Sexo" value={labelSex} />
        <Info label="Raza" value={pet.breed || "—"} />
        <Info label="Origen" value={pet.origin_id || "—"} />
        <Info label="Microchip" value={pet.microchip || "—"} />
        <Info label="Esterilizado/a" value={pet.neutered ? "Sí" : "No"} />
        <Info label="Nacimiento" value={pet.birth_date ? new Date(pet.birth_date).toLocaleDateString() : "—"} />
        <Info label="Estado" value={pet.status_id || "—"} />
      </div>

      {/* Aquí después: tabs de Historial, Vacunas, Citas, Documentos */}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
