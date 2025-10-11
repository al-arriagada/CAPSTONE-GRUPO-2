// src/components/OwnerProfile.jsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  FaUser, FaPhone, FaEnvelope, FaIdCard, FaCalendar, FaEdit, FaSave, FaImage, FaTimes, FaAddressBook, FaMap
} from "react-icons/fa";
import { normalizeRut } from "../services/profile";
import useUserRole from "../hooks/useUserRole";

export default function OwnerProfile() {
  const { user } = useAuth();
  const { role } = useUserRole(); // "owner" | "vet"
  const [loading, setLoading] = useState(true);

  // Perfil base
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // Dirección y geo
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState("");
  const [comunas, setComunas] = useState([]);
  const [comunaId, setComunaId] = useState("");

  // ---- helpers de formato ----
  const formatRutInput = (value) => {
    const cleaned = (value || "").replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
    if (cleaned.length <= 1) return cleaned;
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);
    const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${withDots}-${dv}`;
  };

  const validateRut = (rut) => {
    const cleanRut = (rut || "").replace(/[^0-9kK]/g, "");
    if (cleanRut.length < 2) return false;
    const body = cleanRut.slice(0, -1);
    const dv = cleanRut.slice(-1).toUpperCase();
    let sum = 0, mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * mul;
      mul = mul === 7 ? 2 : mul + 1;
    }
    const expected = 11 - (sum % 11);
    const calc = expected === 11 ? "0" : expected === 10 ? "K" : String(expected);
    return dv === calc;
  };

  const formatRutDisplay = (rut) => {
    const cleaned = (rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
    if (cleaned.length < 2) return "";
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);
    const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${withDots}-${dv}`;
  };

  const fromAnyToLocal8 = (v) => {
    const only = (v || "").replace(/\D/g, "");
    if (only.startsWith("569")) return only.slice(3, 11);
    if (only.startsWith("56")) {
      let rest = only.slice(2);
      if (rest.startsWith("9")) rest = rest.slice(1);
      return rest.slice(0, 8);
    }
    if (only.startsWith("9")) return only.slice(1, 9);
    return only.slice(-8);
  };
  const toE164ClMobile = (local8) => {
    const d = (local8 || "").replace(/\D/g, "");
    return d.length === 8 ? `+569${d}` : null;
  };
  const formatPhone = (local8) => {
    const d = (local8 || "").replace(/\D/g, "").slice(0, 8);
    const a = d.slice(0, 4), b = d.slice(4, 8);
    if (!d) return "";
    if (d.length <= 4) return `+56 9 ${a}`;
    return `+56 9 ${a} ${b}`;
  };
  const calculateAge = (dateStr) => {
    if (!dateStr) return 0;
    const today = new Date(), birth = new Date(dateStr);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const avatarUrl = profile?.avatar_url
    ? `https://owrosyqgjlelskjhcmbb.supabase.co/storage/v1/object/public/owners/${profile.avatar_url}`
    : null;

  // ---- cargar catálogos geo ----
  useEffect(() => {
    (async () => {
      const { data } = await supabase.schema("petcare").from("region").select("*").order("name");
      setRegions(data || []);
    })();
  }, []);

  useEffect(() => {
    if (!regionId) { setComunas([]); return; }
    (async () => {
      const { data } = await supabase
        .schema("petcare")
        .from("comuna")
        .select("comuna_id,name")
        .eq("region_id", regionId)
        .order("name");
      setComunas(data || []);
    })();
  }, [regionId]);

  // ---- cargar perfil ----
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user) return;

        const { data: appUser } = await supabase
          .schema("petcare")
          .from("app_user")
          .select("*")
          .eq("user_id", user.id)
          .single();

        const { data: userPii } = await supabase
          .schema("petcare")
          .from("user_pii")
          .select("phone,address_line")
          .eq("user_id", user.id)
          .maybeSingle();

        // si hay comuna, obtenemos su región
        let initialRegionId = "";
        if (appUser?.comuna_id) {
          const { data: comunaRow } = await supabase
            .schema("petcare")
            .from("comuna")
            .select("region_id")
            .eq("comuna_id", appUser.comuna_id)
            .single();
          initialRegionId = comunaRow?.region_id ? String(comunaRow.region_id) : "";
        }

        const base = {
          user_id: user.id,
          full_name: appUser?.full_name ?? "",
          rut: appUser?.rut ?? "",
          email: appUser?.email ?? "",
          phone: fromAnyToLocal8(userPii?.phone ?? ""),
          address_line: userPii?.address_line ?? "",
          birth_date: appUser?.birth_date ?? "",
          gender: appUser?.gender ?? "",
          avatar_url: appUser?.avatar_url ?? null,
          comuna_id: appUser?.comuna_id ?? "",
        };

        setProfile(base);
        setFormData(base);
        setRegionId(initialRegionId);
        setComunaId(appUser?.comuna_id ? String(appUser.comuna_id) : "");
      } catch (err) {
        console.error("Error fetching profile:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // ---- handlers ----
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "rut") {
      setFormData((p) => ({ ...p, rut: formatRutInput(value) }));
      return;
    }
    if (name === "phone") {
      setFormData((p) => ({ ...p, phone: fromAnyToLocal8(value) }));
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const validateBeforeSave = () => {
    const newErrors = {};
    if (formData.rut && !validateRut(formData.rut)) newErrors.rut = "RUT inválido";
    if (formData.phone && formData.phone.length !== 8) newErrors.phone = "El teléfono debe tener 8 dígitos locales";
    if (formData.birth_date && calculateAge(formData.birth_date) < 18) newErrors.birth_date = "Debes tener al menos 18 años";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateBeforeSave()) return;
    const rutToSave = normalizeRut(formData.rut).compact || null;
    const phoneE164 = toE164ClMobile(formData.phone);

    try {
      setMessage("");

      // app_user (incluye comuna_id)
      const { error: appUserError } = await supabase
        .schema("petcare")
        .from("app_user")
        .update({
          full_name: formData.full_name,
          rut: rutToSave,
          email: formData.email,
          birth_date: formData.birth_date,
          gender: formData.gender,
          comuna_id: comunaId ? Number(comunaId) : null,
        })
        .eq("user_id", user.id);
      if (appUserError) throw appUserError;

      // user_pii (tel + dirección)
      const { error: piiError } = await supabase
        .schema("petcare")
        .from("user_pii")
        .upsert(
          {
            user_id: user.id,
            phone: phoneE164,
            address_line: formData.address_line || null,
          },
          { onConflict: "user_id" }
        );
      if (piiError) throw piiError;

      // reflejar en estado local
      const updated = { ...formData, comuna_id: comunaId ? Number(comunaId) : null };
      setProfile(updated);
      setEditMode(false);
      setMessage("Perfil actualizado correctamente ✅");
    } catch (err) {
      console.error("Error saving profile:", err.message);
      setMessage("Error al guardar el perfil ❌");
    }
  };

  const handleCancel = () => {
    // vuelve a lo cargado originalmente
    setFormData(profile);
    setMessage("");
    setErrors({});
    // re-selecciona geo
    setComunaId(profile?.comuna_id ? String(profile.comuna_id) : "");
    // derivar region del valor actual de comuna
    (async () => {
      if (profile?.comuna_id) {
        const { data } = await supabase
          .schema("petcare")
          .from("comuna")
          .select("region_id")
          .eq("comuna_id", profile.comuna_id)
          .single();
        setRegionId(data?.region_id ? String(data.region_id) : "");
      } else {
        setRegionId("");
      }
    })();
    setEditMode(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("owners")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .schema("petcare")
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

  // helpers para mostrar nombres
  const regionName = regionId ? regions.find(r => String(r.region_id) === String(regionId))?.name : null;
  const comunaName = comunaId ? comunas.find(c => String(c.comuna_id) === String(comunaId))?.name : null;

  if (loading) return <p className="text-center mt-10">Cargando perfil...</p>;
  if (!profile) return <p className="text-center mt-10">Perfil no encontrado.</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded flex items-center gap-2 text-white bg-green-600 hover:bg-green-700"
              >
                <FaSave /> Guardar Cambios
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded flex items-center gap-2 border hover:bg-gray-50"
              >
                <FaTimes /> Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 rounded flex items-center gap-2 text-white bg-black hover:bg-gray-800"
            >
              <FaEdit /> Editar Perfil
            </button>
          )}
        </div>
      </div>

      {message && <p className="mb-4 text-center text-sm text-blue-600">{message}</p>}

      {/* Avatar + título */}
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
                title={uploading ? "Subiendo..." : "Cambiar foto"}
              >
                <FaImage size={14} />
              </button>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleUpload} hidden />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-semibold">{profile.full_name || "-"}</h2>
            <p className="text-sm text-gray-500">{role === "vet" ? "Veterinario/a" : "Dueño/a de Mascota"}</p>
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Información de Contacto</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-gray-700">
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaEnvelope /> Correo electrónico
            </label>
            {editMode ? (
              <input name="email" value={formData.email} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (profile.email || "-")}
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
                  inputMode="numeric"
                  value={formatPhone(formData.phone)}
                  onChange={handleChange}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="+56 9 1234 5678"
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
              </>
            ) : (formatPhone(profile.phone) || "-")}
          </div>

          <div className="sm:col-span-2">
            <label className="text-sm font-medium flex items-center gap-2"> 
              <FaAddressBook /> Dirección
            </label>
            {editMode ? (
              <input
                name="address_line"
                value={formData.address_line}
                onChange={handleChange}
                className="border rounded px-2 py-1 w-full"
                placeholder="Calle 123, depto 45"
              />
            ) : (profile.address_line || "-")}
          </div>

          {/* Región / Comuna */}
          <div>
            <label className="text-sm font-medium flex items-center gap-2"><FaMap /> Región</label>
            {editMode ? (
              <select
                className="border rounded px-2 py-1 w-full bg-white"
                value={regionId}
                onChange={(e) => { setRegionId(e.target.value); setComunaId(""); }}
              >
                <option value="">Seleccionar región</option>
                {regions.map(r => (
                  <option key={r.region_id} value={r.region_id}>{r.name}</option>
                ))}
              </select>
            ) : (regionName || "-")}
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2"> <FaMap /> Comuna</label>
            {editMode ? (
              <select
                className="border rounded px-2 py-1 w-full bg-white"
                value={comunaId}
                onChange={(e) => setComunaId(e.target.value)}
                disabled={!regionId}
              >
                <option value="">{regionId ? "Seleccionar comuna" : "Primero elige región"}</option>
                {comunas.map(c => (
                  <option key={c.comuna_id} value={c.comuna_id}>{c.name}</option>
                ))}
              </select>
            ) : (
              // mostrar nombre si coincide con lista actual; si no, cae a "-"
              (comunaName || "-")
            )}
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Información Personal</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-gray-700">
          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaUser /> Nombre completo
            </label>
            {editMode ? (
              <input name="full_name" value={formData.full_name} onChange={handleChange} className="border rounded px-2 py-1 w-full" />
            ) : (profile.full_name || "-")}
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaIdCard /> RUT
            </label>
            {editMode ? (
              <>
                <input
                  name="rut"
                  value={formData.rut}
                  onChange={handleChange}
                  className="border rounded px-2 py-1 w-full"
                  maxLength={12}
                  placeholder="12.345.678-9"
                />
                {errors.rut && <p className="text-xs text-red-600 mt-1">{errors.rut}</p>}
              </>
            ) : (formatRutDisplay(profile.rut) || "-")}
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaCalendar /> Fecha de nacimiento
            </label>
            {editMode ? (
              <>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date || ""}
                  onChange={handleChange}
                  className="border rounded px-2 py-1 w-full"
                  max={new Date().toISOString().split("T")[0]}
                />
                {errors.birth_date && <p className="text-xs text-red-600 mt-1">{errors.birth_date}</p>}
              </>
            ) : (formatDate(profile.birth_date))}
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <FaUser /> Género
            </label>
            {editMode ? (
              <select name="gender" value={formData.gender || ""} onChange={handleChange} className="border rounded px-2 py-1 w-full">
                <option value="">Seleccionar</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            ) : (profile.gender || "-")}
          </div>
        </div>
      </div>
    </div>
  );
}
