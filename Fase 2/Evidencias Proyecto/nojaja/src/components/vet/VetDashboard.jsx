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
  const petDetailPath = (id) => `/pet/${id}`;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Mis pacientes compartidos</h1>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rows.map((row) => {
          const p = row.pet || {};
          const img = p.image_url || "/placeholder-pet.jpg";
          return (
            <li
              key={p.pet_id || row.pet_id}     // 👈 KEY ÚNICA
              className="border rounded-2xl overflow-hidden bg-white shadow-sm"
            >
              <div className="h-44 bg-gray-50">
                <img
                  src={img}
                  alt={p.name || "Mascota"}
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.src = "/placeholder-pet.jpg")}
                />
              </div>

              <div className="p-4 space-y-1">
                <h3 className="text-lg font-semibold">{p.name || "—"}</h3>
                <p className="text-sm text-gray-600">
                  Rol: <span className="font-medium">{row.member_role_id}</span>
                </p>
                {Array.isArray(row.permissions) && row.permissions.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Permisos: {row.permissions.join(", ")}
                  </p>
                )}
                <div className="pt-3">
                  <Link
                    to={petDetailPath(p.pet_id)}
                    className="inline-block px-4 py-2 rounded-xl bg-black text-white text-sm hover:bg-gray-800"
                  >
                    Ver ficha
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
