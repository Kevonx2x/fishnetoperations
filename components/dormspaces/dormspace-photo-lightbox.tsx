"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { GalleryNavButton } from "@/components/ui/gallery-nav-button";

import { dormspaceListingPhotoSrc } from "@/lib/dormspaces";

export function DormspacePhotoLightbox({
  photos,
  initialIndex,
  galleryLabel,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  galleryLabel: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, goPrev, goNext]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const dx = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 48) return;
    if (dx > 0) goPrev();
    else goNext();
  };

  if (typeof document === "undefined") return null;

  const currentSrc = dormspaceListingPhotoSrc(String(photos[index] ?? photos[0] ?? "").trim());
  const countLabel = photos.length > 0 ? `${index + 1} of ${photos.length}` : "";

  const shell = (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={galleryLabel ? `${galleryLabel} — ${countLabel}` : countLabel}
    >
      <div className="relative z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
        <div aria-hidden />
        <p className="min-w-0 text-center text-base font-semibold tabular-nums text-white">{countLabel}</p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-12 w-12" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 w-full touch-pan-x">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-black"
          aria-label="Close gallery"
          onClick={onClose}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-14 pb-8 pt-0 sm:px-20"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="pointer-events-auto flex h-full w-full max-h-full max-w-full items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentSrc}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>
        </div>

        {photos.length > 1 ? (
          <>
            <GalleryNavButton
              direction="prev"
              size="lg"
              className="left-2 z-20 sm:left-4"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous photo"
            />
            <GalleryNavButton
              direction="next"
              size="lg"
              className="right-2 z-20 sm:right-4"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Next photo"
            />
          </>
        ) : null}
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}
