"use client";

import { useCallback, useEffect, useState } from "react";
import { previousEditionGallery } from "@/lib/pravrutti-data";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";

export function GallerySection() {
  const images = previousEditionGallery;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? null : (i + delta + images.length) % images.length)),
    [images.length]
  );

  // Lightbox: lock the page, wire Esc / arrow keys.
  useEffect(() => {
    if (openIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, close, step]);

  // Never render an empty grid — the section simply doesn't exist until there
  // are photos to show.
  if (images.length === 0) return null;

  const active = openIndex === null ? null : images[openIndex];

  return (
    <section className="mt-24 lg:mt-32">
      {/* Header */}
      <div className="mb-12">
        <span className="inline-flex items-center gap-3 text-sm font-orbitron tracking-widest text-[#D64D8D] uppercase font-bold mb-5">
          <span className="w-8 h-px bg-[#721F4C]" />
          ARCHIVE &bull; 2025
          <span className="w-8 h-px bg-[#721F4C]" />
        </span>
        <h2 className="text-3xl md:text-5xl font-orbitron tracking-wider text-[#F7EEE4] mb-4 font-black">
          LAST YEAR AT <span className="text-stroke">PRAVRUTTI</span>
        </h2>
        <p className="text-base md:text-lg text-[#F7EEE4]/70 leading-relaxed max-w-3xl font-sharetech">
          Three days, a full campus, and thousands of students building, pitching and competing.
          Here&apos;s what the last edition looked like.
        </p>
      </div>

      {/* Grid — the first frame runs wide so the layout reads as a feature, not a
          row of thumbnails, and stays balanced at any count. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-5">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={`group relative overflow-hidden rounded-2xl border border-[#4A1C3A] bg-[#150B1E]/60 cursor-pointer transition-all duration-300 hover:border-[#D64D8D] hover:shadow-xl hover:shadow-[#D64D8D]/15 focus-visible:outline-2 focus-visible:outline-[#D64D8D] ${
              i === 0 ? "col-span-2 md:row-span-2 aspect-[4/3] md:aspect-square" : "aspect-[4/3]"
            }`}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Caption scrim */}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-left">
              <span className="block text-sm md:text-base font-sharetech text-[#F7EEE4] leading-snug">
                {img.caption}
              </span>
            </div>
            <span className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-black/60 backdrop-blur-sm border border-[#D64D8D]/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-4 h-4 text-[#F2D2AE]" />
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={active.caption}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 rounded-xl border border-[#D64D8D]/50 bg-[#150B1E]/80 flex items-center justify-center text-[#F2D2AE] hover:border-[#D64D8D] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous photo"
                className="absolute left-3 sm:left-6 w-11 h-11 rounded-xl border border-[#4A1C3A] bg-[#150B1E]/80 flex items-center justify-center text-[#F2D2AE] hover:border-[#D64D8D] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next photo"
                className="absolute right-3 sm:right-6 w-11 h-11 rounded-xl border border-[#4A1C3A] bg-[#150B1E]/80 flex items-center justify-center text-[#F2D2AE] hover:border-[#D64D8D] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <figure className="max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={active.src}
              alt={active.alt}
              className="w-full max-h-[78vh] object-contain rounded-xl"
            />
            <figcaption className="mt-4 text-center text-sm md:text-base font-sharetech text-[#F7EEE4]/80">
              {active.caption}
              {images.length > 1 && (
                <span className="ml-2 font-mono text-[#F2D2AE]/70">
                  {(openIndex ?? 0) + 1} / {images.length}
                </span>
              )}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}

export default GallerySection;
