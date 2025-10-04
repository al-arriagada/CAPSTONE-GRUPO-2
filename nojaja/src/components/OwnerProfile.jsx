import Navbar from "./Navbar.jsx";
import { Link } from "react-router-dom";
// src/components/OwnerProfile.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaIdCard,
  FaCalendar,
  FaMapMarkerAlt,
  FaEdit,
  FaSave,
} from "react-icons/fa";

export default function OwnerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [comunas, setComunas] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user) return;

        const { data: appUser } = await supabase
          .from("app_user_full")
          .select("*")
          .eq("user_id", user.id)
          .single();

        const { data: userPii } = await supabase
          .from("user_pii_public")
          .select("phone")
          .eq("user_id", user.id)
          .single();

        const data = {
          user_id: user.id,
          full_name: appUser?.full_name ?? "",
          rut: appUser?.rut ?? "",
          email: appUser?.email ?? "",
          phone: userPii?.phone ?? "",
          birth_date: appUser?.birth_date ?? "",
          gender: appUser?.gender ?? "",
          comuna_id: appUser?.comuna_id ?? null,
          comuna_name: appUser?.comuna_name ?? "",
          region_name: appUser?.region_name ?? "",
        };

        setProfile(data);
        setFormData(data);
      } catch (err) {
        console.error("Error fetching profile:", err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchComunas = async () => {
      const { data } = await supabase
        .from("comuna_view")
        .select("comuna_id, name, region_name")
        .order("name", { ascending: true });

      setComunas(data || []);
    };

    fetchProfile();
    fetchComunas();
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      setMessage("");
      const { error: appUserError } = await supabase
        .from("app_user")
        .update({
          full_name: formData.full_name,
          rut: formData.rut,
          email: formData.email,
          birth_date: formData.birth_date,
          gender: formData.gender,
          comuna_id: formData.comuna_id,
        })
        .eq("user_id", user.id);

      if (appUserError) throw appUserError;

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

      setProfile({ ...formData });
      setEditMode(false);
      setMessage("Perfil actualizado correctamente ✅");
    } catch (err) {
      console.error("Error saving profile:", err.message);
      setMessage("Error al guardar el perfil ❌");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const calculateAge = (dateStr) => {
    if (!dateStr) return "-";
    const birth = new Date(dateStr);
    const ageDifMs = Date.now() - birth.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const selectedComuna = comunas.find((c) => c.comuna_id === Number(formData.comuna_id));

  if (loading) return <p className="text-center mt-10">Cargando perfil...</p>;
  if (!profile) return <p className="text-center mt-10">Perfil no encontrado.</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <button
          onClick={editMode ? handleSave : () => setEditMode(true)}
          className={`px-4 py-2 rounded flex items-center gap-2 text-white ${
            editMode ? "bg-green-600 hover:bg-green-700" : "bg-black hover:bg-gray-800"
          }`}
        >
          {editMode ? <FaSave /> : <FaEdit />}
          {editMode ? "Guardar Cambios" : "Editar Perfil"}
        </button>
      </div>

      {message && <p className="mb-4 text-center text-sm text-blue-600">{message}</p>}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-3xl text-gray-600">
            <FaUser />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-semibold">{profile.full_name || "-"}</h2>
            <p className="text-sm text-gray-500">Dueño de Mascota</p>
            <p className="text-sm text-gray-500">{calculateAge(profile.birth_date)} años</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Información de Contacto</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-gray-700">
          <div><FaEnvelope className="inline mr-2" />
            {editMode ? (
              <input name="email" value={formData.email} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (profile.email || "-")}
          </div>
          <div><FaPhone className="inline mr-2" />
            {editMode ? (
              <input name="phone" value={formData.phone} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (profile.phone || "-")}
          </div>
          <div><FaIdCard className="inline mr-2" />
            {editMode ? (
              <input name="rut" value={formData.rut} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (profile.rut || "-")}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Información Personal</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-gray-700">
          <div><FaCalendar className="inline mr-2" />
            {editMode ? (
              <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : formatDate(profile.birth_date)}
          </div>
          <div><FaUser className="inline mr-2" />
            {editMode ? (
              <select name="gender" value={formData.gender} onChange={handleChange} className="border rounded px-2 py-1 w-full">
                <option value="">Seleccionar</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            ) : (profile.gender || "-")}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Ubicación</h3>
        <div className="text-gray-700">
          <FaMapMarkerAlt className="inline mr-2" />
          {editMode ? (
            <select name="comuna_id" value={formData.comuna_id || ""} onChange={handleChange} className="border rounded px-2 py-1 w-full">
              <option value="">Seleccionar comuna</option>
              {comunas.map((comuna) => (
                <option key={comuna.comuna_id} value={comuna.comuna_id}>
                  {comuna.name} ({comuna.region_name})
                </option>
              ))}
            </select>
          ) : (
            `${profile.comuna_name || "-"}, ${profile.region_name || "-"}`
          )}
        </div>
      </div>
    </div>
  );
}

