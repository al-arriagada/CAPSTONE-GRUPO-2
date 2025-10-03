// src/components/Signup.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Signup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [rut, setRut] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Función para validar y formatear RUT
  const formatRut = (value) => {
    const cleaned = value.replace(/[^0-9kK]/g, "");
    if (cleaned.length === 0) return "";
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    if (body.length <= 1) return cleaned;
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formattedBody}-${dv}`;
  };

  // Algoritmo de verificación de RUT chileno
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

  // Calcular edad
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

  // Validar fortaleza de contraseña
  const validatePasswordStrength = (password) => {
    const strength = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/]/.test(password)
    };
    setPasswordStrength(strength);
    return Object.values(strength).every(Boolean);
  };

  const handleRutChange = (e) => {
    const formatted = formatRut(e.target.value);
    setRut(formatted);
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    validatePasswordStrength(newPassword);
  };

  const getPasswordStrengthColor = () => {
    const score = Object.values(passwordStrength).filter(Boolean).length;
    if (score === 5) return "text-green-600";
    if (score >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validación de RUT
    if (!validateRut(rut)) {
      setError("RUT inválido. Por favor verifica el formato.");
      setLoading(false);
      return;
    }

    // Validación de edad (mayor de 18)
    if (fechaNacimiento) {
      const age = calculateAge(fechaNacimiento);
      if (age < 18) {
        setError("Debes ser mayor de 18 años para registrarte.");
        setLoading(false);
        return;
      }
    }

    // Validación de fortaleza de contraseña
    if (!validatePasswordStrength(password)) {
      setError("La contraseña no cumple con los requisitos de seguridad.");
      setLoading(false);
      return;
    }

    // Validación de contraseñas
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      // Normaliza fecha a YYYY-MM-DD
      const birthISO = fechaNacimiento ? new Date(fechaNacimiento).toISOString().slice(0, 10) : null;

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // 👇 usa "full_name" (no "username") para que luego ensureProfile lo tome
          data: {
            full_name: username,
            rut,                  // si deseas guardarlo en auth (opcional)
            birth_date: birthISO, // opcional: útil para trigger/analítica
          },
          
        },
      });

    console.log("signup result:", { data, authError });

      // Manejo de errores explícitos
      if (authError) {
        const msg = authError?.message ?? String(authError);
        if (
          msg.includes("already registered") ||
          msg.includes("User already registered") ||
          msg.includes("user_already_exists") ||
          msg.includes("duplicate key value")
        ) {
          setError("Este correo ya está registrado.");
        } else if (msg.toLowerCase().includes("password")) {
          setError("La contraseña debe tener al menos 6 caracteres.");
        } else {
          setError(msg);
        }
        setLoading(false);
        return;
      }

      // Manejo de usuario obfuscado (cuando email ya existe y confirmación está activada)
      const isObfuscatedUser =
        data?.user &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0;

      if (isObfuscatedUser) {
        setError("Este correo ya está registrado.");
        setLoading(false);
        return;
      }

      if (!data?.user) {
        setError("Error al crear el usuario. Por favor, intenta nuevamente.");
        setLoading(false);
        return;
      }

      setSuccess("¡Registro exitoso! Revisa tu correo para confirmar.");
      setTimeout(() => {
        navigate("/signin");
      }, 2000);
    } catch (err) {
      console.error("Error en registro:", err);
      setError("Ocurrió un error inesperado. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

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
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700">
                Nombre de usuario *
              </label>
              <input
                id="username"
                type="text"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="Ej: Juanito23"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                Correo electrónico *
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="rut" className="block text-sm font-semibold text-gray-700">
                RUT *
              </label>
              <input
                id="rut"
                type="text"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                placeholder="12.345.678-9"
                value={rut}
                onChange={handleRutChange}
                maxLength={12}
              />
              {rut && validateRut(rut) && (
                <p className="text-green-600 text-xs mt-1">✓ RUT válido</p>
              )}
              {rut && !validateRut(rut) && rut.length >= 3 && (
                <p className="text-red-600 text-xs mt-1">✗ RUT inválido</p>
              )}
            </div>

            <div>
              <label htmlFor="fechaNacimiento" className="block text-sm font-semibold text-gray-700">
                Fecha de Nacimiento *
              </label>
              <input
                id="fechaNacimiento"
                type="date"
                required
                className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
              {fechaNacimiento && (
                <p className="text-gray-600 text-xs mt-1">
                  Edad: {calculateAge(fechaNacimiento)} años
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                Contraseña *
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 mt-1 text-gray-900 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                Confirmar contraseña *
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
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
              loading
                ? "bg-pink-400 cursor-not-allowed"
                : "bg-pink-600 hover:bg-pink-700"
            }`}
          >
            {loading ? "Registrando..." : "Registrar ahora"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600 text-sm">
          ¿Ya tienes cuenta?{" "}
          <a
            href="/signin"
            className="font-semibold text-pink-600 hover:underline"
          >
            Inicia sesión aquí
          </a>
        </p>
      </div>
    </div>
  );
}
