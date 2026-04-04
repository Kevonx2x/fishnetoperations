"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, MapPin, X } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";

type Props = {
  property: DbProperty;
  agents: MarketplaceAgent[];
  onClose: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
};

function agentShowsAvailableNow(a: MarketplaceAgent): boolean {
  const v = a.availability.trim().toLowerCase();
  if (!v) return false;
  return /available|now|open|yes|immediate|today/.test(v);
}

export function PropertyZoomModal({ property, agents, onClose, isSaved, onToggleSaved }: Props) {
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
  const desc = property.description?.trim();

  const modalAgents = agents;
  const placeholderSlots = Math.max(0, 2 - modalAgents.length);
  const detailsId = "property-zoom-details";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-zoom-title"
      aria-describedby={desc ? detailsId : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex w-full items-stretch justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-y-auto bg-[#FAF8F4] shadow-2xl sm:max-h-[min(920px,92vh)] sm:rounded-2xl md:h-[min(920px,92vh)] md:max-h-[min(920px,92vh)] md:flex-row md:overflow-hidden"
      >
        {/* Left: gallery + details */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:w-[60%] md:max-w-[60%] md:flex-none">
          <div className="relative h-80 w-full shrink-0 bg-black/5">
            <div
              className="relative h-full w-full touch-pan-y"
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={photos[idx] ?? idx}
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0"
                >
                  <Image
                    src={photos[idx] ?? property.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(min-width: 768px) 480px, 100vw"
                    priority
                  />
                </motion.div>
              </AnimatePresence>
              {photos.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-md transition hover:bg-white"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-5 w-5 text-[#2C2C2C]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow-md transition hover:bg-white"
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
                        className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-2 bg-white/55"}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 rounded-full bg-white/95 p-2 shadow-md transition hover:bg-white"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-[#2C2C2C]" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 md:pb-6">
            <h2 id="property-zoom-title" className="font-serif text-2xl font-bold leading-tight text-[#2C2C2C]">
              {property.name ?? property.location}
            </h2>
            <p className="mt-2 font-serif text-2xl font-bold text-[#D4A843]">{property.price}</p>
            <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/70">
              {property.beds ? `${property.beds} beds` : "Studio"} · {property.baths} baths · {property.sqft} sqft
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#2C2C2C]/65">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
              <span>{property.location}</span>
            </p>
            <span className="mt-3 inline-flex rounded-full bg-[#6B9E6E]/15 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/85">
              {statusLabel}
            </span>
            <div className="my-5 border-t border-[#2C2C2C]/10" />
            {desc ? (
              <div id={detailsId}>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/45">Description</p>
                <p className="mt-2 text-sm leading-relaxed text-[#2C2C2C]/75">{desc}</p>
              </div>
            ) : null}
            <div className="mt-6">
              <Link
                href={`/properties/${encodeURIComponent(property.id)}`}
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#D4A843] px-4 py-3 text-sm font-bold text-[#2C2C2C] shadow-sm transition hover:brightness-95 sm:w-auto"
              >
                View Full Details
              </Link>
            </div>
          </div>
        </div>

        {/* Right: contact agents */}
        <div className="flex min-h-0 flex-col border-t border-[#2C2C2C]/10 bg-white md:w-[40%] md:max-w-[40%] md:flex-none md:border-l md:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4 md:pt-5">
            <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Contact an Agent</h3>
            <ul className="mt-4 space-y-3">
              {modalAgents.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/80 p-3 shadow-sm"
                >
                  <div className="flex gap-3">
                    <Link
                      href={`/agents/${encodeURIComponent(a.id)}`}
                      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10"
                      onClick={onClose}
                    >
                      <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="48px" textClassName="text-sm" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/agents/${encodeURIComponent(a.id)}`}
                          className="font-semibold text-[#2C2C2C] hover:underline"
                          onClick={onClose}
                        >
                          {a.name}
                        </Link>
                        <BadgeCheck className="h-4 w-4 shrink-0 text-[#D4A843]" aria-label="Verified" />
                        <span className="rounded-md bg-[#2C2C2C]/8 px-1.5 py-0.5 text-[11px] font-bold text-[#2C2C2C]/80">
                          {Math.round(a.score)}
                        </span>
                      </div>
                      {a.brokerName ? (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-[#2C2C2C]/50">{a.brokerName}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {agentShowsAvailableNow(a) ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6B9E6E]">
                            <span className="h-2 w-2 rounded-full bg-[#6B9E6E]" aria-hidden />
                            Available Now
                          </span>
                        ) : null}
                        <Link
                          href={`/agents/${encodeURIComponent(a.id)}`}
                          onClick={onClose}
                          className="rounded-lg bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#5d8a60]"
                        >
                          Contact
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {Array.from({ length: placeholderSlots }).map((_, i) => (
                <li
                  key={`ph-${i}`}
                  className="rounded-xl border border-dashed border-[#6B9E6E]/35 bg-[#FAF8F4]/60 p-3"
                >
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] text-sm font-bold text-white">
                      ?
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#2C2C2C]/70">Agent Slot Available</p>
                      <Link
                        href="/register/agent"
                        onClick={onClose}
                        className="mt-1 inline-block text-xs font-semibold text-[#6B9E6E] hover:underline"
                      >
                        Become a listing agent →
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 space-y-2 border-t border-[#2C2C2C]/10 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link
              href={`/properties/${encodeURIComponent(property.id)}`}
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-xl bg-[#2C2C2C] py-3 text-sm font-bold text-white transition hover:bg-[#1a1a1a]"
            >
              Request Viewing
            </Link>
            <button
              type="button"
              onClick={() => onToggleSaved()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#2C2C2C]/20 bg-white py-3 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#FAF8F4]"
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
              {isSaved ? "Saved" : "Save Property"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
