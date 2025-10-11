// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useProfile from "../hooks/useProfile.js";
import useUserRole from "../hooks/useUserRole.js"; // ⬅️ NUEVO

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { profile, displayName, loading: loadingProfile } = useProfile(user);
  const { role, loading: loadingRole } = useUserRole(); // ⬅️ NUEVO

  const handleLogout = async () => {
    navigate("/", { replace: true }); // evita volver a rutas privadas al retroceder
    try {
      await signOut();
    } catch (e) {
      console.error(e);
    }
  };

  // Home según rol (si no hay sesión => landing "/")
  const homePath = user ? (role === "vet" ? "/vet" : "/app") : "/";

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: logo */}
        <div className="flex items-center gap-2">
          <Link to={homePath} className="flex items-center gap-2">
            <span className="text-xl">🐾</span>
            <span className="font-semibold">PetCare Pro</span>
          </Link>
        </div>

        {/* Center: links (ocultos en mobile) */}
        <div className="hidden items-center gap-4 md:flex">
          {user && !loadingRole && role === "owner" && (
            <NavItem to="/app">Dashboard</NavItem>
          )}
          {user && !loadingRole && role === "vet" && (
            <NavItem to="/vet">Pacientes</NavItem>
          )}
        </div>

        {/* Right: auth actions */}
        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
          ) : user ? (
            <UserMenu
              user={user}
              name={displayName}
              avatarPath={profile?.avatar_url}
              loadingName={loadingProfile}
              onLogout={handleLogout}
              // ⬇️ Perfil/entrada según rol
              avatarTo={role === "vet" ? "/vet/profile" : "/app/profile"}
            />
          ) : (
            <>
              <Link
                to="/signin"
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Iniciar sesión
              </Link>
              <Link
                to="/signup"
                className="rounded-xl bg-black px-3 py-1.5 text-sm text-white hover:opacity-90"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="inline-flex items-center rounded-xl border px-2 py-1 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
            <div className="h-px bg-gray-200 my-2" />

            {loading ? (
              <div className="h-8 w-24 animate-pulse rounded-md bg-gray-200" />
            ) : user ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      fallback={user?.email}
                      avatarUrl={profile?.avatar_url}
                      to={role === "vet" ? "/vet" : "/app/profile"}
                    />
                    <div className="text-sm">
                      <div className="font-medium leading-tight">
                        {loadingProfile ? "Cargando..." : (displayName || user?.email)}
                      </div>
                      <div className="text-gray-500">Sesión activa</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); handleLogout(); }}
                    className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    Cerrar sesión
                  </button>
                </div>

                {/* Enlaces principales según rol */}
                {!loadingRole && (
                  <div className="mt-2">
                    <NavItem
                      to={role === "vet" ? "/vet" : "/app"}
                      onClick={() => setOpen(false)}
                    >
                      {role === "vet" ? "Pacientes" : "Dashboard"}
                    </NavItem>
                  </div>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/signin"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border px-3 py-1.5 text-center text-sm hover:bg-gray-50"
                >
                  Iniciar sesión
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-black px-3 py-1.5 text-center text-sm text-white hover:opacity-90"
                >
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

function NavItem({ to, end, children, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "rounded-xl px-3 py-1.5 text-sm",
          isActive ? "bg-black text-white" : "hover:bg-gray-50",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}

function UserMenu({ user, name, avatarPath, loadingName, onLogout, avatarTo = "/app/profile" }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar fallback={user?.email} avatarUrl={avatarPath} to={avatarTo} />
      <span className="hidden text-sm text-gray-700 sm:inline">
        Bienvenido,{" "}
        <strong>{loadingName ? "..." : (name || user?.email?.split("@")[0])}</strong>
      </span>
      <button
        onClick={onLogout}
        className="rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-50"
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
