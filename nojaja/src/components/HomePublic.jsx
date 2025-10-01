import Carousel from "./Carousel";
import preview from "../assets/perritohd.png";
import prev2 from "../assets/gatohd.png"
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";



export default function HomePublic() {
  const { user, loading } = useAuth();
  if (loading) return null; // evita parpadeo
  
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold leading-tight">
            Gestiona la salud y cuidados de tus mascotas en un solo lugar
          </h1>
          <p className="mt-3 text-gray-600">
            Registra vacunas, citas y lleva el historial médico con facilidad.
          </p>
        <div className="mt-6 flex gap-3">
          {user ? (
            // ⬇️ si hay sesión, muestra un CTA distinto
            <Link
              to="/app"
              className="rounded-xl bg-black px-4 py-2 text-white text-sm hover:opacity-90"
            >
              Ir al dashboard
            </Link>
          ) : (
            // ⬇️ si NO hay sesión, muestra los dos botones originales
            <>
              <Link
                to="/signup"
                className="rounded-xl bg-black px-4 py-2 text-white text-sm hover:opacity-90"
              >
                Comenzar gratis
              </Link>
              <Link
                to="/signin"
                className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
              >
                Ya tengo cuenta
              </Link>
            </>
          )}
        </div>
          <p className="mt-3 text-xs text-gray-500">
            Sin costo para dueños. Invitación simple para veterinarios y cuidadores.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          {/* Pon aquí una captura/preview del dashboard o ilustración */}
            <Carousel
              images={
              [preview,prev2]}
              fit="cover"
              position="center"
              interval={5000}
              alt="preview"
              
            />
        </div>
      </div>
      {/* beneficios */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feature title="Recordatorios automáticos" desc="Vacunas, desparasitación y controles." />
        <Feature title="Historial médico" desc="Todo centralizado, fácil de compartir." />
        <Feature title="Citas y análisis" desc="Métricas y reportes." />
      </div>
    </section>
  );
}

function Feature({ title, desc }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="text-gray-600 text-sm mt-1">{desc}</p>
    </div>
  );
}
