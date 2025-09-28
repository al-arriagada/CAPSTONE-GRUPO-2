export default function HomePublic() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-semibold leading-tight">
            Gestiona la salud y cuidados de tus mascotas en un solo lugar
          </h1>
          <p className="mt-3 text-gray-600">
            Registra vacunas, agenda citas y lleva el historial médico con facilidad.
          </p>
          <div className="mt-6 flex gap-3">
            <a href="/signup" className="rounded-xl bg-black px-4 py-2 text-white text-sm hover:opacity-90">
              Comenzar gratis
            </a>
            <a href="/signin" className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50">
              Ya tengo cuenta
            </a>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Sin costo para dueños. Invitación simple para veterinarios y cuidadores.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          {/* Pon aquí una captura/preview del dashboard o ilustración */}
          <div className="aspect-[16/10] w-full rounded-xl bg-gray-100" />
        </div>
      </div>
      {/* beneficios */}
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feature title="Recordatorios automáticos" desc="Vacunas, desparasitación y controles." />
        <Feature title="Historial médico" desc="Todo centralizado, fácil de compartir." />
        <Feature title="Citas y análisis" desc="Agenda, métricas y reportes." />
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
