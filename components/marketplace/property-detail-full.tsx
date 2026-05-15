"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  Mail,
  MapPin,
  Phone,
  User as UserIcon,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { resolveListingAgentUserId } from "@/lib/resolve-listing-agent-user-id";
import { useAuth } from "@/contexts/auth-context";

export type DetailProperty = {
  id: string;
  created_at: string;
  location: string;
  price: string;
  status?: "for_sale" | "for_rent" | "sold" | "rented";
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  listed_by: string | null;
  property_type: string | null;
  lat: number | null;
  lng: number | null;
  listing_agent: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

const PropertiesMap = dynamic(
  () => import("@/components/marketplace/properties-map").then((m) => m.PropertiesMap),
  { ssr: false },
);

export function PropertyDetailFull({
  property,
  open,
  onOpenChange,
  galleryImages,
  agentRecordId,
  onListingAgentAvailable,
  similar,
  onSelectSimilar,
}: {
  property: DetailProperty | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  galleryImages: string[];
  agentRecordId: string | null;
  onListingAgentAvailable: (profileId: string) => void;
  similar: DetailProperty[];
  onSelectSimilar: (p: DetailProperty) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadOk, setLeadOk] = useState<string | null>(null);
  const [leadErr, setLeadErr] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    setIdx(0);
    setLeadOk(null);
    setLeadErr(null);
  }, [open, property?.id]);

  const imgs = useMemo(() => (galleryImages?.length ? galleryImages : property ? [property.image_url] : []), [galleryImages, property]);
  const img = imgs[idx] ?? imgs[0];

  const agentName =
    property?.listing_agent?.full_name?.trim() ||
    (property?.listed_by ? "Listing Agent" : "Agent");

  const submitLead = async () => {
    if (!property) return;
    setLeadOk(null);
    setLeadErr(null);
    if (!leadName.trim() || !leadEmail.trim()) {
      setLeadErr("Please provide your name and email.");
      return;
    }
    setLeadBusy(true);
    try {
      const agentUserId = await resolveListingAgentUserId(supabase, property.id);
      if (!agentUserId) {
        setLeadErr("This listing has no assigned agent. Inquiry cannot be submitted.");
        return;
      }
      const { error } = await supabase.from("leads").insert({
        name: leadName.trim(),
        email: leadEmail.trim(),
        phone: leadPhone.trim() ? leadPhone.trim() : null,
        property_interest: `${property.location} (${property.id})`,
        message: leadMessage.trim() ? leadMessage.trim() : null,
        source: "marketplace",
        stage: "new",
        agent_id: agentUserId,
        broker_id: null,
        client_id: user?.id ?? null,
        property_id: property.id,
      });
      if (error) throw error;
      setLeadOk("Request sent! An agent will reach out shortly.");
      setLeadMessage("");
    } catch (e) {
      setLeadErr(e instanceof Error ? e.message : "Could not submit request.");
    } finally {
      setLeadBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && property && (
        <motion.div
          className="fixed inset-0 z-[90] bg-[#FAF8F4]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Top bar */}
          <div className="sticky top-0 z-20 border-b border-[#2C2C2C]/8 bg-[#FAF8F4]/92 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-lg font-bold text-[#2C2C2C]">
                  {property.location}
                </p>
                <p className="text-xs font-semibold text-[#2C2C2C]/45">
                  {property.beds} bd · {property.baths} ba · {property.sqft} sqft
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-[#2C2C2C]/70" />
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-28 pt-4">
            {/* Gallery */}
            <section className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              <div className="relative aspect-[16/9] w-full bg-[#2C2C2C]/5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={img}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={img ?? property.image_url}
                      alt={property.location}
                      fill
                      sizes="(min-width: 1024px) 900px, 100vw"
                      className="object-cover"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>

                {imgs.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => (i - 1 + imgs.length) % imgs.length)}
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-black/10 bg-white/90 p-2 shadow-md"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdx((i) => (i + 1) % imgs.length)}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-black/10 bg-white/90 p-2 shadow-md"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent p-4">
                  <p className="font-serif text-3xl font-bold text-white">{property.price}</p>
                </div>
              </div>

              {imgs.length > 1 && (
                <div className="flex gap-2 overflow-x-auto bg-white px-3 py-3 scrollbar-hide">
                  {imgs.map((u, i) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${
                        i === idx ? "border-[#D4A843]" : "border-transparent"
                      }`}
                    >
                      <Image src={u} alt="" fill sizes="80px" className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Details */}
            <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                    Details
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
                    {property.location.split(",")[0]?.trim() || property.location}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-[#2C2C2C]/70">
                    <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{property.beds} Beds</span>
                    <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{property.baths} Baths</span>
                    <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1">{property.sqft} sqft</span>
                    {property.property_type ? (
                      <span className="rounded-full bg-[#D4A843]/18 px-3 py-1 text-[#8a6d32]">
                        {property.property_type}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-[#2C2C2C]/55">
                    <MapPin className="h-4 w-4 text-[#6B9E6E]" />
                    <span className="truncate">{property.location}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                    Map
                  </p>
                  <div className="mt-3">
                    <PropertiesMap
                      properties={[
                        {
                          id: property.id,
                          location: property.location,
                          price: property.price,
                          status: property.status,
                          lat: property.lat,
                          lng: property.lng,
                        },
                      ]}
                      onSelectProperty={() => {}}
                    />
                  </div>
                </div>

                {similar?.length ? (
                  <div className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                        Similar properties
                      </p>
                      <span className="text-xs font-semibold text-[#2C2C2C]/45">
                        {similar.length} picks
                      </span>
                    </div>
                    <div className="mt-3 flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                      {similar.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectSimilar(p)}
                          className="w-56 shrink-0 overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] text-left shadow-sm hover:bg-[#FAF8F4]/70"
                        >
                          <div className="relative aspect-[4/3] w-full bg-black/5">
                            <Image src={p.image_url} alt="" fill sizes="224px" className="object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent p-3">
                              <p className="font-serif text-lg font-bold text-white">
                                {formatPropertyPriceDisplay(p.price, p.status)}
                              </p>
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="line-clamp-1 text-sm font-semibold text-[#2C2C2C]">
                              {p.location}
                            </p>
                            <p className="mt-1 text-xs text-[#2C2C2C]/55">
                              {p.beds} bd · {p.baths} ba · {p.sqft} sqft
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Right rail */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                    Listing agent
                  </p>

                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#FAF8F4] p-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
                      {property.listing_agent?.avatar_url ? (
                        <Image
                          src={property.listing_agent.avatar_url}
                          alt={agentName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm font-bold text-[#2C2C2C]/55">
                          <UserIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-base font-bold text-[#2C2C2C]">
                        {agentName}
                      </p>
                      <p className="truncate text-xs font-semibold text-[#2C2C2C]/45">
                        Verified network agent
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (property.listing_agent?.id) onListingAgentAvailable(property.listing_agent.id);
                      }}
                      className="flex-1 rounded-full bg-[#6B9E6E] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-[#6C8C70] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Available
                      </span>
                    </button>
                    {agentRecordId ? (
                      <Link
                        href={`/agents/${encodeURIComponent(agentRecordId)}`}
                        className="grid w-11 place-items-center rounded-full border border-black/10 bg-white text-[#2C2C2C]/70 shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                        aria-label="Open agent profile"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">
                    Request a viewing
                  </p>

                  <div className="mt-3 space-y-2">
                    <Field
                      icon={<UserIcon className="h-4 w-4 text-[#6B9E6E]" />}
                      value={leadName}
                      onChange={setLeadName}
                      placeholder="Your name"
                      type="text"
                    />
                    <Field
                      icon={<Mail className="h-4 w-4 text-[#6B9E6E]" />}
                      value={leadEmail}
                      onChange={setLeadEmail}
                      placeholder="Email"
                      type="email"
                    />
                    <Field
                      icon={<Phone className="h-4 w-4 text-[#6B9E6E]" />}
                      value={leadPhone}
                      onChange={setLeadPhone}
                      placeholder="Phone (optional)"
                      type="tel"
                    />
                    <textarea
                      value={leadMessage}
                      onChange={(e) => setLeadMessage(e.target.value)}
                      placeholder="Message (optional)"
                      className="w-full resize-none rounded-2xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
                      rows={4}
                    />
                  </div>

                  {leadErr ? (
                    <div className="mt-3 rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-700">
                      {leadErr}
                    </div>
                  ) : null}
                  {leadOk ? (
                    <div className="mt-3 rounded-2xl bg-[#6B9E6E]/12 px-3 py-2 text-xs font-semibold text-[#2C2C2C]/70">
                      {leadOk}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void submitLead()}
                    disabled={leadBusy}
                    className={`mt-3 w-full rounded-full px-4 py-3 text-sm font-semibold shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 ${
                      leadBusy
                        ? "cursor-not-allowed bg-[#2C2C2C]/10 text-[#2C2C2C]/40"
                        : "bg-[#2C2C2C] text-white hover:bg-[#6B9E6E] transition-colors"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <HeartHandshake className="h-4 w-4" />
                      {leadBusy ? "Sending…" : "Send Request"}
                    </span>
                  </button>

                  <p className="mt-2 text-center text-[11px] font-medium text-[#2C2C2C]/45">
                    By sending, you agree to be contacted about this listing.
                  </p>
                </div>

                <div className="mt-4 text-center text-xs font-semibold text-[#2C2C2C]/45">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="rounded-full px-3 py-2 hover:bg-black/5"
                  >
                    Back to results
                  </button>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  icon,
  value,
  onChange,
  placeholder,
  type,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5">
      <span className="shrink-0">{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full bg-transparent text-sm font-medium text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none"
      />
    </div>
  );
}

