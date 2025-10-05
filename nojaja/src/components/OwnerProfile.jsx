import { useEffect, useState } from "react";
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
} from "react-icons/fa";

export default function OwnerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

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

        const avatarPath = appUser?.avatar_url ?? null;
        let avatarUrl = null;

        if (avatarPath) {
          const { data } = supabase.storage.from("owners").getPublicUrl(avatarPath);
          avatarUrl = data?.publicUrl ?? null;
        }

        const data = {
          user_id: user.id,
          full_name: appUser?.full_name ?? "",
          rut: appUser?.rut ?? "",
          email: appUser?.email ?? "",
          phone: userPii?.phone ?? "",
          birth_date: appUser?.birth_date ?? "",
          gender: appUser?.gender ?? "",
          avatar_url: avatarPath,
        };

        setAvatarUrl(avatarUrl);
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
    const { name, value, files } = e.target;
    if (name === "avatar" && files?.[0]) {
      setAvatarFile(files[0]);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    try {
      setMessage("");
      let avatarStoragePath = formData.avatar_url;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}/avatar.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("owners")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;
        avatarStoragePath = fileName;
        const { data } = supabase.storage.from("owners").getPublicUrl(fileName);
        setAvatarUrl(data.publicUrl);
      }

      const { error: appUserError } = await supabase
        .from("app_user")
        .update({
          full_name: formData.full_name,
          rut: formData.rut,
          email: formData.email,
          birth_date: formData.birth_date,
          gender: formData.gender,
          avatar_url: avatarStoragePath,
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

      setProfile({ ...formData, avatar_url: avatarStoragePath });
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
          <div className="w-20 h-20 bg-gray-200 rounded-full overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="object-cover w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">
                <FaUser />
              </div>
            )}
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
          <label className="block">
            <span className="text-sm text-gray-600">Nombre</span>
            {editMode ? (
              <input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              />
            ) : (
              <div className="flex items-center"><FaUser className="mr-2" /> {profile.full_name || "-"}</div>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Email</span>
            {editMode ? (
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              />
            ) : (
              <div className="flex items-center"><FaEnvelope className="mr-2" /> {profile.email || "-"}</div>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Teléfono</span>
            {editMode ? (
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              />
            ) : (
              <div className="flex items-center"><FaPhone className="mr-2" /> {profile.phone || "-"}</div>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">RUT</span>
            {editMode ? (
              <input
                name="rut"
                value={formData.rut}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              />
            ) : (
              <div className="flex items-center"><FaIdCard className="mr-2" /> {profile.rut || "-"}</div>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Fecha de Nacimiento</span>
            {editMode ? (
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              />
            ) : (
              <div className="flex items-center"><FaCalendar className="mr-2" /> {formatDate(profile.birth_date)}</div>
            )}
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Género</span>
            {editMode ? (
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="">Seleccionar</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            ) : (
              <div className="flex items-center"><FaUser className="mr-2" /> {profile.gender || "-"}</div>
            )}
          </label>

          {editMode && (
            <label className="block sm:col-span-2">
              <span className="text-sm text-gray-600">Foto de perfil</span>
              <input
                type="file"
                name="avatar"
                accept="image/*"
                onChange={handleChange}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
