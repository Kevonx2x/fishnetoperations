"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, MapPin, X } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { AgentSlotPlaceholderModal } from "@/components/marketplace/agent-slot-placeholder";
import { ViewingAgentPickerModal } from "@/components/marketplace/viewing-agent-picker-modal";
import { ViewingRequestModal } from "@/components/marketplace/viewing-request-modal";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";
import { AgentContactOptionsModal } from "@/components/marketplace/agent-contact-options-modal";
import { AgentAvailabilityBadge } from "@/components/marketplace/agent-availability-badge";
import { useAuth } from "@/contexts/auth-context";

type Props = {
  property: DbProperty;
  agents: MarketplaceAgent[];
  onClose: () => void;
  isSaved: boolean;
  onToggleSaved: () => void;
};

function listingAgentUserId(property: DbProperty, agents: MarketplaceAgent[]): string | null {
  if (property.listed_by) {
    const match = agents.find((a) => a.userId === property.listed_by);
    if (match) return property.listed_by;
  }
  return agents[0]?.userId ?? null;
}

type GalleryProps = {
  photos: string[];
  idx: number;
  setIdx: React.Dispatch<React.SetStateAction<number>>;
  property: DbProperty;
  onClose: () => void;
  go: (dir: -1 | 1) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  heightClassName: string;
};

function ZoomGallery({
  photos,
  idx,
  setIdx,
  property,
  onClose,
  go,
  onTouchStart,
  onTouchEnd,
  heightClassName,
}: GalleryProps) {
  return (
    <div className={`relative w-full shrink-0 overflow-hidden bg-black/5 ${heightClassName}`}>
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
  );
}

function isSameAuthUser(viewerUserId: string | null | undefined, agentUserId: string): boolean {
  const v = (viewerUserId ?? "").trim();
  const a = (agentUserId ?? "").trim();
  return v.length > 0 && a.length > 0 && v === a;
}

function AgentsList({
  modalAgents,
  placeholderSlots,
  onClose,
  onContactAgent,
  isLoggedIn,
  onSignInPrompt,
  viewerAgentId,
  viewerUserId,
  propertyId,
  verifiedListingAgent,
}: {
  modalAgents: MarketplaceAgent[];
  placeholderSlots: number;
  onClose: () => void;
  onContactAgent: (agent: MarketplaceAgent) => void;
  isLoggedIn: boolean;
  onSignInPrompt: () => void;
  viewerAgentId: string | null;
  viewerUserId: string | null;
  propertyId: string;
  verifiedListingAgent: boolean;
}) {
  return (
    <ul className="space-y-3">
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
              <div className="mt-2 space-y-2">
                <div>
                  <AgentAvailabilityBadge availability={a.availability} updatedAt={a.updatedAt} />
                </div>
                {isSameAuthUser(viewerUserId, a.userId) ||
                (viewerAgentId != null && viewerAgentId === a.id) ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLoggedIn) {
                        onSignInPrompt();
                        return;
                      }
                      onContactAgent(a);
                    }}
                    className="rounded-lg bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#5d8a60]"
                  >
                    Contact
                  </button>
                )}
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
            <AgentSlotPlaceholderModal
              onLinkClick={onClose}
              propertyId={propertyId}
              verifiedListingAgent={verifiedListingAgent}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DescriptionPreview({
  propertyId,
  desc,
  onClose,
  descriptionNodeId,
}: {
  propertyId: string;
  desc: string;
  onClose: () => void;
  descriptionNodeId?: string;
}) {
  return (
    <div id={descriptionNodeId} className="my-5 border-t border-[#2C2C2C]/10 pt-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/45">Description</p>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#2C2C2C]/75">{desc}</p>
      <Link
        href={`/properties/${encodeURIComponent(propertyId)}`}
        onClick={onClose}
        className="mt-2 inline-block text-sm font-bold text-[#6B9E6E] underline-offset-2 hover:underline"
      >
        Read more
      </Link>
    </div>
  );
}

