"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";

type Props = {
  property: DbProperty;
  agents: MarketplaceAgent[];
  onClose: () => void;
};

export function PropertyZoomModal({ property, agents, onClose }: Props) {
  const photos = roomUrlsFor(property);
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (photos.length <= 1) return;
      setIdx((i) => (i + dir + photos.length) % photos.length);
    },
    [photos.length],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || photos.length <= 1) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < 48) return;
    if (dx < 0) go(1);
    else go(-1);
  };

  const statusLabel = property.status === "for_rent" ? "For Rent" : "For Sale";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-zoom-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex w-full items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(100dvh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="relative shrink-0 border-b border-[#2C2C2C]/10 bg-black/5">
          <div
            className="relative aspect-[4/3] w-full touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={photos[idx] ?? idx}
                initial={{ opacity: 0.85, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.85 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                <Image
                  src={photos[idx] ?? property.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width: 896px) 896px, 100vw"
                  priority
                />
              </motion.div>
            </AnimatePresence>
            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md hover:bg-white"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md hover:bg-white"
                  aria-label="Next photo"
                >
                  <ChevronRight className="h-5 w-5 text-[#2C2C2C]" />
                </button>
                <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIdx(i)}
                      aria-label={`Photo ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 rounded-full bg-white/90 p-2 shadow-md hover:bg-white"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[#2C2C2C]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#6B9E6E]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#2C2C2C]/80">
              {statusLabel}
            </span>
          </div>
          <h2 id="property-zoom-title" className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">
            {property.name ?? property.location}
          </h2>
          <p className="mt-1 font-serif text-xl font-bold text-[#2C2C2C]">{property.price}</p>
          <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/65">
            {property.beds ? `${property.beds} beds` : "Studio"} · {property.baths} baths · {property.sqft} sqft
          </p>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{property.location}</p>

          <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2C2C2C]/45">Connected agents</p>
            <ul className="mt-3 space-y-3">
              {agents.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-md"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                    <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="48px" textClassName="text-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#2C2C2C]">{a.name}</span>
                      <VerifiedAgentBadge show={true} />
                      <span className="text-xs font-bold text-[#2C2C2C]/60">Score {Math.round(a.score)}</span>
                    </div>
                  </div>
                  <Link
                    href={`/agents/${encodeURIComponent(a.id)}`}
                    className="shrink-0 rounded-full bg-[#D4A843] px-3 py-1.5 text-xs font-bold text-[#2C2C2C] hover:brightness-95"
                  >
                    Available Now
                  </Link>
                </li>
              ))}
            </ul>
            {agents.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/45">No connected agents listed.</p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#2C2C2C]/10 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href={`/properties/${encodeURIComponent(property.id)}`}
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-full bg-[#2C2C2C] py-3.5 text-sm font-bold text-white hover:bg-[#6B9E6E]"
          >
            Request Viewing
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
