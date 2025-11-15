// src/pages/VetDashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

export default function VetDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .schema("petcare")
        .from("pet_member")
        .select(`
          pet_id,
          member_role_id,
          permissions,
          pet:pet_id (
            pet_id,
            name,
            image_url,
            species_id,
            breed
          )
        `)
        .eq("member_user_id", user.id)
        .is("revoked_at", null);

      if (error) {
        console.error("load patients (vet):", error);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="p-8">Cargando…</div>;

  if (!rows.length) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Mis pacientes compartidos</h1>
        <p className="text-gray-600">Aún no te han compartido mascotas.</p>
      </div>
    );
  }

  // Ruta al detalle (si usas otra, cámbiala aquí)
  //const petDetailPath = (id) => `/pet/${id}`;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Mis pacientes compartidos</h1>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rows.map((row) => (
        <div key={`${row.pet_id}-${row.member_role_id}`} className="rounded-2xl border shadow-sm p-4">
            <img
            src={row.pet?.image_url || "/placeholder-pet.jpg"}
            alt={row.pet?.name || "Mascota"}
            className="w-full h-56 object-cover rounded-xl"
            />

            <h3 className="mt-3 text-xl font-semibold">
            {row.pet?.name || "—"}
            </h3>

            <p className="text-sm text-gray-600">Rol: {row.member_role_id}</p>
            <p className="text-sm text-gray-500">
            Permisos: {Array.isArray(row.permissions) ? row.permissions.join(", ") : "read"}
            </p>

            <Link
            to={`/vet/pets/${row.pet?.pet_id}`}
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-black text-white"
            >
            Ver ficha
            </Link>
        </div>
        ))}
      </ul>
    </div>
  );
}
