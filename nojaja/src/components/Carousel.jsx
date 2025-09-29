// src/components/Carousel.jsx
import React, { useEffect, useRef, useState } from "react";

export default function Carousel({ images = [], interval = 5000, alt = "slide" }) {
  const [i, setI] = useState(0);
  const timerRef = useRef(null);
  const touchX = useRef(null);

  const hasImages = Array.isArray(images) && images.length > 0;

  const next = () => setI((p) => (p + 1) % images.length);
  const prev = () => setI((p) => (p - 1 + images.length) % images.length);

  useEffect(() => {
    if (!hasImages || images.length <= 1) return;
    timerRef.current = setInterval(next, interval);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasImages, images.length, interval]);

  const pause = () => clearInterval(timerRef.current);
  const resume = () => {
    if (!hasImages || images.length <= 1) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(next, interval);
  };

  const onTouchStart = (e) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const TH = 40;
    if (dx > TH) prev();
    if (dx < -TH) next();
    touchX.current = null;
  };

  // Fallback si no hay imágenes
  if (!hasImages) {
    return (
      <div className="relative aspect-[16/10] min-h-[220px] w-full overflow-hidden rounded-xl bg-gray-100 grid place-items-center">
        <span className="text-gray-500 text-sm">Sin imágenes para mostrar</span>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[16/10] min-h-[220px] w-full overflow-hidden rounded-xl bg-gray-100"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Pista */}
      <div
        className="flex h-full transition-transform duration-500"
        style={{ transform: `translateX(-${i * 100}%)`, width: `${images.length * 100}%` }}
      >
    {images.map((src, idx) => (
    <div key={idx} className="h-full w-full flex-shrink-0">
        <img
        src={src}
        alt={`preview ${idx + 1}`}
        className="block h-full w-full object-cover"
        loading={idx === 0 ? "eager" : "lazy"}          // ⬅️ 1ª imagen sin lazy
        onError={(e) => {                               // ⬅️ fallback si falla
            console.warn("No cargó la imagen:", src);
            e.currentTarget.src =
            "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=1600&q=80&auto=format&fit=crop";
        }}
        referrerPolicy="no-referrer"                    // a veces ayuda con CDNs
        />
    </div>
    ))}
      </div>

      {/* Controles */}
      {images.length > 1 && (
        <>
          <button
            aria-label="Anterior"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur hover:bg-white"
          >
            ‹
          </button>
          <button
            aria-label="Siguiente"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/70 p-2 backdrop-blur hover:bg-white"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Ir a slide ${idx + 1}`}
                onClick={() => setI(idx)}
                className={`h-2 w-2 rounded-full ring-1 ring-black/20 ${
                  i === idx ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

