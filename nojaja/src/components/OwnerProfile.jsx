import Navbar from "./Navbar.jsx";
import { Link } from "react-router-dom";
// src/components/OwnerProfile.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function OwnerProfile() {
  const { user } = useAuth(); // Supabase Auth user
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    rut: "",
    address_line: "",
    phone: "",
  });
  const [message, setMessage] = useState("");

  // Cargar datos desde app_user y user_pii
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user) return;

        // app_user
        const { data: appUser, error: appUserError } = await supabase
          .from("app_user")
          .select("full_name, email, rut")
          .eq("id", user.id)
          .single();

        if (appUserError) throw appUserError;

        // user_pii
        const { data: userPii, error: piiError } = await supabase
          .from("user_pii")
          .select("address_line, phone")
          .eq("user_id", user.id)
          .single();

        if (piiError && piiError.code !== "PGRST116") throw piiError;

        setFormData({
          full_name: appUser?.full_name || "",
          email: appUser?.email || "",
          rut: appUser?.rut || "",
          address_line: userPii?.address_line || "",
          phone: userPii?.phone || "",
        });
      } catch (err) {
        console.error("Error fetching profile:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Actualizar campos del form
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Guardar cambios
  const handleSave = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      // app_user update
      const { error: appUserError } = await supabase
        .from("app_user")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          rut: formData.rut,
        })
        .eq("id", user.id);

      if (appUserError) throw appUserError;

      // user_pii upsert (si no existe, lo crea)
      const { error: piiError } = await supabase
        .from("user_pii")
        .upsert(
          {
            user_id: user.id,
            address_line: formData.address_line,
            phone: formData.phone,
          },
          { onConflict: "user_id" }
        );

      if (piiError) throw piiError;

      setMessage("Perfil actualizado correctamente ✅");
    } catch (err) {
      console.error("Error saving profile:", err.message);
      setMessage("Error al guardar el perfil ❌");
    }
  };

  if (loading) return <p>Cargando perfil...</p>;

  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Mi Perfil</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block font-medium">Nombre completo</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">RUT</label>
          <input
            type="text"
            name="rut"
            value={formData.rut}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Dirección</label>
          <input
            type="text"
            name="address_line"
            value={formData.address_line}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Teléfono</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Guardar cambios
        </button>
      </form>

      {message && <p className="mt-4 text-center">{message}</p>}
    </div>
  );
}