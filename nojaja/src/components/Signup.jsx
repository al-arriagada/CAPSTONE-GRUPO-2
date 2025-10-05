// src/components/Signup.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const GENDERS = [
  { value: "male", label: "Masculino" },
  { value: "female", label: "Femenino" },
  { value: "other", label: "Otro / Prefiero no decir" },
];

export default function Signup() {
  const navigate = useNavigate();

  // ==== Campos básicos
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");

  // ==== Fecha por selects (más rápido que <input type="date">)
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");

  // ==== Perfil extra
  const [gender, setGender] = useState("other");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [address, setAddress] = useState("");

  // ==== Región/Comuna (cascada)
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState("");
  const [comunas, setComunas] = useState([]);
  const [comunaId, setComunaId] = useState("");

  // ==== Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  // ==== Estado UI
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // ========= Helpers que ya tenías =========

  const formatClMobileDisplay = (local8) => {
  const d = (local8 || "").replace(/\D/g, "").slice(0, 8);
  const a = d.slice(0, 4);
  const b = d.slice(4, 8);
  if (!d) return "";                 // input vacío
  if (d.length <= 4) return `+56 9 ${a}`;
  return `+56 9 ${a} ${b}`;
};

  const normalizeClMobileFromAny = (value) => {
    // Acepta pegados: "+56 9 1234 5678", "56912345678", "912345678", "12345678"
    const only = (value || "").replace(/\D/g, "");
    let local = only;
    if (only.startsWith("569")) local = only.slice(3);
    else if (only.startsWith("56")) local = only.slice(2);
    if (local.startsWith("9")) local = local.slice(1);
    return local.slice(0, 8); // 8 dígitos locales
  };

  const toE164ClMobile = (local8) => {
    const d = (local8 || "").replace(/\D/g, "");
    return d.length === 8 ? `+569${d}` : null;
  };


  // formatea RUT
  const formatRut = (value) => {
    const cleaned = value.replace(/[^0-9kK]/g, "");
    if (cleaned.length === 0) return "";
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    if (body.length <= 1) return cleaned;
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedBody}-${dv}`;
  };

  const normalizeRut = (value) =>
  (value || "").replace(/[^0-9kK]/g, "").toUpperCase();

  // valida RUT
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

  // edad
  const calculateAge = (birthDate) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // fuerza password
  const validatePasswordStrength = (p) => {
    const strength = {
      length: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      lowercase: /[a-z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/]/.test(p),
    };
    setPasswordStrength(strength);
    return Object.values(strength).every(Boolean);
  };

  const handleRutChange = (e) => setRut(formatRut(e.target.value));
  const handlePasswordChange = (e) => validatePasswordStrength(e.target.value) && setPassword(e.target.value);

  const getPasswordStrengthColor = () => {
    const score = Object.values(passwordStrength).filter(Boolean).length;
    if (score === 5) return "text-green-600";
    if (score >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  // ========= Fecha por selects =========
  const years = useMemo(() => {
    const y = new Date().getFullYear();
    const arr = [];
    for (let i = y; i >= 1900; i--) arr.push(i);
    return arr;
  }, []);

  const months = useMemo(
    () => [
      { value: "01", label: "Enero" },
      { value: "02", label: "Febrero" },
      { value: "03", label: "Marzo" },
      { value: "04", label: "Abril" },
      { value: "05", label: "Mayo" },
      { value: "06", label: "Junio" },
      { value: "07", label: "Julio" },
      { value: "08", label: "Agosto" },
      { value: "09", label: "Septiembre" },
      { value: "10", label: "Octubre" },
      { value: "11", label: "Noviembre" },
      { value: "12", label: "Diciembre" },
    ],
    []
  );

  const days = useMemo(() => {
    const m = parseInt(dobMonth || "0", 10) - 1;
    const y = parseInt(dobYear || "0", 10);
    const count = m >= 0 && y ? new Date(y, m + 1, 0).getDate() : 31;
    return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, "0"));
  }, [dobMonth, dobYear]);

  const birthDateISO = useMemo(() => {
    if (!dobDay || !dobMonth || !dobYear) return "";
    return `${dobYear}-${dobMonth}-${dobDay}`; // YYYY-MM-DD
  }, [dobDay, dobMonth, dobYear]);

  // ========= Región → Comunas =========
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .schema("petcare")
        .from("region")
        .select("*")
        .order("name");
      if (!error) setRegions(data || []);
    })();
  }, []);

  useEffect(() => {
    setComunas([]);
    setComunaId("");
    if (!regionId) return;
    (async () => {
      const { data, error } = await supabase
        .schema("petcare")
        .from("comuna")
        .select("comuna_id,name")
        .eq("region_id", regionId)
        .order("name");
      if (!error) setComunas(data || []);
    })();
  }, [regionId]);

  // ========= Validación total
  const validateAll = () => {
    if (!username.trim()) return "Debes ingresar un nombre de usuario.";
    if (!email.trim()) return "Debes ingresar un correo.";
    if (!validateRut(rut)) return "RUT inválido. Por favor verifica el formato.";
    if (!birthDateISO) return "Selecciona tu fecha de nacimiento.";
    const age = calculateAge(birthDateISO);
    if (age < 18) return "Debes ser mayor de 18 años para registrarte.";
    if (!validatePasswordStrength(password)) return "La contraseña no cumple con los requisitos de seguridad.";
    if (password !== confirmPassword) return "Las contraseñas no coinciden.";
    if (!regionId || !comunaId) return "Selecciona tu región y comuna.";
    return "";
  };

  // ========= Submit
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const v = validateAll();
    if (v) return setError(v);

    try {
      setLoading(true);
              // 1) check RUT en servidor (RPC)
        const { data: rutExists, error: rutErr } = await supabase.rpc(
          "rut_exists",
          { p_rut: normalizeRut(rut) }
        );
        if (rutErr) {
          console.error("rut_exists error:", rutErr);
          setError("No pudimos validar el RUT. Intenta nuevamente.");
          setLoading(false);
          return;
        }
        if (rutExists) {
          setError("El RUT ya está registrado en otra cuenta.");
          setLoading(false);
          return;
        }


      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: username,          // lo usará ensureProfile
            rut,                          // opcional en auth; útil para tu ensureProfile
            gender,
            birth_date: birthDateISO,     // YYYY-MM-DD
            phone: toE164ClMobile(phoneLocal) || null,
            address_line: address || null,
            region_id: regionId ? Number(regionId) : null,
            comuna_id: comunaId ? Number(comunaId) : null,
          },
        },
      });

      if (authError) {
        const msg = (authError?.message || "").toLowerCase();
        if (
          msg.includes("already registered") ||
          msg.includes("user already") ||
          msg.includes("duplicate")
        ) {
          setError("Este correo ya está registrado.");
        } else if (msg.includes("password")) {
          setError("La contraseña debe tener al menos 6 caracteres.");
        } else {
          setError(authError.message);
        }
        return;
      }


      // Caso de confirmación por correo: usuario “ofuscado” indica email ya existe
      const isObfuscatedUser =
        data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
      if (isObfuscatedUser) {
        setError("Este correo ya está registrado.");
        return;
      }

      if (!data?.user) {
        setError("Error al crear el usuario. Por favor, intenta nuevamente.");
        return;
      }

      setSuccess("¡Registro exitoso! Revisa tu correo para confirmar.");
      setTimeout(() => navigate("/signin"), 1600);
    } catch (err) {
      console.error("Error en registro:", err);
      setError("Ocurrió un error inesperado. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // ========= UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-6 py-12">
      <div className="w-full max-w-2xl bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
          Crear cuenta ✨
        </h2>
        <p className="text-center text-gray-500 mb-8">
          Completa tus datos para unirte a nuestra plataforma
        </p>

        <form className="space-y-6" onSubmit={handleSignup}>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600 text-sm font-medium">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* nombre usuario */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Nombre completo *
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="Ej: Juanito23"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            {/* email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Correo electrónico *
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* rut */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                RUT *
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="12.345.678-9"
                value={rut}
                onChange={handleRutChange}
                maxLength={12}
              />
              {rut && (
                <p
                  className={`text-xs mt-1 ${
                    validateRut(rut) ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {validateRut(rut) ? "✓ RUT válido" : "✗ RUT inválido"}
                </p>
              )}
            </div>

            {/* género */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Género
              </label>
              <select
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {/* fecha nacimiento (D/M/A) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700">
                Fecha de Nacimiento *
              </label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <select
                  className="rounded-xl border px-3 py-2"
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value)}
                >
                  <option value="">Día</option>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border px-3 py-2"
                  value={dobMonth}
                  onChange={(e) => setDobMonth(e.target.value)}
                >
                  <option value="">Mes</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border px-3 py-2"
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value)}
                >
                  <option value="">Año</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              {birthDateISO && (
                <p className="text-gray-600 text-xs mt-1">
                  Edad: {calculateAge(birthDateISO)} años
                </p>
              )}
            </div>

            {/* teléfono */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Teléfono
              </label>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                pattern="[0-9]*"
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="+56 9 1234 5678"
                value={formatClMobileDisplay(phoneLocal)}
                onChange={(e) => {
                  // Limpia y trae a 8 dígitos locales sin símbolos
                  const local8 = normalizeClMobileFromAny(e.target.value);
                  setPhoneLocal(local8);
                }}
                onKeyDown={(e) => {
                  // Permite navegación/edición
                  const ctl = ["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End"];
                  if (ctl.includes(e.key)) return;
                  // Solo dígitos
                  if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                }}
              />
              {phoneLocal && phoneLocal.length !== 8 && (
                <p className="text-xs text-red-600 mt-1">
                  Ingresa los 8 dígitos del número (sin considerar +56 9).
                </p>
              )}
            </div>

            {/* dirección */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Dirección
              </label>
              <input
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="Calle 123, depto 45"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* región */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Región *
              </label>
              <select
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                required
              >
                <option value="">Selecciona región</option>
                {regions.map((r) => (
                  <option key={r.region_id} value={r.region_id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* comuna */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Comuna *
              </label>
              <select
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                value={comunaId}
                onChange={(e) => setComunaId(e.target.value)}
                required
                disabled={!regionId}
              >
                <option value="">
                  {regionId ? "Selecciona comuna" : "Primero elige región"}
                </option>
                {comunas.map((c) => (
                  <option key={c.comuna_id} value={c.comuna_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* password */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700">
                Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    validatePasswordStrength(e.target.value);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs font-medium ${getPasswordStrengthColor()}`}>
                    Requisitos:
                  </p>
                  <div className="space-y-0.5">
                    <p className={`text-xs ${passwordStrength.length ? "text-green-600" : "text-gray-500"}`}>
                      {passwordStrength.length ? "✓" : "○"} Mínimo 8 caracteres
                    </p>
                    <p className={`text-xs ${passwordStrength.uppercase ? "text-green-600" : "text-gray-500"}`}>
                      {passwordStrength.uppercase ? "✓" : "○"} Una mayúscula (A-Z)
                    </p>
                    <p className={`text-xs ${passwordStrength.lowercase ? "text-green-600" : "text-gray-500"}`}>
                      {passwordStrength.lowercase ? "✓" : "○"} Una minúscula (a-z)
                    </p>
                    <p className={`text-xs ${passwordStrength.number ? "text-green-600" : "text-gray-500"}`}>
                      {passwordStrength.number ? "✓" : "○"} Un número (0-9)
                    </p>
                    <p className={`text-xs ${passwordStrength.special ? "text-green-600" : "text-gray-500"}`}>
                      {passwordStrength.special ? "✓" : "○"} Un carácter especial (!@#$%^&*)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* confirmar password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700">
                Confirmar contraseña *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition pr-10"
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
              {confirmPassword && password === confirmPassword && (
                <p className="text-green-600 text-xs mt-1">✓ Las contraseñas coinciden</p>
              )}
              {confirmPassword && password !== confirmPassword && (
                <p className="text-red-600 text-xs mt-1">✗ Las contraseñas no coinciden</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl text-white font-semibold shadow-md transition transform hover:scale-[1.02] ${
              loading ? "bg-pink-400 cursor-not-allowed" : "bg-pink-600 hover:bg-pink-700"
            }`}
          >
            {loading ? "Registrando..." : "Registrar ahora"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600 text-sm">
          ¿Ya tienes cuenta?{" "}
          <a href="/signin" className="font-semibold text-pink-600 hover:underline">
            Inicia sesión aquí
          </a>
        </p>
      </div>
    </div>
  );
}
