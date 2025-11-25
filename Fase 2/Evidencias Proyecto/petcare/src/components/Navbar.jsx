// src/components/Navbar.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx"; // Asegúrate que la ruta sea correcta
import useProfile from "../hooks/useProfile.js"; // Asegúrate que la ruta sea correcta
import useUserRole from "../hooks/useUserRole.js"; // Asegúrate que la ruta sea correcta
import { useAlertsCount } from "../hooks/useAlertsCount.js"; // Asegúrate que la ruta sea correcta
import { FaUser, FaBell, FaRegBell } from "react-icons/fa";
import AlertsPopover from './AlertsPopover.jsx'; // Asegúrate que la ruta sea correcta

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { profile, displayName, loading: loadingProfile } = useProfile(user);
  const { role, loading: loadingRole } = useUserRole(); // Obtiene 'owner', 'vet', 'caregiver'
  const { count, loadingAlerts } = useAlertsCount();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleLogout = async () => {
    navigate("/", { replace: true });
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
  };

  const popoverRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popoverRef]);

  // --- 👇 Home según rol (ACTUALIZADO) ---
  const homePath = user
    ? role === "vet"
      ? "/vet"
      : role === "caregiver" // <-- AÑADIDO: Caso Caregiver
        ? "/caregiver"        // <-- Ruta para Caregiver
        : "/app"              // Default a owner/app
    : "/";                  // Sin sesión, va al landing

  // --- 👇 Ruta del Perfil según rol (ACTUALIZADO) ---
  const profilePath = role === "vet"
    ? "/vet/profile"
    : role === "caregiver" // <-- AÑADIDO: Caso Caregiver
      ? "/caregiver/profile" // <-- Ruta para Caregiver (ajusta si es diferente)
      : "/app/profile";      // Default a owner/app

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-3">

        {/* 1. IZQUIERDA: Logo */}
        <div className="flex items-center gap-2">
          <Link to={homePath} className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-semibold">PetCare Pro</span>
          </Link>
        </div>

        {/* 2. DERECHA: Acciones (Campana + Usuario/Login + Hamburguesa) */}
        <div className="flex items-center gap-2">

          {/* --- A. CAMPANITA (Visible SOLO si hay usuario) --- */}
          {user && !loading && (
            <div className="relative" ref={popoverRef}>
              <button
                onClick={() => setIsPopoverOpen(prev => !prev)}
                className="relative inline-flex items-center justify-center p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-black/20"
              >
                {/* Icono Campana */}
                <span className="h-5 w-5 text-xl" aria-hidden="true"> <FaRegBell /> </span>

                {/* Contador Rojo */}
                {!loadingAlerts && count > 0 && (
                  <span className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                    {count}
                  </span>
                )}
              </button>

              {/* Popover de Alertas */}
              {isPopoverOpen && (
                <div className="
                    /* Estilos móviles: fijo y centrado en la pantalla */
                    fixed left-4 right-4 top-16 z-50 w-auto
                    /* Estilos escritorio: absoluto y alineado a la derecha */
                    sm:absolute sm:top-full sm:right-0 sm:left-auto sm:w-96 sm:mt-2
                  ">
                  <AlertsPopover onClose={() => setIsPopoverOpen(false)} />
                </div>
              )}
            </div>
          )}

          {/* --- B. MENÚ ESCRITORIO (Usuario o Login - Oculto en móvil) --- */}
          <div className="hidden md:flex items-center gap-4">
            {loading || loadingRole ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
            ) : user ? (
              <UserMenu
                user={user}
                name={displayName}
                avatarPath={profile?.avatar_url}
                loadingName={loadingProfile}
                onLogout={handleLogout}
                avatarTo={profilePath}
              />
            ) : (
              <>
                <Link to="/signin" className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Iniciar sesión
                </Link>
                <Link to="/signup" className="rounded-xl bg-black px-3 py-1.5 text-sm text-white hover:opacity-90">
                  Registrarse
                </Link>
              </>
            )}
          </div>

          {/* --- C. BOTÓN HAMBURGUESA (Solo móvil) --- */}
          <button
            className="inline-flex items-center rounded-xl border px-2 py-1 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            {/* Icono de menú simple (puedes cambiarlo por tu icono preferido) */}
            <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

        </div> {/* Fin DERECHA */}
      </div>

      {/* 3. MENÚ MÓVIL DESPLEGABLE (Contenido extra) */}
      {open && (
        <div className="border-t bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">

            {loading || loadingRole ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
            ) : user ? (
              <>
                {/* Info Usuario Móvil */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      fallback={user?.email}
                      avatarUrl={profile?.avatar_url}
                      to={profilePath}
                    />
                    <div className="text-sm">
                      <div className="font-medium leading-tight">
                        {loadingProfile ? "Cargando..." : (displayName || user?.email)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); handleLogout(); }}
                    className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Cerrar sesión
                  </button>
                </div>

                {/* Enlaces Móviles */}
                <div className="flex flex-col gap-1">
                  <Link to={homePath} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium text-gray-700 hover:text-black">
                    {role === "vet" ? "Pacientes" : "Dashboard"}
                  </Link>
                  {/* Agrega aquí más enlaces si los necesitas */}
                </div>
              </>
            ) : (
              // Botones Móviles Login/Signup
              <div className="flex gap-2 mt-2">
                <Link to="/signin" onClick={() => setOpen(false)} className="flex-1 rounded-xl border px-3 py-1.5 text-center text-sm hover:bg-gray-50">
                  Iniciar sesión
                </Link>
                <Link to="/signup" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-black px-3 py-1.5 text-center text-sm text-white hover:opacity-90">
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

// --- Componentes Helper (sin cambios funcionales, ajustados para móvil) ---

function NavItem({ to, end, children, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "block rounded-xl px-3 py-1.5 text-sm", // 'block' ayuda en layout móvil
          isActive ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100", // Estilos ajustados
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

// Recibe avatarTo dinámico
function UserMenu({ user, name, avatarPath, loadingName, onLogout, avatarTo }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar fallback={user?.email} avatarUrl={avatarPath} to={avatarTo} />
      <span className="hidden text-sm text-gray-700 sm:inline">
        Bienvenido,{" "}
        <strong>{loadingName ? "..." : (name || user?.email?.split("@")[0])}</strong>
      </span>
      <button
        onClick={onLogout}
        className="rounded-xl border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100" // Estilos ajustados
      >
        Cerrar sesión
      </button>
    </div>
  );
}




function Avatar({ fallback, avatarUrl, to = "/app/profile" }) {
  const letter = (fallback || "?").toString().charAt(0).toUpperCase();
  const fullUrl = avatarUrl
    ? `https://owrosyqgjlelskjhcmbb.supabase.co/storage/v1/object/public/owners/${avatarUrl}?t=${Date.now()}`
    : null;

  return (
    <Link
      to={to}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white hover:scale-105 transition overflow-hidden"
      aria-label="Abrir perfil"
    >
      {fullUrl ? (
        <img src={fullUrl} alt="avatar" className="h-full w-full object-cover" />
      ) : (
        letter
      )}
    </Link>
  );
}
