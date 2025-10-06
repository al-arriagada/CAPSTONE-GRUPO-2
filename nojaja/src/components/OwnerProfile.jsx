// src/components/OwnerProfile.jsx
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

  // Validaciones
  const [errors, setErrors] = useState({});

  const avatarUrl = profile?.avatar_url
    ? `https://owrosyqgjlelskjhcmbb.supabase.co/storage/v1/object/public/owners/${profile.avatar_url}`
    : null;

  // ==========================
  // Validaciones
  const formatRut = (value) => {
    const cleaned = value.replace(/[^0-9kK]/g, "");
    if (cleaned.length === 0) return "";
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    if (body.length <= 1) return cleaned;
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedBody}-${dv}`;
  };

  const validateRut = (rut) => {
    const cleanRut = rut.replace(/[^0-9kK]/g, "");
    if (cleanRut.length < 2) return false;
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const expectedDv = 11 - (sum % 11);
    let calculatedDv;
    if (expectedDv === 11) calculatedDv = "0";
    else if (expectedDv === 10) calculatedDv = "K";
    else calculatedDv = expectedDv.toString();
    return dv === calculatedDv;
  };

  const normalizePhone = (value) => {
    const only = (value || "").replace(/\D/g, "");
    let local = only;
    if (only.startsWith("569")) local = only.slice(3);
    else if (only.startsWith("56")) local = only.slice(2);
    if (local.startsWith("9")) local = local.slice(1);
    return local.slice(0, 8);
  };


  const formatPhone = (local8) => {
    const d = (local8 || "").replace(/\D/g, "").slice(0, 8);
    const a = d.slice(0, 4);
    const b = d.slice(4, 8);
    if (!d) return "";
    if (d.length <= 4) return `+56 9 ${a}`;
    return `+56 9 ${a} ${b}`;
  };

  const calculateAge = (dateStr) => {
    if (!dateStr) return 0;
    const today = new Date();
    const birth = new Date(dateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // ==========================

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

    // RUT: aplicar formato al escribir
    if (name === "rut") {
      const formatted = formatRut(value);
      setFormData((prev) => ({ ...prev, [name]: formatted }));
      return;
    }

    // Teléfono: limpiar y guardar
    if (name === "phone") {
      const cleaned = normalizePhone(value);
      setFormData((prev) => ({ ...prev, [name]: cleaned }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateBeforeSave = () => {
    const newErrors = {};
    if (formData.rut && !validateRut(formData.rut)) {
      newErrors.rut = "RUT inválido";
    }
    if (formData.phone && formData.phone.length !== 8) {
      newErrors.phone = "El teléfono debe tener 8 dígitos locales";
    }
    if (formData.birth_date && calculateAge(formData.birth_date) < 18) {
      newErrors.birth_date = "Debes tener al menos 18 años";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateBeforeSave()) return;

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

  if (loading) return <p className="text-center mt-10">Cargando perfil...</p>;
  if (!profile) return <p className="text-center mt-10">Perfil no encontrado.</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <button
          onClick={editMode ? handleSave : () => setEditMode(true)}
          className={`px-4 py-2 rounded flex items-center gap-2 text-white ${editMode ? "bg-green-600 hover:bg-green-700" : "bg-black hover:bg-gray-800"
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
              <>
                <input
                  name="phone"
                  type="tel"
                  value={formatPhone(formData.phone)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: normalizePhone(e.target.value),
                    }))
                  }
                  className="border rounded px-2 py-1 w-full"
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </>
            ) : (
              formatPhone(profile.phone) || "-"
            )}
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaIdCard /> RUT
            </label>
            {editMode ? (
              <>
                <input name="rut" value={formData.rut} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
                {errors.rut && <p className="text-xs text-red-600 mt-1">{errors.rut}</p>}
              </>
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
              <>
                <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
                {errors.birth_date && <p className="text-xs text-red-600 mt-1">{errors.birth_date}</p>}
              </>
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