function PropertyDetailsSection({
  property,
  statusLabel,
  desc,
  detailsId,
  onClose,
  withA11yIds,
  omitDescription,
}: {
  property: DbProperty;
  statusLabel: string;
  desc: string | undefined;
  detailsId: string;
  onClose: () => void;
  withA11yIds: boolean;
  omitDescription?: boolean;
}) {
  return (
    <>
      <h2
        id={withA11yIds ? "property-zoom-title" : undefined}
        className="font-serif text-2xl font-bold leading-tight text-[#2C2C2C]"
      >
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
      {desc && !omitDescription ? (
        <div id={withA11yIds ? detailsId : undefined}>
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
    </>
  );
}

function BottomActions({
  isSaved,
  onToggleSaved,
  onRequestViewing,
  authLoading,
  requestDisabled,
}: {
  isSaved: boolean;
  onToggleSaved: () => void;
  onRequestViewing: () => void;
  authLoading: boolean;
  requestDisabled: boolean;
}) {
  return (
    <div className="shrink-0 space-y-2 border-t border-gray-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onRequestViewing}
        disabled={requestDisabled}
        className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#2C2C2C] py-3 text-sm font-bold text-white transition hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {authLoading ? "Loading…" : "Request Viewing"}
      </button>
      <button
        type="button"
        onClick={() => onToggleSaved()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#2C2C2C]/20 bg-white py-3 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#FAF8F4]"
      >
        <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
        {isSaved ? "Saved" : "Save Property"}
      </button>
    </div>
  );
}

export function PropertyZoomModal({ property, agents, onClose, isSaved, onToggleSaved }: Props) {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [viewerAgentId, setViewerAgentId] = useState<string | null>(null);
  const [viewerAgentVerified, setViewerAgentVerified] = useState<{
    verified: boolean | null;
    status: string;
  } | null>(null);
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [selectedViewingAgentUserId, setSelectedViewingAgentUserId] = useState<string | null>(null);
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactModalAgent, setContactModalAgent] = useState<MarketplaceAgent | null>(null);
  const photos = roomUrlsFor(property);
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const agentUserId = listingAgentUserId(property, agents);
  const propertyTitle = property.name ?? property.location;

  useEffect(() => {
    if (!user?.id) {
      setViewerAgentId(null);
      setViewerAgentVerified(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("agents")
      .select("id, verified, status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { id?: string; verified?: boolean | null; status?: string | null } | null;
        setViewerAgentId(row?.id ?? null);
        setViewerAgentVerified(
          row ? { verified: row.verified ?? null, status: row.status ?? "" } : null,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, supabase]);

  const verifiedListingAgent =
    Boolean(viewerAgentVerified?.verified && viewerAgentVerified?.status === "approved");

  const onRequestViewing = () => {
    if (authLoading) return;
    if (!user) {
      setSignInPromptOpen(true);
      return;
    }
    if (agents.length === 0) return;
    if (agents.length === 1) {
      setSelectedViewingAgentUserId(agents[0].userId);
      setShowViewingModal(true);
      return;
    }
    setShowAgentPicker(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showViewingModal) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showViewingModal]);

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
  const isLoggedIn = !authLoading && !!user;

  const galleryProps: Omit<GalleryProps, "heightClassName"> = {
    photos,
    idx,
    setIdx,
    property,
    onClose,
    go,
    onTouchStart,
    onTouchEnd,
  };

  const detailsProps = {
    property,
    statusLabel,
    desc,
    detailsId,
    onClose,
    omitDescription: Boolean(desc),
  };

  return (
    <>
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
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-[#FAF8F4] shadow-2xl md:h-[min(920px,92vh)] md:max-h-[min(920px,92vh)] md:flex-row md:rounded-2xl"
      >
        {/* ——— Mobile: fixed image | scroll (details + agents) | fixed bottom bar ——— */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          <ZoomGallery {...galleryProps} heightClassName="h-56" />
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4 [-webkit-overflow-scrolling:touch]"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <PropertyDetailsSection {...detailsProps} withA11yIds={true} />
            {desc ? (
              <DescriptionPreview
                propertyId={property.id}
                desc={desc}
                onClose={onClose}
                descriptionNodeId={detailsId}
              />
            ) : null}
            <h3 className="mt-8 font-serif text-lg font-bold text-[#2C2C2C]">Contact an Agent</h3>
            <div className="mt-4">
              <AgentsList
                modalAgents={modalAgents}
                placeholderSlots={placeholderSlots}
                onClose={onClose}
                isLoggedIn={isLoggedIn}
                onSignInPrompt={() => setSignInPromptOpen(true)}
                viewerAgentId={viewerAgentId}
                viewerUserId={user?.id ?? null}
                propertyId={property.id}
                verifiedListingAgent={verifiedListingAgent}
                onContactAgent={(a) => {
                  setContactModalAgent(a);
                  setShowContactModal(true);
                }}
              />
            </div>
          </div>
          <BottomActions
            isSaved={isSaved}
            onToggleSaved={onToggleSaved}
            onRequestViewing={onRequestViewing}
            authLoading={authLoading}
            requestDisabled={authLoading || agents.length === 0}
          />
        </div>

        {/* ——— Desktop: left gallery + details | right agents + bottom actions (unchanged split) ——— */}
        <div className="hidden min-h-0 flex-1 flex-row overflow-hidden md:flex">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:w-[60%] md:max-w-[60%] md:flex-none">
            <ZoomGallery {...galleryProps} heightClassName="h-80" />
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 md:pb-6">
              <PropertyDetailsSection {...detailsProps} withA11yIds={false} />
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-[#2C2C2C]/10 bg-white md:w-[40%] md:max-w-[40%] md:flex-none md:border-l md:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4 md:pt-5">
              {desc ? <DescriptionPreview propertyId={property.id} desc={desc} onClose={onClose} /> : null}
              <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">Contact an Agent</h3>
              <div className="mt-4">
                <AgentsList
                  modalAgents={modalAgents}
                  placeholderSlots={placeholderSlots}
                  onClose={onClose}
                  isLoggedIn={isLoggedIn}
                  onSignInPrompt={() => setSignInPromptOpen(true)}
                  viewerAgentId={viewerAgentId}
                  viewerUserId={user?.id ?? null}
                  propertyId={property.id}
                  verifiedListingAgent={verifiedListingAgent}
                  onContactAgent={(a) => {
                    setContactModalAgent(a);
                    setShowContactModal(true);
                  }}
                />
              </div>
            </div>
            <BottomActions
              isSaved={isSaved}
              onToggleSaved={onToggleSaved}
              onRequestViewing={onRequestViewing}
              authLoading={authLoading}
              requestDisabled={authLoading || agents.length === 0}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
    <ViewingAgentPickerModal
      open={showAgentPicker}
      onOpenChange={setShowAgentPicker}
      agents={agents}
      onSelect={(a) => {
        setSelectedViewingAgentUserId(a.userId);
        setShowAgentPicker(false);
        setShowViewingModal(true);
      }}
    />
    <ViewingRequestModal
      open={showViewingModal}
      onOpenChange={(open) => {
        setShowViewingModal(open);
        if (!open) setSelectedViewingAgentUserId(null);
      }}
      propertyId={property.id}
      propertyTitle={propertyTitle}
      agentUserId={selectedViewingAgentUserId ?? agentUserId}
    />
    <SignInViewingPromptModal open={signInPromptOpen} onOpenChange={setSignInPromptOpen} />
    <AgentContactOptionsModal
      open={showContactModal}
      onOpenChange={(o) => {
        setShowContactModal(o);
        if (!o) setContactModalAgent(null);
      }}
      agent={contactModalAgent}
      propertyId={property.id}
      propertyTitle={propertyTitle}
    />
    </>
  );
}
