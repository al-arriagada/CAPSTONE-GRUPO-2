import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  FaUser,
  FaPhone,
  FaEnvelope,
  FaIdCard,
  FaCalendar,
  FaEdit,
  FaSave,
  FaImage,
} from "react-icons/fa";

export default function OwnerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const avatarUrl = profile?.avatar_url
    ? `https://owrosyqgjlelskjhcmbb.supabase.co/storage/v1/object/public/owners/${profile.avatar_url}`
    : null;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user) return;

        const { data: appUser } = await supabase
          .from("app_user")
          .select("*")
          .eq("user_id", user.id)
          .single();

        const { data: userPii } = await supabase
          .from("user_pii")
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
          avatar_url: appUser?.avatar_url ?? null,
        };

        setProfile(data);
        setFormData(data);
      } catch (err) {
        console.error("Error fetching profile:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("owners")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("app_user")
      .update({ avatar_url: filePath })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating avatar_url:", updateError.message);
      setUploading(false);
      return;
    }

    // actualiza la url del avatar en el estado local
    setProfile((prev) => ({ ...prev, avatar_url: filePath }));
    setFormData((prev) => ({ ...prev, avatar_url: filePath }));
    setUploading(false);
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
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200">
            {avatarUrl ? (
              <img src={avatarUrl + `?t=${Date.now()}`} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-3xl text-gray-500">
                <FaUser />
              </div>
            )}
            {editMode && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-black text-white p-1 rounded-full"
              >
                <FaImage size={14} />
              </button>
            )}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleUpload}
              hidden
            />
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
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaEnvelope /> Correo electrónico
            </label>
            {editMode ? (
              <input name="email" value={formData.email} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (
              profile.email || "-"
            )}
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaPhone /> Teléfono
            </label>
            {editMode ? (
              <input name="phone" value={formData.phone} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (
              profile.phone || "-"
            )}
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaIdCard /> RUT
            </label>
            {editMode ? (
              <input name="rut" value={formData.rut} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (
              profile.rut || "-"
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Información Personal</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-gray-700">
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaUser /> Nombre completo
            </label>
            {editMode ? (
              <input name="full_name" value={formData.full_name} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (
              profile.full_name || "-"
            )}
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaCalendar /> Fecha de nacimiento
            </label>
            {editMode ? (
              <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (
              formatDate(profile.birth_date)
            )}
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaUser /> Género
            </label>
            {editMode ? (
              <select name="gender" value={formData.gender} onChange={handleChange} className="border rounded px-2 py-1 w-full">
                <option value="">Seleccionar</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            ) : (
              profile.gender || "-"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
