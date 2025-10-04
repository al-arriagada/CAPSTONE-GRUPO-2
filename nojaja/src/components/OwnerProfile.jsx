import Navbar from "./Navbar.jsx";
import { Link } from "react-router-dom";
// src/components/OwnerProfile.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function OwnerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: "",
    rut: "",
    email: "",
    phone: "",
    birth_date: "",
    gender: "",
    comuna_name: "",
    region_name: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user) return;

        // Traer datos desde app_user_full
        const { data: appUser, error: appUserError } = await supabase
          .from("app_user_full")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (appUserError) throw appUserError;

        // Traer datos desde user_pii_public
        const { data: userPii, error: piiError } = await supabase
          .from("user_pii_public")
          .select("phone")
          .eq("user_id", user.id)
          .single();

        if (piiError) throw piiError;

        setFormData({
          full_name: appUser?.full_name || "",
          rut: appUser?.rut || "",
          email: appUser?.email || "",
          phone: userPii?.phone || "",
          birth_date: appUser?.birth_date || "",
          gender: appUser?.gender || "",
          comuna_name: appUser?.comuna_name || "",
          region_name: appUser?.region_name || "",
        });
      } catch (err) {
        console.error("Error fetching profile:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      // Actualizar app_user directamente en petcare.app_user
      const { error: appUserError } = await supabase
        .from("app_user")
        .update({
          full_name: formData.full_name,
          rut: formData.rut,
          email: formData.email,
          birth_date: formData.birth_date,
          gender: formData.gender,
        })
        .eq("user_id", user.id);

      if (appUserError) throw appUserError;

      // Actualizar user_pii
      const { error: piiError } = await supabase
        .from("user_pii")
        .upsert(
          {
            user_id: user.id,
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
          <label className="block font-medium">Teléfono</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Fecha de nacimiento</label>
          <input
            type="date"
            name="birth_date"
            value={formData.birth_date}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Género</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">Seleccionar</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="block font-medium">Comuna</label>
          <input
            type="text"
            name="comuna_name"
            value={formData.comuna_name}
            readOnly
            className="w-full border px-3 py-2 rounded bg-gray-100"
          />
        </div>

        <div>
          <label className="block font-medium">Región</label>
          <input
            type="text"
            name="region_name"
            value={formData.region_name}
            readOnly
            className="w-full border px-3 py-2 rounded bg-gray-100"
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