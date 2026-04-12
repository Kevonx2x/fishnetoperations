"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAgentLiveAvailabilityFromPropertyRows } from "@/hooks/use-agent-live-availability";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pin,
  Home,
  MapPin,
  Shield,
  BadgeCheck,
  Lock,
  Search,
  Star,
  UserPlus,
  Flame,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { ConnectedAgentsBox } from "@/components/marketplace/connected-agents-box";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";
import type { DbProperty, SortMode } from "@/lib/marketplace-property";
import { roomUrlsFor } from "@/lib/marketplace-property";
import {
  usePropertyEngagementForProperties,
  type PropertyEngagement,
} from "@/hooks/use-property-engagement";
import { useAuth } from "@/contexts/auth-context";
import { PropertyZoomModal } from "@/components/marketplace/property-zoom-modal";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";
import { listingListedLabel } from "@/lib/listing-listed-time";
import { AgentDirectoryCard } from "@/components/marketplace/agent-directory-card";
import { PhLocationInput } from "@/components/ui/ph-location-input";
import { cn } from "@/lib/utils";
import { formatAgentScore } from "@/lib/format-agent-score";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";

export type { DbProperty, SortMode } from "@/lib/marketplace-property";
export { roomUrlsFor } from "@/lib/marketplace-property";

const FEATURED_CITIES: {
  key: string;
  label: string;
  imageUrl: string;
  match: (location: string) => boolean;
}[] = [
  {
    key: "BGC",
    label: "BGC",
    imageUrl: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=300&h=200&fit=crop",
    match: (loc) => loc.toLowerCase().includes("bgc"),
  },
  {
    key: "Makati",
    label: "Makati",
    imageUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=300&h=200&fit=crop",
    match: (loc) => loc.toLowerCase().includes("makati"),
  },
  {
    key: "Cebu City",
    label: "Cebu City",
    imageUrl: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=300&h=200&fit=crop",
    match: (loc) => /cebu/i.test(loc),
  },
  {
    key: "Davao",
    label: "Davao",
    imageUrl: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=300&h=200&fit=crop",
    match: (loc) => /davao/i.test(loc),
  },
  {
    key: "Ortigas",
    label: "Ortigas",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop",
    match: (loc) => loc.toLowerCase().includes("ortigas"),
  },
  {
    key: "Tagaytay",
    label: "Tagaytay",
    imageUrl: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&h=200&fit=crop",
    match: (loc) => /tagaytay/i.test(loc),
  },
];

function neighborhoodKey(location: string): string {
  const l = location.toLowerCase();
  const known = [
    "makati cbd",
    "makati",
    "bgc",
    "alabang",
    "forbes park",
    "tagaytay",
    "ortigas",
    "pasig",
    "quezon city",
    "mandaluyong",
    "san juan",
  ];
  const hit = known.find((k) => l.includes(k));
  if (!hit) return location.split(",")[0]?.trim() || location;
  return hit
    .split(" ")
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

function parsePesoToNumber(price: string): number {
  const raw = price.trim();
  const cleaned = raw.replace(/[₱,\s]/g, "");
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([MK])?$/i);
  if (m) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return 0;
    const suffix = (m[2] ?? "").toUpperCase();
    if (suffix === "M") return n * 1_000_000;
    if (suffix === "K") return n * 1_000;
    return n;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatPeso(n: number): string {
  if (!Number.isFinite(n)) return "₱0";
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  return `₱${Math.round(n).toLocaleString()}`;
}

/** Hide admin/test accounts from homepage directory lists (top agents, city agents). */
function isExcludedFromPublicAgentDirectory(a: MarketplaceAgent): boolean {
  if (a.name.trim().toLowerCase() === "ron admin") return true;
  if (a.email.toLowerCase().includes("ron.business101")) return true;
  return false;
}

type AgentRowWithProfile = {
  name?: string | null;
  email?: string | null;
  profiles?: { role?: string | null } | { role?: string | null }[] | null;
};

function shouldIncludeAgentDirectoryRow(row: unknown): boolean {
  const r = row as AgentRowWithProfile;
  const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  if (prof?.role === "admin") return false;
  if ((r.name ?? "").trim().toLowerCase() === "ron admin") return false;
  const em = (r.email ?? "").toLowerCase();
  if (em.includes("ron.business101")) return false;
  return true;
}

type AgentHomeExtra = {
  yearsExperience: number | null;
  languagesSpoken: string | null;
  serviceAreaPills: string[];
};

function parseServiceAreasForPills(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 10.0 scale for score beside name (matches agent directory card). */
function scoreDecimalOnTenHome(score: number | null | undefined): string | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Number(score);
  const onTen = n > 10 ? n / 10 : n;
  if (onTen <= 0) return null;
  return onTen.toFixed(1);
}

function HomeTopAgentCard({
  agent,
  extra,
}: {
  agent: MarketplaceAgent;
  extra?: AgentHomeExtra;
}) {
  const scoreRight = scoreDecimalOnTenHome(agent.score);
  const yearsLine =
    extra?.yearsExperience != null && Number.isFinite(extra.yearsExperience) && extra.yearsExperience >= 0
      ? `${extra.yearsExperience} years experience`
      : null;
  const langsLine = extra?.languagesSpoken?.trim() ? extra.languagesSpoken.trim() : null;

  return (
    <div className="group flex min-h-0 w-full min-w-[160px] max-w-[300px] shrink-0 flex-col rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-md transition-all duration-200 ease-in-out will-change-transform hover:-translate-y-1 hover:scale-[1.02] hover:border-[#2C2C2C]/15 hover:shadow-xl lg:w-[300px]">
      <div className="flex min-h-0 flex-col items-center">
        <div className="relative mx-auto h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <AgentAvatarFill name={agent.name} imageUrl={agent.image} sizes="56px" textClassName="text-base" />
        </div>
        <div className="mt-2 flex w-full flex-col items-center px-0.5 text-center">
          <p className="line-clamp-2 w-full text-sm font-bold text-[#2C2C2C]">{agent.name}</p>
          {scoreRight ? (
            <span className="mt-0.5 text-xs text-gray-500">⭐ {scoreRight}</span>
          ) : null}
        </div>
        {agent.verified ? (
          <span className="mt-1 inline-flex shrink-0 items-center rounded-full bg-[#6B9E6E] px-2 py-0.5 text-[10px] font-semibold text-white">
            Verified
          </span>
        ) : null}
        <p className="mt-2 text-xs text-center text-gray-500">{agent.closings} closings</p>
        {yearsLine ? <p className="mt-1 text-center text-[11px] text-gray-500">{yearsLine}</p> : null}
        {langsLine ? <p className="mt-0.5 text-center text-[11px] text-gray-500">{langsLine}</p> : null}
        {extra?.serviceAreaPills && extra.serviceAreaPills.length > 0 ? (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-1">
            {extra.serviceAreaPills.map((area) => (
              <span
                key={area}
                className="rounded-full bg-[#6B9E6E]/12 px-2 py-0.5 text-[10px] font-semibold text-[#6B9E6E]"
              >
                {area}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full border-2 border-[#6B9E6E] bg-white px-4 py-2 text-sm font-semibold text-[#6B9E6E] transition-colors hover:bg-[#6B9E6E]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] focus-visible:ring-offset-2"
      >
        View Profile
      </Link>
    </div>
  );
}

/** Fixed hero showcase cards (always Unsplash; links to agent directory). */
const HERO_FLOATING_CARDS = [
  {
    id: "hero-1",
    name: "BGC Luxury Condo",
    location: "BGC, Taguig",
    image_url: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=600&h=400&fit=crop",
  },
  {
    id: "hero-2",
    name: "Makati Penthouse",
    location: "Makati CBD, Makati",
    image_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop",
  },
  {
    id: "hero-3",
    name: "Ortigas Modern Home",
    location: "Ortigas Center, Pasig",
    image_url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop",
  },
] as const;

function HeroFloatingPropertyCards() {
  const configs = [
    {
      top: "top-0",
      width: "w-[248px]",
      rotate: "rotate-[5deg]",
      z: "z-10",
      scale: "",
    },
    {
      top: "top-[108px]",
      width: "w-[292px]",
      rotate: "rotate-0",
      z: "z-20",
      scale: "scale-[1.04]",
    },
    {
      top: "top-[238px]",
      width: "w-[248px]",
      rotate: "-rotate-[5deg]",
      z: "z-10",
      scale: "",
    },
  ] as const;

  return (
    <div className="relative mx-auto h-[400px] w-full max-w-[340px]">
      {HERO_FLOATING_CARDS.map((card, idx) => {
        const cfg = configs[idx]!;
        const locShort = card.location.split(",")[0]?.trim() || card.location;
        return (
          <Link
            key={card.id}
            href="/agents"
            className={cn(
              "absolute left-1/2 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/95 bg-white shadow-[0_18px_40px_-12px_rgba(44,44,44,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-10px_rgba(44,44,44,0.4)]",
              cfg.top,
              cfg.width,
              cfg.rotate,
              cfg.z,
              cfg.scale,
            )}
          >
            <div className="relative aspect-video w-full">
              <Image
                src={card.image_url}
                alt=""
                width={600}
                height={400}
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 292px"
                priority={idx === 0}
                loading={idx === 0 ? "eager" : "lazy"}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[#D4A843] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2C2C2C] shadow-sm">
                Verified
              </span>
            </div>
            <div className="flex items-center gap-2 border-t border-[#2C2C2C]/8 bg-[#FAF8F4] px-3 py-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
              <span className="line-clamp-2 text-left text-xs font-bold leading-snug text-[#2C2C2C]">
                {locShort}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

type FiltersState = {
  minPrice: number;
  maxPrice: number;
  beds: "any" | 1 | 2 | 3 | 4;
  baths: "any" | 1 | 2 | 3;
  propertyType: "any" | "House" | "Condo" | "Villa" | "Land" | "Studio" | "Presale";
};

function inferredType(p: DbProperty): FiltersState["propertyType"] {
  if (p.is_presale) return "Presale";
  const loc = `${p.name ?? ""} ${p.location}`.toLowerCase();
  if (p.beds === 0) return "Studio";
  if (loc.includes("penthouse") || loc.includes("condo") || loc.includes("loft") || loc.includes("studio")) return "Condo";
  if (loc.includes("villa") || loc.includes("estate")) return "Villa";
  if (loc.includes("land")) return "Land";
  return "House";
}

export type { PropertyEngagement } from "@/hooks/use-property-engagement";

const WELCOME_BANNER_DISMISSED_KEY = "welcome_banner_dismissed";

const HOMEPAGE_FAQ_ITEMS = [
  {
    question: "How is the BahayGo agent score calculated?",
    answer:
      "Agent scores are calculated out of 10.0 based on four factors: verified closings (50%), response time to leads (20%), profile completeness (15%), and PRC license verification (15%). Scores update automatically as agents close more deals and improve their response time.",
  },
  {
    question: "How are agents verified on BahayGo?",
    answer:
      "Every agent on BahayGo must submit their PRC (Professional Regulation Commission) license number, a photo of their license ID, and a selfie for identity matching. Our team manually reviews each submission within 24 hours. Only approved agents receive the Verified Agent badge and can post listings.",
  },
  {
    question: "Is BahayGo free for buyers and renters?",
    answer:
      "Yes. BahayGo is completely free for clients looking to buy, rent, or inquire about properties. You can search listings, contact verified agents, save properties to your wishlist, and request viewings at no cost. Agents and brokers pay for listing plans.",
  },
  {
    question: "How does BahayGo prevent scams?",
    answer:
      "BahayGo only allows PRC-licensed and manually verified agents to post listings. All listings are tied to a verified agent account. Clients can report suspicious listings directly from the property page. Our admin team reviews all reports and can suspend agents immediately. We maintain a zero-scam policy.",
  },
  {
    question: "Legal Disclosure",
    answer:
      "BahayGo is a real estate technology platform and is not a licensed real estate broker, agent, or brokerage. We do not represent buyers, sellers, landlords, or tenants in any transaction. All property listings are posted by independent licensed real estate professionals who are solely responsible for the accuracy of their listings. BahayGo does not guarantee the availability, accuracy, or legality of any listing. Users are advised to conduct their own due diligence before entering into any real estate transaction. For any legal concerns, please contact support@bahaygo.com.",
  },
] as const;

function HomepageFaqSection({
  openFaqIndex,
  setOpenFaqIndex,
}: {
  openFaqIndex: number | null;
  setOpenFaqIndex: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  return (
    <section className="mx-auto mt-12 max-w-3xl px-4 pb-16" aria-labelledby="homepage-faq-heading">
      <h2 id="homepage-faq-heading" className="text-center font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
        Frequently Asked Questions
      </h2>
      <p className="mt-2 text-center text-sm text-[#2C2C2C]/70">Everything you need to know about BahayGo</p>
      <div className="mt-8">
        {HOMEPAGE_FAQ_ITEMS.map((item, index) => {
          const isOpen = openFaqIndex === index;
          return (
            <div key={item.question} className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-medium text-[#2C2C2C]"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-[#2C2C2C] transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="pb-4 text-sm leading-relaxed text-gray-500">{item.answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const DynamicHomepageFaq = dynamic(() => Promise.resolve({ default: HomepageFaqSection }), {
  ssr: false,
  loading: () => null,
});

function HomepageTopVerifiedAgentsSection({
  topAgents,
  topAgentsRef,
  scrollRow,
  agentHomeExtrasById,
}: {
  topAgents: MarketplaceAgent[];
  topAgentsRef: React.RefObject<HTMLDivElement | null>;
  scrollRow: (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => void;
  agentHomeExtrasById: Record<string, AgentHomeExtra>;
}) {
  return (
    <section className="mt-12">
      <div>
        <h2 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Top Verified Agents This Week</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">High scores, fast responses, proven closings</p>
      </div>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-4">
        <div className="flex min-w-0 flex-1 items-stretch gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => scrollRow(topAgentsRef, "prev")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div
            ref={topAgentsRef}
            className="min-w-0 flex-1 overflow-x-auto px-4 pb-2 scrollbar-hide"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex w-max flex-nowrap gap-4 md:gap-4">
              {topAgents.map((a) => (
                <HomeTopAgentCard key={a.id} agent={a} extra={agentHomeExtrasById[a.id]} />
              ))}
              {topAgents.length < 4 ? <MoreAgentsComingSoonCard /> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollRow(topAgentsRef, "next")}
            className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="hidden w-full max-w-[320px] shrink-0 lg:block">
          <AgentScoreTutorialCard />
        </div>
      </div>
      <div className="mt-4 lg:hidden">
        <AgentScoreTutorialCard compact />
      </div>
    </section>
  );
}

const DynamicHomepageTopAgents = dynamic(
  () => Promise.resolve({ default: HomepageTopVerifiedAgentsSection }),
  { ssr: false, loading: () => null },
);

export function BahayGoHomeMarketplace({ listingMode }: { listingMode: "buy" | "rent" }) {
  const router = useRouter();
  const { user } = useAuth();
  const [welcomeBannerVisible, setWelcomeBannerVisible] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [viewerVerifiedListingAgent, setViewerVerifiedListingAgent] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setViewerVerifiedListingAgent(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from("agents")
      .select("status, verification_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { status?: string | null; verification_status?: string | null } | null;
        setViewerVerifiedListingAgent(
          Boolean(row?.status === "approved" && row?.verification_status === "verified"),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(WELCOME_BANNER_DISMISSED_KEY) === "true") return;
    } catch {
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("welcome") !== "true" || !user) return;
    setWelcomeBannerVisible(true);
    router.replace("/");
  }, [user, router]);

  const mode = listingMode;
  const [search, setSearch] = useState("");
  const [listingViewMode, setListingViewMode] = useState<"browse" | "results">("browse");

  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [agentHomeExtrasById, setAgentHomeExtrasById] = useState<Record<string, AgentHomeExtra>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string | null>(null);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [filters, setFilters] = useState<FiltersState>({
    minPrice: 0,
    maxPrice: 350_000_000,
    beds: "any",
    baths: "any",
    propertyType: "any",
  });
  const [cardRoomIdx, setCardRoomIdx] = useState<Record<string, number>>({});
  const [zoomProperty, setZoomProperty] = useState<DbProperty | null>(null);

  const { engagement } = usePropertyEngagementForProperties(properties);

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const topAgentsRef = useRef<HTMLDivElement | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchErr } = await supabase
      .from("properties")
      .select(
        `
          id, created_at, name, location, price, sqft, beds, baths, image_url, status, listed_by, description, property_type,
          is_presale, developer_name, turnover_date, unit_types,
          property_photos (url, sort_order),
          property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at, brokers (id, company_name, logo_url), profiles(email, phone)))
        `,
      )
      .or(publicListingExpiryOrFilter())
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
      setProperties([]);
    } else {
      setProperties((data ?? []) as unknown as DbProperty[]);
    }
    setLoading(false);
  }, []);

  const loadAgentsDirectory = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from("agents")
      .select("*, brokers(*), profiles!inner(email, phone, role)")
      .eq("status", "approved")
      .eq("verified", true)
      .eq("profiles.role", "agent")
      .neq("name", "Ron Admin");
    if (!fetchErr) {
      const filtered = (data ?? []).filter(shouldIncludeAgentDirectoryRow);
      const extras: Record<string, AgentHomeExtra> = {};
      for (const row of filtered) {
        const r = row as {
          id?: string | null;
          years_experience?: number | string | null;
          languages_spoken?: string | null;
          service_areas?: string | null;
        };
        const id = String(r.id ?? "");
        if (!id) continue;
        const rawY = r.years_experience;
        const yearsN =
          typeof rawY === "number"
            ? rawY
            : rawY != null && String(rawY).trim() !== ""
              ? Number(rawY)
              : NaN;
        const yearsExperience = Number.isFinite(yearsN) && yearsN >= 0 ? yearsN : null;
        extras[id] = {
          yearsExperience,
          languagesSpoken:
            typeof r.languages_spoken === "string" && r.languages_spoken.trim() ? r.languages_spoken.trim() : null,
          serviceAreaPills: parseServiceAreasForPills(r.service_areas).slice(0, 2),
        };
      }
      setAgentHomeExtrasById(extras);
      setAgents(
        filtered
          .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]))
          .filter((a) => !isExcludedFromPublicAgentDirectory(a)),
      );
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    void loadAgentsDirectory();
  }, [loadAgentsDirectory]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadProperties();
        void loadAgentsDirectory();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadProperties, loadAgentsDirectory]);

  const directoryAgentIds = useMemo(() => agents.map((a) => a.id), [agents]);
  const mergeLiveAvailability = useAgentLiveAvailabilityFromPropertyRows(properties, directoryAgentIds);

  const allConnectedAgentsByPropertyId = useMemo(() => {
    const m = new Map<string, MarketplaceAgent[]>();
    for (const p of properties) {
      const nested = (p.property_agents ?? [])
        .map((x) => (x as { agent?: unknown }).agent)
        .filter(Boolean)
        .map((row) => mapRowToMarketplaceAgent(row as Parameters<typeof mapRowToMarketplaceAgent>[0]))
        .map(mergeLiveAvailability);
      const dedup = new Map(nested.map((a) => [a.id, a]));
      m.set(p.id, [...dedup.values()]);
    }
    return m;
  }, [properties, mergeLiveAvailability]);

  const baseModeProperties = useMemo(() => {
    const base = properties.filter((p) => (mode === "buy" ? p.status === "for_sale" : p.status === "for_rent"));
    const q = search.trim().toLowerCase();
    const searched = q
      ? base.filter((p) => `${p.location} ${p.name ?? ""}`.toLowerCase().includes(q))
      : base;
    if (!neighborhoodFilter) return searched;
    const city = FEATURED_CITIES.find((c) => c.key === neighborhoodFilter);
    if (city) return searched.filter((p) => city.match(p.location));
    return searched.filter((p) => neighborhoodKey(p.location) === neighborhoodFilter);
  }, [properties, mode, search, neighborhoodFilter]);

  const cityListingCounts = useMemo(() => {
    const base = properties.filter((p) => (mode === "buy" ? p.status === "for_sale" : p.status === "for_rent"));
    const m = new Map<string, number>();
    for (const c of FEATURED_CITIES) {
      m.set(c.key, base.filter((p) => c.match(p.location)).length);
    }
    return m;
  }, [properties, mode]);

  const filteredAllRows = useMemo(() => {
    return baseModeProperties.filter((p) => {
      const price = parsePesoToNumber(p.price);
      if (price < filters.minPrice || price > filters.maxPrice) return false;
      if (filters.beds !== "any") {
        if (filters.beds === 4) {
          if (p.beds < 4) return false;
        } else if (p.beds !== filters.beds) return false;
      }
      if (filters.baths !== "any") {
        if (filters.baths === 3) {
          if (p.baths < 3) return false;
        } else if (p.baths !== filters.baths) return false;
      }
      if (filters.propertyType !== "any") {
        if (filters.propertyType === "Presale") {
          if (!p.is_presale) return false;
        } else if (inferredType(p) !== filters.propertyType) return false;
      }
      return true;
    });
  }, [baseModeProperties, filters]);

  const sortedAllRows = useMemo(() => {
    const list = [...filteredAllRows];
    list.sort((a, b) => {
      if (sortMode === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortMode === "most_beds") return (b.beds ?? 0) - (a.beds ?? 0);
      const pa = parsePesoToNumber(a.price);
      const pb = parsePesoToNumber(b.price);
      if (sortMode === "price_low") return pa - pb;
      if (sortMode === "price_high") return pb - pa;
      return 0;
    });
    return list;
  }, [filteredAllRows, sortMode]);

  const propertyTrustScoreById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of properties) {
      const agents = allConnectedAgentsByPropertyId.get(p.id) ?? [];
      const avg = agents.length ? agents.reduce((s, a) => s + (a.score ?? 0), 0) / agents.length : 0;
      m.set(p.id, avg);
    }
    return m;
  }, [properties, allConnectedAgentsByPropertyId]);

  const featuredPicks = useMemo(() => {
    const list = [...sortedAllRows];
    list.sort((a, b) => (propertyTrustScoreById.get(b.id) ?? 0) - (propertyTrustScoreById.get(a.id) ?? 0));
    return list.slice(0, 12);
  }, [sortedAllRows, propertyTrustScoreById]);

  const presaleDevelopments = useMemo(
    () => sortedAllRows.filter((p) => p.is_presale),
    [sortedAllRows],
  );

  /** Non-presale for-sale listings (maps to listing_type sale / status for_sale). */
  const forSaleListings = useMemo(
    () =>
      [...sortedAllRows]
        .filter((p) => !p.is_presale)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sortedAllRows],
  );

  const newlyListedRentals = useMemo(() => {
    const list = [...sortedAllRows];
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [sortedAllRows]);

  const bgcListings = useMemo(() => {
    return sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("bgc") || l.includes("taguig");
    });
  }, [sortedAllRows]);

  const makatiListings = useMemo(() => {
    return sortedAllRows.filter((p) => p.location.toLowerCase().includes("makati"));
  }, [sortedAllRows]);

  const luxury50m = useMemo(() => sortedAllRows.filter((p) => parsePesoToNumber(p.price) > 50_000_000), [sortedAllRows]);

  const nearSchoolsParks = useMemo(() => {
    const list = sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("forbes") || l.includes("quezon") || l.includes("san juan") || l.includes("makati");
    });
    return list;
  }, [sortedAllRows]);

  const pickMockSubset = (seed: string) => {
    return sortedAllRows.filter((p) => {
      let h = 0;
      const s = `${seed}-${p.id}`;
      for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 101;
      return h % 3 === 0;
    });
  };

  const petFriendly = useMemo(() => pickMockSubset("pet"), [sortedAllRows]);
  const gated = useMemo(() => pickMockSubset("gated"), [sortedAllRows]);
  const openHouse = useMemo(() => pickMockSubset("openhouse"), [sortedAllRows]);
  const deals = useMemo(() => pickMockSubset("deals"), [sortedAllRows]);

  const rentPetFriendly = useMemo(() => pickMockSubset("rent-pet"), [sortedAllRows]);
  const furnished = useMemo(() => pickMockSubset("furnished"), [sortedAllRows]);
  const nearBD = useMemo(() => {
    return sortedAllRows.filter((p) => {
      const l = p.location.toLowerCase();
      return l.includes("bgc") || l.includes("makati") || l.includes("ortigas");
    });
  }, [sortedAllRows]);
  const studiosCondos = useMemo(() => sortedAllRows.filter((p) => p.beds <= 1), [sortedAllRows]);
  const shortTerm = useMemo(() => pickMockSubset("shortterm"), [sortedAllRows]);
  const familyRent = useMemo(() => sortedAllRows.filter((p) => p.beds >= 3), [sortedAllRows]);

  const topAgents = useMemo(
    () =>
      [...agents]
        .map(mergeLiveAvailability)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
    [agents, mergeLiveAvailability],
  );

  const cityFilterMeta = useMemo(
    () =>
      neighborhoodFilter ? FEATURED_CITIES.find((c) => c.key === neighborhoodFilter) ?? null : null,
    [neighborhoodFilter],
  );

  const agentsForCityFilter = useMemo(() => {
    if (!cityFilterMeta) return [];
    return agents
      .map(mergeLiveAvailability)
      .filter((a) => {
        const t = a.serviceAreasText?.trim();
        if (!t) return false;
        return cityFilterMeta.match(t);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [agents, cityFilterMeta, mergeLiveAvailability]);
  const featured = useMemo(() => properties[0] ?? null, [properties]);
  const featuredPhotos = useMemo(() => {
    const list = (featured?.property_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
    return list.length ? list.map((x) => x.url) : featured?.image_url ? [featured.image_url] : [];
  }, [featured]);

  const scrollRow = (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => {
    const el = ref.current;
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.75));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const hasActiveSearchOrFilters = useMemo(() => {
    if (search.trim().length > 0 || neighborhoodFilter !== null) return true;
    if (filters.minPrice !== 0 || filters.maxPrice !== 350_000_000) return true;
    if (filters.beds !== "any" || filters.baths !== "any" || filters.propertyType !== "any") return true;
    if (sortMode !== "newest") return true;
    return false;
  }, [search, neighborhoodFilter, filters, sortMode]);

  const clearFiltersAndBrowse = () => {
    setListingViewMode("browse");
    setSearch("");
    setNeighborhoodFilter(null);
    setFilters({
      minPrice: 0,
      maxPrice: 350_000_000,
      beds: "any",
      baths: "any",
      propertyType: "any",
    });
    setSortMode("newest");
  };

  const onSearchSubmit = () => {
    if (hasActiveSearchOrFilters) {
      setListingViewMode("results");
      return;
    }
    const el = rowRefs.current[mode === "buy" ? "buy-featured" : "rent-featured"];
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: -step, behavior: "smooth" });
  };

  const selectCityFilter = (key: string) => {
    setNeighborhoodFilter((v) => (v === key ? null : key));
    setListingViewMode("results");
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const heroSearchCard = (
    <>
      <div className="flex justify-center lg:justify-start">
        <div className="inline-flex gap-2 rounded-full bg-[#EBE6DC]/90 p-1 ring-1 ring-[#D4A843]/35 backdrop-blur-sm">
          {mode === "rent" ? (
            <>
              <Link
                href="/buy"
                className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-neutral-50"
              >
                Buy
              </Link>
              <span className="rounded-full bg-gradient-to-b from-[#8faf91] to-[#6B9E6E] px-5 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[#D4A843]/50">
                Rent
              </span>
            </>
          ) : (
            <>
              <span className="rounded-full bg-gradient-to-b from-[#8faf91] to-[#6B9E6E] px-5 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[#D4A843]/50">
                Buy
              </span>
              <Link
                href="/"
                className="rounded-full px-5 py-2 text-xs font-semibold text-[#2C2C2C]/80 ring-1 ring-black/10 transition hover:bg-neutral-50"
              >
                Rent
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <div className="relative z-20 flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <PhLocationInput
            value={search}
            onChange={setSearch}
            placeholder="Search by location or neighborhood"
            aria-label="Search listings by location"
            className="w-full min-w-0 flex-1"
            inputClassName="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#2C2C2C] placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
          />
          <button
            type="button"
            onClick={onSearchSubmit}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#D4A843] px-6 py-3 text-sm font-bold text-[#2C2C2C] shadow-md transition hover:bg-[#c49a38] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 sm:w-auto"
          >
            <Search className="h-4 w-4" aria-hidden />
            Search
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#2C2C2C]/80 lg:justify-start">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[#6B9E6E]">✓</span> PRC Licensed Agents Only
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[#6B9E6E]">✓</span> 0 Scams Guarantee
        </span>
      </div>
      <p className="mt-3 text-center text-[11px] font-semibold tracking-wide text-[#2C2C2C]/45 lg:text-left">
        1,200+ Listings · 847 Verified Agents · 0 Scams
      </p>
    </>
  );

  const dismissWelcomeBanner = () => {
    try {
      localStorage.setItem(WELCOME_BANNER_DISMISSED_KEY, "true");
    } catch {
      /* ignore */
    }
    setWelcomeBannerVisible(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />

      {welcomeBannerVisible && user ? (
        <div
          className="flex items-center justify-between border-b border-[#6B9E6E]/20 bg-[#6B9E6E]/10 px-4 py-3"
          role="region"
          aria-label="Welcome"
        >
          <p className="pr-4 text-sm text-[#2C2C2C]">
            👋 Welcome to BahayGo! Complete your profile to get the most out of the platform.
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/settings"
              className="text-sm font-medium text-[#6B9E6E] hover:underline"
            >
              Complete Profile →
            </Link>
            <button
              type="button"
              onClick={dismissWelcomeBanner}
              className="rounded-lg p-1 text-[#2C2C2C]/55 hover:bg-[#6B9E6E]/20 hover:text-[#2C2C2C]"
              aria-label="Dismiss welcome message"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <section className="relative border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10 lg:py-14">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="min-w-0">
              <div className="text-center lg:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6B9E6E]">
                  Verified Agents · Real Listings · 100% Filipino
                </p>
                <h1 className="mt-4 font-serif text-2xl font-bold leading-tight tracking-tight text-[#2C2C2C] sm:text-3xl">
                  FIND YOUR HOME IN THE PHILIPPINES
                </h1>
                <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/65">
                  Verified Agents, Real Listings, 100% Filipino
                </p>
              </div>

              <div className="hidden lg:block">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6B9E6E]">
                  Verified Agents · Real Listings · 100% Filipino
                </p>
                <h1 className="mt-4 font-serif text-5xl font-bold leading-[1.08] tracking-tight text-[#2C2C2C]">
                  Find Your Home in the Philippines
                </h1>
                <p className="mt-4 text-lg font-medium text-[#2C2C2C]/70">
                  Browse verified listings across Metro Manila, Cebu, and beyond
                </p>
              </div>

              <div className="mt-6 lg:mt-8">{heroSearchCard}</div>

            </div>

            <div className="relative hidden min-h-[440px] lg:block">
              <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-br from-[#FAF8F4] via-[#FFF9F0] to-[#F5EFE4]" />
              <div className="pointer-events-none absolute left-[12%] top-[22%] h-4 w-4 rotate-45 bg-[#D4A843]/25" />
              <div className="pointer-events-none absolute right-[18%] top-[38%] h-3 w-3 rotate-45 bg-[#D4A843]/35" />
              <div className="pointer-events-none absolute bottom-[28%] left-[20%] h-2.5 w-2.5 rotate-45 bg-[#6B9E6E]/25" />

              <div className="relative mx-auto flex h-[440px] w-full max-w-[380px] items-center justify-center">
                <HeroFloatingPropertyCards />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="featured-locations"
        className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4] py-8 sm:py-10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 text-center sm:text-left">
              <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">
                Featured Locations
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                Tap a city to filter listings
              </p>
            </div>
            {neighborhoodFilter ? (
              <button
                type="button"
                onClick={() => setNeighborhoodFilter(null)}
                className="shrink-0 self-center text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C] sm:self-auto"
              >
                Clear filter
              </button>
            ) : null}
          </div>
          <div className="mt-6 overflow-x-auto px-4 scrollbar-hide lg:px-0">
            <div className="flex w-max gap-3 pb-2 sm:gap-4 lg:mx-auto lg:max-w-full lg:justify-center">
              {FEATURED_CITIES.map((c) => {
                const count = cityListingCounts.get(c.key) ?? 0;
                const active = neighborhoodFilter === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => selectCityFilter(c.key)}
                    className={`group relative flex w-[130px] shrink-0 flex-col overflow-hidden rounded-2xl border text-left shadow-md transition hover:scale-[1.02] lg:w-[160px] ${
                      active
                        ? "border-[#D4A843] ring-2 ring-[#D4A843]/45"
                        : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/40"
                    }`}
                  >
                    <div className="relative h-[110px] w-full shrink-0 overflow-hidden lg:h-[130px]">
                      <Image
                        src={c.imageUrl}
                        alt=""
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(min-width: 1024px) 160px, 130px"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/95 via-[#2C2C2C]/35 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-2.5">
                        <p className="text-xs font-bold text-white drop-shadow-sm lg:font-serif lg:text-base lg:font-bold lg:drop-shadow-sm">
                          {c.label}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold text-white/90 lg:text-[11px]">
                          {count} {count === 1 ? "listing" : "listings"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <hr className="mx-auto w-3/4 border-t border-[#2C2C2C]/10" />

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-5 md:pb-16">
        {/* Loading / error */}
        {loading ? (
          <div className="mt-8 grid min-h-[400px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`listing-skeleton-${i}`}
                className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md"
              >
                <div className="relative h-44 w-full animate-pulse bg-neutral-200/90 lg:h-52" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200/90" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200/90" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!loading && error ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load listings</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {/* PROPERTY LISTING SECTION (controlled by Buy/Rent toggle) */}
            <section id="listings" className="min-h-[400px]">
              {!neighborhoodFilter ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {activeFilterChips(filters, sortMode, {
                      clearPrice: () => setFilters((s) => ({ ...s, minPrice: 0, maxPrice: 350_000_000 })),
                      clearBeds: () => setFilters((s) => ({ ...s, beds: "any" })),
                      clearBaths: () => setFilters((s) => ({ ...s, baths: "any" })),
                      clearType: () => setFilters((s) => ({ ...s, propertyType: "any" })),
                      clearSort: () => setSortMode("newest"),
                    }).map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onRemove}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
                      >
                        {chip.label}
                        <span className="text-[#2C2C2C]/35">×</span>
                      </button>
                    ))}
                    {countActiveFilters(filters, sortMode) > 0 ? (
                      <button
                        type="button"
                        onClick={() => clearFiltersAndBrowse()}
                        className="text-xs font-semibold text-[#2C2C2C]/60 hover:text-[#2C2C2C]"
                      >
                        Clear All
                      </button>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFiltersOpen((v) => !v)}
                      className="relative inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50"
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                      {countActiveFilters(filters, sortMode) > 0 ? (
                        <span className="ml-1 rounded-full bg-[#D4A843]/18 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                          {countActiveFilters(filters, sortMode)}
                        </span>
                      ) : null}
                    </button>

                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50 focus-visible:outline-none"
                      aria-label="Sort"
                    >
                      <option value="newest">Newest</option>
                      <option value="price_low">Price Low-High</option>
                      <option value="price_high">Price High-Low</option>
                      <option value="most_beds">Most Beds</option>
                    </select>
                  </div>
                </div>
              ) : null}

              <AnimatePresence initial={false}>
                {(filtersOpen || neighborhoodFilter !== null) ? (
                  <motion.div
                    key="filters"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm"
                  >
                    {neighborhoodFilter ? (
                      <div className="mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-[#2C2C2C]/10 pb-3">
                        <label htmlFor="listings-sort-city" className="sr-only">
                          Sort listings
                        </label>
                        <select
                          id="listings-sort-city"
                          value={sortMode}
                          onChange={(e) => setSortMode(e.target.value as SortMode)}
                          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50 focus-visible:outline-none"
                          aria-label="Sort"
                        >
                          <option value="newest">Newest</option>
                          <option value="price_low">Price Low-High</option>
                          <option value="price_high">Price High-Low</option>
                          <option value="most_beds">Most Beds</option>
                        </select>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Price range</p>
                        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#2C2C2C]/60">
                          <span>{formatPeso(filters.minPrice)}</span>
                          <span>{formatPeso(filters.maxPrice)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          <input
                            type="range"
                            min={0}
                            max={350_000_000}
                            step={1_000_000}
                            value={filters.minPrice}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setFilters((s) => ({ ...s, minPrice: Math.min(v, s.maxPrice) }));
                            }}
                          />
                          <input
                            type="range"
                            min={0}
                            max={350_000_000}
                            step={1_000_000}
                            value={filters.maxPrice}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setFilters((s) => ({ ...s, maxPrice: Math.max(v, s.minPrice) }));
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Beds</p>
                          <select
                            value={String(filters.beds)}
                            onChange={(e) => setFilters((s) => ({ ...s, beds: (e.target.value === "any" ? "any" : Number(e.target.value)) as FiltersState["beds"] }))}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                          >
                            <option value="any">Any</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4+</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Baths</p>
                          <select
                            value={String(filters.baths)}
                            onChange={(e) => setFilters((s) => ({ ...s, baths: (e.target.value === "any" ? "any" : Number(e.target.value)) as FiltersState["baths"] }))}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                          >
                            <option value="any">Any</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3+</option>
                          </select>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2C2C2C]/35">Type</p>
                          <select
                            value={filters.propertyType}
                            onChange={(e) => setFilters((s) => ({ ...s, propertyType: e.target.value as FiltersState["propertyType"] }))}
                            className="mt-2 w-full rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80"
                          >
                            <option value="any">Any</option>
                            <option value="House">House</option>
                            <option value="Condo">Condo</option>
                            <option value="Villa">Villa</option>
                            <option value="Land">Land</option>
                            <option value="Studio">Studio</option>
                            <option value="Presale">Presale</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[#2C2C2C]/10 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasActiveSearchOrFilters) {
                            setListingViewMode("results");
                            setFiltersOpen(false);
                          }
                        }}
                        disabled={!hasActiveSearchOrFilters}
                        className="rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6C8C70] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Apply
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence mode="wait" initial={false}>
                {listingViewMode === "results" ? (
                  <motion.div
                    key="listing-results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-serif text-lg font-bold text-[#2C2C2C]">
                        {sortedAllRows.length} {sortedAllRows.length === 1 ? "property" : "properties"} match your search
                      </p>
                      <button
                        type="button"
                        onClick={() => clearFiltersAndBrowse()}
                        className="shrink-0 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-neutral-50"
                      >
                        Clear Filters
                      </button>
                    </div>
                    {sortedAllRows.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="mt-12 flex flex-col items-center justify-center px-4 text-center"
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/30">
                          <Search className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
                        </div>
                        <p className="mt-6 font-serif text-xl font-bold text-[#2C2C2C]">No properties found in this area yet.</p>
                        <p className="mt-2 max-w-md text-sm font-semibold text-[#2C2C2C]/55">
                          Try adjusting your filters or exploring a different neighborhood.
                        </p>
                        <button
                          type="button"
                          onClick={() => clearFiltersAndBrowse()}
                          className="mt-6 rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#6C8C70]"
                        >
                          Clear Filters
                        </button>
                      </motion.div>
                    ) : (
                      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {sortedAllRows.map((p) => (
                          <NewlyListedCard
                            key={`result-${p.id}`}
                            property={p}
                            roomUrls={roomUrlsFor(p)}
                            roomIdx={cardRoomIdx[p.id] ?? 0}
                            onRoomPrev={() =>
                              setCardRoomIdx((s) => ({
                                ...s,
                                [p.id]:
                                  (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                                  Math.max(1, roomUrlsFor(p).length),
                              }))
                            }
                            onRoomNext={() =>
                              setCardRoomIdx((s) => ({
                                ...s,
                                [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                              }))
                            }
                            engagement={engagement}
                            connectedAgents={allConnectedAgentsByPropertyId.get(p.id) ?? []}
                            onOpenPropertyZoom={() => setZoomProperty(p)}
                            grid
                            viewerUserId={user?.id ?? null}
                            verifiedListingAgent={viewerVerifiedListingAgent}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key={`browse-${mode}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className="mt-8"
                  >
                    {mode === "buy" ? (
                      <PropertyRows
                        rows={[
                          { key: "buy-featured", title: "Featured Picks", subtitle: "Recommended for you", items: featuredPicks, featured: true },
                          {
                            key: "buy-presale",
                            title: "🏗️ Presale Developments",
                            subtitle: "New projects & pre-selling inventory",
                            items: presaleDevelopments,
                          },
                          {
                            key: "buy-for-sale",
                            title: "For Sale",
                            subtitle: "Sale listings (non-presale), newest first",
                            items: forSaleListings,
                          },
                          {
                            key: "buy-bgc",
                            title: "BGC listings",
                            subtitle: "BGC & Taguig",
                            items: bgcListings,
                          },
                          {
                            key: "buy-makati",
                            title: "Makati listings",
                            subtitle: "Makati City & CBD",
                            items: makatiListings,
                          },
                          { key: "buy-lux", title: "Luxury Homes ₱50M+", subtitle: "Premium listings above ₱50M", items: luxury50m },
                          { key: "buy-schools", title: "Near Schools & Parks", subtitle: "Nearby family-friendly areas", items: nearSchoolsParks },
                          { key: "buy-pet", title: "Pet Friendly", subtitle: "Mock badge selection", items: petFriendly },
                          { key: "buy-gated", title: "Gated Communities", subtitle: "Mock badge selection", items: gated },
                          { key: "buy-open", title: "Open House This Weekend", subtitle: "Mock badge selection", items: openHouse },
                          { key: "buy-deals", title: "Foreclosures & Deals", subtitle: "Mock badge selection", items: deals },
                        ]}
                        showMore={showMoreCategories}
                        onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        engagement={engagement}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                        listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                      />
                    ) : (
                      <PropertyRows
                        rows={[
                          { key: "rent-featured", title: "Featured Picks", subtitle: "Recommended for you", items: featuredPicks, featured: true },
                          {
                            key: "rent-new",
                            title: "Newly Listed Rentals",
                            subtitle: "Newest rentals first",
                            items: newlyListedRentals,
                          },
                          {
                            key: "rent-bgc",
                            title: "BGC listings",
                            subtitle: "BGC & Taguig",
                            items: bgcListings,
                          },
                          {
                            key: "rent-makati",
                            title: "Makati listings",
                            subtitle: "Makati City & CBD",
                            items: makatiListings,
                          },
                          { key: "rent-pet", title: "Pet Friendly Rentals", subtitle: "Mock badge selection", items: rentPetFriendly },
                          { key: "rent-furnished", title: "Furnished & Move-in Ready", subtitle: "Mock badge selection", items: furnished },
                          { key: "rent-bd", title: "Near Business Districts", subtitle: "BGC · Makati · Ortigas", items: nearBD },
                          { key: "rent-studio", title: "Studio & Condos", subtitle: "Beds ≤ 1", items: studiosCondos },
                          { key: "rent-short", title: "Short Term Available", subtitle: "Mock badge selection", items: shortTerm },
                          { key: "rent-family", title: "Family Homes for Rent", subtitle: "Beds ≥ 3", items: familyRent },
                        ]}
                        showMore={showMoreCategories}
                        onToggleShowMore={() => setShowMoreCategories((v) => !v)}
                        rowRefs={rowRefs}
                        cardRoomIdx={cardRoomIdx}
                        setCardRoomIdx={setCardRoomIdx}
                        engagement={engagement}
                        connectedAgentsByPropertyId={allConnectedAgentsByPropertyId}
                        viewerUserId={user?.id ?? null}
                        onOpenPropertyZoom={setZoomProperty}
                        viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                        listingsOnboardingHref={user ? "/register/agent" : "/auth/signup"}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {neighborhoodFilter && cityFilterMeta ? (
                <div className="mt-12 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                  <h2 className="font-serif text-xl font-bold tracking-tight text-[#2C2C2C] sm:text-2xl">
                    Top Agents in {cityFilterMeta.label}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
                    Verified agents who serve this area
                  </p>
                  {agentsForCityFilter.length === 0 ? (
                    <p className="mt-6 text-center text-sm font-semibold text-[#2C2C2C]/45">
                      No agents list this city in their service areas yet.
                    </p>
                  ) : (
                    <div className="mt-6 flex flex-wrap justify-center gap-4 md:justify-start">
                      {agentsForCityFilter.map((a) => (
                        <AgentDirectoryCard
                          key={`city-agent-${a.id}`}
                          agent={a}
                          className="w-full sm:w-[300px]"
                          scoreBesideName
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 6. TOP VERIFIED AGENTS THIS WEEK (deferred client load) */}
            <div className="min-h-[200px]">
              <DynamicHomepageTopAgents
                topAgents={topAgents}
                topAgentsRef={topAgentsRef}
                scrollRow={scrollRow}
                agentHomeExtrasById={agentHomeExtrasById}
              />
            </div>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 7. WHY FISHNET TRUST SECTION */}
            <section className="mt-12">
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <Trust
                    icon={<Shield className="h-5 w-5 text-[#6B9E6E]" />}
                    title="All Agents Verified"
                    body="Every agent on BahayGo has a verified PRC license"
                  />
                  <Trust
                    icon={<BadgeCheck className="h-5 w-5 text-[#6B9E6E]" />}
                    title="Licensed Brokers Only"
                    body="All brokerages are registered and monitored"
                  />
                  <Trust
                    icon={<Lock className="h-5 w-5 text-[#6B9E6E]" />}
                    title="Anti-Scam Protection"
                    body="Zero tolerance policy. Report and remove instantly"
                  />
                </div>
              </div>
            </section>

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />

            {/* 8. FEATURED PROPERTY */}
            {featured ? (
              <section className="mt-12">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
                    <div className="relative h-64 w-full bg-black/5 lg:h-auto lg:aspect-video">
                      <Image
                        src={featuredPhotos[0] ?? featured.image_url}
                        alt={featured.name ?? featured.location}
                        fill
                        quality={95}
                        className="object-cover"
                        sizes="(min-width: 1024px) 600px, 100vw"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/35 px-3 py-3 backdrop-blur-sm">
                        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:scrollbar-hide">
                          {featuredPhotos.slice(0, 4).map((u) => (
                            <div
                              key={u}
                              className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg border border-white/30"
                            >
                              <Image
                                src={u}
                                alt=""
                                fill
                                sizes="80px"
                                className="object-cover"
                                loading="lazy"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm max-lg:px-5 max-lg:py-7">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#D4A843]/18 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a6d32]">
                        Featured
                      </span>
                      {featured.is_presale ? (
                        <span className="rounded-full bg-[#D4A843]/25 px-3 py-1 text-[11px] font-bold text-[#8a6d32]">
                          Presale
                        </span>
                      ) : featured.status === "for_rent" ? (
                        <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/70">
                          For Rent
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/70">
                          For Sale
                        </span>
                      )}
                    </div>
                    <h2 className="mt-3 font-serif text-xl font-bold tracking-tight text-[#2C2C2C] lg:text-3xl">
                      {featured.name ?? featured.location}
                    </h2>
                    <p className="mt-2 font-serif text-lg font-bold text-[#2C2C2C] lg:text-2xl">
                      {formatPropertyPriceDisplay(featured.price, featured.status)}
                    </p>
                    <p className="mt-3 text-base font-semibold text-[#2C2C2C]/60 lg:text-sm">
                      {featured.beds ? `${featured.beds} beds` : "Studio"} · {featured.baths} baths · {featured.sqft} sqft
                    </p>
                    <p className="mt-4 text-base leading-relaxed text-[#2C2C2C]/60 lg:text-sm">
                      A vivid, high-contrast listing with verified agents underneath—built to feel like Zillow, but safer.
                    </p>
                    <Link
                      href={`/properties/${encodeURIComponent(featured.id)}`}
                      className="mt-4 inline-flex rounded-full bg-[#2C2C2C] px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-[#6B9E6E] lg:text-sm"
                    >
                      Learn More →
                    </Link>
                    <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
                      <ConnectedAgentsBox
                        title="Connected Agents"
                        agents={allConnectedAgentsByPropertyId.get(featured.id) ?? []}
                        defaultVisible={3}
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <hr className="mx-auto mt-12 w-3/4 border-t border-[#2C2C2C]/10" />
          </>
        ) : null}
      </main>

      <DynamicHomepageFaq openFaqIndex={openFaqIndex} setOpenFaqIndex={setOpenFaqIndex} />

      <AnimatePresence>
        {zoomProperty ? (
          <PropertyZoomModal
            property={zoomProperty}
            agents={allConnectedAgentsByPropertyId.get(zoomProperty.id) ?? []}
            onClose={() => setZoomProperty(null)}
            engagement={engagement}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CategorySection({
  title,
  subtitle,
  sectionRef,
  expanded,
  onToggleExpanded,
  items,
  cardRoomIdx,
  setCardRoomIdx,
  engagement,
  connectedAgentsByPropertyId,
  scrollRow,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
  listingOnboardingHref,
}: {
  title: string;
  subtitle: string;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  expanded: boolean;
  onToggleExpanded: () => void;
  items: DbProperty[];
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  engagement: PropertyEngagement;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  scrollRow: (ref: React.RefObject<HTMLDivElement | null>, dir: "prev" | "next") => void;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
  listingOnboardingHref: string;
}) {
  const visible = expanded ? items : items.slice(0, 12);
  const categoryCardWidthClass = "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]";

  return (
    <>
      <div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="-mx-4 mt-4 flex items-stretch gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pl-2"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={sectionRef}
          className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide"
        >
          <div className="flex w-max flex-nowrap gap-3">
            {visible.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <ListingsComingSoonPlaceholderCard
                    key={`${title}-empty-${i}`}
                    cardWidthClass={categoryCardWidthClass}
                    href={listingOnboardingHref}
                  />
                ))
              : visible.map((p) => (
                  <NewlyListedCard
                    key={`${title}-${p.id}`}
                    property={p}
                    roomUrls={roomUrlsFor(p)}
                    roomIdx={cardRoomIdx[p.id] ?? 0}
                    onRoomPrev={() =>
                      setCardRoomIdx((s) => ({
                        ...s,
                        [p.id]:
                          (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                          Math.max(1, roomUrlsFor(p).length),
                      }))
                    }
                    onRoomNext={() =>
                      setCardRoomIdx((s) => ({
                        ...s,
                        [p.id]:
                          ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                      }))
                    }
                    engagement={engagement}
                    connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                    onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                    grid
                    compact
                    verifiedListingAgent={viewerVerifiedListingAgent}
                  />
                ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scrollRow(sectionRef, "next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 pr-2 shadow-sm hover:bg-neutral-50 md:flex md:pr-2"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {items.length > 12 ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#2C2C2C]/70 ring-1 ring-black/10 hover:bg-neutral-50"
          >
            {expanded ? "Show less" : "Show more"}
            <ArrowDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function Trust({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-semibold text-[#2C2C2C]">{title}</p>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">{body}</p>
    </div>
  );
}

/** Brokerage line on homepage listing cards (uses `brokers` join on agent). */
function listingCardBrokerageSubtitle(agent: MarketplaceAgent): string {
  if (agent.brokerId) {
    const n = (agent.brokerName || agent.company).trim();
    if (n) return n;
  }
  return "Independent Agent";
}

export function NewlyListedCard({
  property,
  roomUrls,
  roomIdx,
  onRoomPrev,
  onRoomNext,
  engagement,
  connectedAgents,
  onOpenPropertyZoom,
  grid,
  gridCardClassName,
  cardWidthClass,
  viewerUserId,
  compact,
  verifiedListingAgent,
}: {
  property: DbProperty;
  roomUrls: string[];
  roomIdx: number;
  onRoomPrev: () => void;
  onRoomNext: () => void;
  engagement: PropertyEngagement;
  connectedAgents: MarketplaceAgent[];
  onOpenPropertyZoom: () => void;
  grid?: boolean;
  /** When `grid` is true: widths for horizontal category rows (mobile peek + desktop columns). */
  gridCardClassName?: string;
  cardWidthClass?: string;
  viewerUserId?: string | null;
  /** Smaller image + type for 5-across carousels */
  compact?: boolean;
  /** Logged-in viewer is approved + verified agent (homepage co-list CTA). */
  verifiedListingAgent?: boolean;
}) {
  const listedLabel = listingListedLabel(property.created_at);
  const statusLabel = property.is_presale ? "Presale" : property.status === "for_rent" ? "For Rent" : "For Sale";
  const img = roomUrls[roomIdx] ?? roomUrls[0] ?? property.image_url;

  const { profile } = useAuth();
  const router = useRouter();
  const agentEngagementLocked = profile?.role === "agent";

  const firstAgent = connectedAgents[0] ?? null;
  const moreAgentCount = Math.max(0, connectedAgents.length - 1);

  const showYourListingBadge =
    !!viewerUserId &&
    connectedAgents.some((a) => a.userId === viewerUserId);

  const showEng = engagement.showEngagementCounts(property.id);
  const isLiked = engagement.isLiked(property.id);
  const isPinned = engagement.isPinned(property.id);
  const showEngagementRow = showEng || agentEngagementLocked;

  const titleLine = property.name?.trim() || property.location;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md",
        grid
          ? gridCardClassName ?? "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]"
          : cn(cardWidthClass ?? "w-[240px]", "shrink-0"),
      )}
    >
      <div className="relative h-44 w-full overflow-hidden bg-neutral-900 lg:h-52">
        <Image
          src={img}
          alt={property.name ?? property.location}
          fill
          quality={92}
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          loading="lazy"
        />
        <button
          type="button"
          onClick={onOpenPropertyZoom}
          className="absolute inset-0 z-[6] cursor-pointer bg-transparent"
          aria-label="Open property details"
        />

        {roomUrls.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRoomPrev();
              }}
              className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100"
              aria-label="Previous room photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRoomNext();
              }}
              className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/90 p-1 opacity-60 shadow-sm ring-1 ring-black/5 hover:opacity-100"
              aria-label="Next room photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-gradient-to-t from-black/25 to-transparent" />

        <div className="absolute left-3 top-3 z-20">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-bold shadow-sm",
              property.is_presale ? "bg-[#D4A843] text-[#2C2C2C]" : "bg-[#6B9E6E] text-white",
            )}
          >
            {statusLabel}
          </span>
        </div>

        {showEngagementRow ? (
          <div
            className="absolute right-3 top-3 z-20 flex items-center gap-1"
            title={agentEngagementLocked ? "Only clients can like and pin properties" : undefined}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!agentEngagementLocked) void engagement.toggleLike(property.id);
              }}
              disabled={agentEngagementLocked}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                property.is_presale
                  ? cn("border bg-white", isLiked ? "border-red-200" : "border-gray-200")
                  : isLiked
                    ? "border border-red-200 bg-white"
                    : "border border-gray-200 bg-white/80",
                agentEngagementLocked && "pointer-events-none opacity-50",
              )}
              aria-label={`${engagement.likeCount(property.id)} likes`}
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isLiked ? "fill-red-500 text-red-500" : "fill-none text-red-400",
                )}
              />
              {showEng || agentEngagementLocked || property.is_presale ? (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isLiked ? "text-red-500" : "text-red-400",
                  )}
                >
                  {engagement.likeCount(property.id)}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!agentEngagementLocked) void engagement.togglePin(property.id);
              }}
              disabled={agentEngagementLocked}
              className={cn(
                "inline-flex flex-row items-center gap-1 rounded-full p-1.5 shadow-sm transition hover:bg-[#FAF8F4]",
                property.is_presale
                  ? cn("border bg-white", isPinned ? "border-[#D4A843]/40" : "border-gray-200")
                  : isPinned
                    ? "border border-[#D4A843]/40 bg-white"
                    : "border border-gray-200 bg-white/80",
                agentEngagementLocked && "pointer-events-none opacity-50",
              )}
              aria-label={`${engagement.saveCount(property.id)} saved`}
            >
              <Pin
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isPinned ? "fill-[#D4A843] text-[#D4A843]" : "fill-none text-[#D4A843]",
                )}
              />
              {showEng || agentEngagementLocked || property.is_presale ? (
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    isPinned ? "text-[#D4A843]" : "text-[#D4A843]",
                  )}
                >
                  {engagement.saveCount(property.id)}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-5rem)] flex-col items-start gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-[#2C2C2C] shadow-sm ring-1 ring-black/5">
            {listedLabel}
          </span>
          {showYourListingBadge ? (
            <Link
              href="/dashboard/agent"
              className="pointer-events-auto rounded-full bg-[#D4A843]/95 px-2 py-0.5 text-xs font-bold text-[#2C2C2C] shadow-sm ring-1 ring-[#8a6d32]/30 hover:bg-[#D4A843]"
              onClick={(e) => e.stopPropagation()}
            >
              This is your listing
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className={`flex flex-col gap-0 border-t border-[#2C2C2C]/10 bg-white ${compact ? "px-3 py-2.5" : "px-3 py-3 sm:px-4"}`}
      >
        <div className="h-[28px] shrink-0 overflow-hidden">
          <p
            className={`truncate font-serif font-bold tracking-tight text-[#D4A843] ${compact ? "text-base" : "text-lg sm:text-xl"}`}
          >
            {formatPropertyPriceDisplay(property.price, property.status)}
          </p>
        </div>
        <div className="h-[48px] shrink-0 overflow-hidden">
          <p
            className={`line-clamp-2 text-[#2C2C2C] ${compact ? "text-sm font-bold" : "text-base font-bold"}`}
          >
            {titleLine}
          </p>
        </div>
        <div className="h-[24px] shrink-0 overflow-hidden">
          <p className={`truncate text-[#6B6B6B] ${compact ? "text-[11px]" : "text-xs"}`}>
            {property.beds ? `${property.beds} beds` : "Studio"} · {property.baths} baths · {property.sqft} sqft
          </p>
        </div>
        <div className="h-[24px] shrink-0 overflow-hidden">
          <p
            className={`flex items-start gap-1 text-[#6B6B6B] ${compact ? "text-[11px]" : "text-xs"}`}
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8E8E8E]" aria-hidden />
            <span className="min-w-0 flex-1 truncate leading-snug">{property.location}</span>
          </p>
        </div>
        {property.is_presale && property.developer_name?.trim() ? (
          <p className={`mt-1 text-[#2C2C2C]/80 ${compact ? "text-[11px]" : "text-xs"}`}>
            {property.developer_name.trim()}
          </p>
        ) : null}
        {property.is_presale && property.turnover_date ? (
          <p className={`mt-0.5 text-[#2C2C2C]/50 ${compact ? "text-[10px]" : "text-[11px]"}`}>
            Turnover: {new Date(`${property.turnover_date}T12:00:00`).getFullYear()}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 flex min-h-[64px] max-h-[80px] shrink-0 flex-col justify-start overflow-hidden bg-white px-3 py-2">
        {connectedAgents.length === 0 ? (
          <div className="flex min-h-[40px] flex-1 items-center justify-center">
            <p className="text-center text-xs text-gray-400">No agent assigned</p>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-stretch justify-start gap-0">
            {firstAgent ? (
              <div className="shrink-0">
                <Link
                  href={`/agents/${encodeURIComponent(firstAgent.id)}`}
                  title={firstAgent.name}
                  onClick={(e) => e.stopPropagation()}
                  className="group flex min-w-0 cursor-pointer items-start gap-2 rounded-lg transition-colors duration-150 ease-out hover:bg-[#6B9E6E15] hover:underline"
                >
                  <div className="relative aspect-square h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                    <AgentAvatarFill name={firstAgent.name} imageUrl={firstAgent.image} sizes="28px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex w-full items-center justify-between gap-1">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-[#2C2C2C]/85">
                          {firstAgent.name}
                        </span>
                        <BadgeCheck className="h-3 w-3 shrink-0 text-[#D4A843]" aria-label="Verified" />
                      </div>
                      {firstAgent.score > 0 ? (
                        <span className="ml-1 flex shrink-0 items-center gap-0.5 text-xs text-gray-400">
                          ★ {Number(firstAgent.score).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[10px] text-gray-400">
                      {listingCardBrokerageSubtitle(firstAgent)}
                    </p>
                  </div>
                </Link>
              </div>
            ) : null}
            {moreAgentCount > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/properties/${encodeURIComponent(property.id)}#agents-section`);
                }}
                className="mt-1 w-full shrink-0 rounded-full border border-[#6B9E6E] px-3 py-1 text-center text-xs text-[#6B9E6E]"
              >
                See {moreAgentCount} more agent{moreAgentCount === 1 ? "" : "s"} →
              </button>
            ) : (
              <p className="mt-1 w-full shrink-0 rounded-full border border-gray-100 py-1.5 text-center text-xs text-gray-300">
                No other agents on this listing
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function countActiveFilters(filters: FiltersState, sortMode: SortMode): number {
  let n = 0;
  if (filters.minPrice !== 0 || filters.maxPrice !== 350_000_000) n++;
  if (filters.beds !== "any") n++;
  if (filters.baths !== "any") n++;
  if (filters.propertyType !== "any") n++;
  if (sortMode !== "newest") n++;
  return n;
}

function activeFilterChips(
  filters: FiltersState,
  sortMode: SortMode,
  actions: {
    clearPrice: () => void;
    clearBeds: () => void;
    clearBaths: () => void;
    clearType: () => void;
    clearSort: () => void;
  },
) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.minPrice !== 0 || filters.maxPrice !== 350_000_000) {
    chips.push({
      key: "price",
      label: `Price ${formatPeso(filters.minPrice)}–${formatPeso(filters.maxPrice)}`,
      onRemove: actions.clearPrice,
    });
  }
  if (filters.beds !== "any") {
    chips.push({ key: "beds", label: `Beds ${filters.beds === 4 ? "4+" : filters.beds}`, onRemove: actions.clearBeds });
  }
  if (filters.baths !== "any") {
    chips.push({ key: "baths", label: `Baths ${filters.baths === 3 ? "3+" : filters.baths}`, onRemove: actions.clearBaths });
  }
  if (filters.propertyType !== "any") {
    chips.push({ key: "type", label: `Type ${filters.propertyType}`, onRemove: actions.clearType });
  }
  if (sortMode !== "newest") {
    const label =
      sortMode === "price_low"
        ? "Sort Price ↑"
        : sortMode === "price_high"
          ? "Sort Price ↓"
          : sortMode === "most_beds"
            ? "Sort Beds"
            : "Sort";
    chips.push({ key: "sort", label, onRemove: actions.clearSort });
  }
  return chips;
}

function PropertyRows({
  rows,
  showMore,
  onToggleShowMore,
  rowRefs,
  cardRoomIdx,
  setCardRoomIdx,
  engagement,
  connectedAgentsByPropertyId,
  viewerUserId,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
  listingsOnboardingHref,
}: {
  rows: { key: string; title: string; subtitle: string; items: DbProperty[]; featured?: boolean }[];
  showMore: boolean;
  onToggleShowMore: () => void;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  engagement: PropertyEngagement;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
  listingsOnboardingHref: string;
}) {
  const first = rows.slice(0, 4);
  const rest = rows.slice(4);

  return (
    <div className="space-y-6">
      {first.map((r, i) => (
        <div key={r.key}>
          <RowCarousel
            rowKey={r.key}
            title={r.title}
            subtitle={r.subtitle}
            items={r.items}
            featured={!!r.featured}
            rowRefs={rowRefs}
            cardRoomIdx={cardRoomIdx}
            setCardRoomIdx={setCardRoomIdx}
            engagement={engagement}
            connectedAgentsByPropertyId={connectedAgentsByPropertyId}
            viewerUserId={viewerUserId}
            onOpenPropertyZoom={onOpenPropertyZoom}
            viewerVerifiedListingAgent={viewerVerifiedListingAgent}
            listingsOnboardingHref={listingsOnboardingHref}
          />
          {i < first.length - 1 ? (
            <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
          ) : null}
        </div>
      ))}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onToggleShowMore}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/75 ring-1 ring-black/10 hover:bg-neutral-50"
        >
          {showMore ? "Show Less ↑" : "Show More Categories ↓"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showMore ? (
          <motion.div
            key="more-cats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden space-y-6"
          >
            {rest.map((r) => (
              <div key={r.key}>
                <RowCarousel
                  rowKey={r.key}
                  title={r.title}
                  subtitle={r.subtitle}
                  items={r.items}
                  featured={!!r.featured}
                  rowRefs={rowRefs}
                  cardRoomIdx={cardRoomIdx}
                  setCardRoomIdx={setCardRoomIdx}
                  engagement={engagement}
                  connectedAgentsByPropertyId={connectedAgentsByPropertyId}
                  viewerUserId={viewerUserId}
                  onOpenPropertyZoom={onOpenPropertyZoom}
                  viewerVerifiedListingAgent={viewerVerifiedListingAgent}
                  listingsOnboardingHref={listingsOnboardingHref}
                />
                <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ListingsComingSoonPlaceholderCard({
  cardWidthClass,
  href,
}: {
  cardWidthClass: string;
  href: string;
}) {
  return (
    <motion.div
      className="shrink-0"
      animate={{ opacity: [0.88, 1, 0.88] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <Link
        href={href}
        className={cn(
          "flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#6B9E6E] bg-[#FAF8F4] px-3 py-8 text-center shadow-sm transition hover:bg-[#F4F1EA]",
          cardWidthClass,
        )}
      >
        <Home className="mb-3 h-11 w-11 text-[#6B9E6E]" strokeWidth={1.5} aria-hidden />
        <p className="font-serif text-sm font-bold text-[#2C2C2C]">More listings coming soon</p>
        <p className="mt-2 text-xs font-semibold text-[#6B9E6E]">Be the first to list here →</p>
      </Link>
    </motion.div>
  );
}

function AgentScoreTutorialCard({ compact }: { compact?: boolean }) {
  const mariaAvatar =
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face";

  if (compact) {
    return (
      <div className="w-full rounded-xl border border-[#6B9E6E]/40 bg-[#6B9E6E]/15 p-3 shadow-sm">
        <p className="text-center font-serif text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/55">
          Score guide
        </p>
        <div className="mt-2 rounded-xl border border-[#2C2C2C]/10 bg-white p-2.5 shadow-sm">
          <div className="flex gap-2.5">
            <div className="relative aspect-square h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
              <Image
                src={mariaAvatar}
                alt=""
                width={40}
                height={40}
                className="object-cover"
                sizes="40px"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-[#2C2C2C]">Maria Santos</p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#D4A843]/18 px-1.5 py-0.5 text-[9px] font-bold text-[#8a6d32]">
                  <Flame className="h-2.5 w-2.5 text-[#D4A843]" aria-hidden />
                  Verified
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/60">
                Score {formatAgentScore(95)} · 312 closings ·{" "}
                <span className="text-[#6B9E6E]">Fast response</span>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-2.5">
          <h3 className="font-serif text-sm font-bold text-[#2C2C2C]">How Scores Work</h3>
          <ul className="mt-1.5 space-y-1 text-[11px] font-medium text-[#2C2C2C]/85">
            <li className="flex gap-1.5">
              <Star className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A843]" aria-hidden />
              <span>
                <strong className="text-[#2C2C2C]">9.0–10.0:</strong> Elite
              </span>
            </li>
            <li className="flex gap-1.5">
              <Star className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A843]" aria-hidden />
              <span>
                <strong className="text-[#2C2C2C]">7.0–8.9:</strong> Experienced
              </span>
            </li>
            <li className="flex gap-1.5">
              <Star className="mt-0.5 h-3 w-3 shrink-0 text-[#D4A843]" aria-hidden />
              <span>
                <strong className="text-[#2C2C2C]">5.0–6.9:</strong> Growing
              </span>
            </li>
          </ul>
          <p className="mt-2 text-[10px] font-semibold leading-snug text-[#2C2C2C]/55">
            Based on closings, response time, reviews
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[300px] w-full flex-col rounded-2xl border border-[#6B9E6E]/40 bg-[#6B9E6E]/15 p-5 shadow-sm">
      <p className="text-center font-serif text-xs font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/55">
        Score guide
      </p>
      <div className="mt-3 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative aspect-square h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
            <Image
              src={mariaAvatar}
              alt=""
              width={56}
              height={56}
              className="object-cover"
              sizes="56px"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[#2C2C2C]">Maria Santos</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/18 px-2 py-0.5 text-[10px] font-bold text-[#8a6d32]">
                <Flame className="h-3 w-3 text-[#D4A843]" aria-hidden />
                Verified
              </span>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/60">
              Score {formatAgentScore(95)} · 312 closings
            </p>
            <p className="mt-1 text-[11px] font-semibold text-[#6B9E6E]">Fast response</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex-1">
        <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">How Scores Work</h3>
        <ul className="mt-3 space-y-2 text-sm font-medium text-[#2C2C2C]/85">
          <li className="flex">
            <Star className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
            <span>
              <strong className="text-[#2C2C2C]">9.0–10.0:</strong> Elite Agent
            </span>
          </li>
          <li className="flex">
            <Star className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
            <span>
              <strong className="text-[#2C2C2C]">7.0–8.9:</strong> Experienced
            </span>
          </li>
          <li className="flex">
            <Star className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]" aria-hidden />
            <span>
              <strong className="text-[#2C2C2C]">5.0–6.9:</strong> Growing
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs font-semibold leading-relaxed text-[#2C2C2C]/60">
          Score based on: closings, response time, client reviews
        </p>
      </div>
    </div>
  );
}

function MoreAgentsComingSoonCard() {
  return (
    <motion.div
      className="w-[180px] shrink-0 lg:w-[300px]"
      animate={{ opacity: [0.88, 1, 0.88] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <Link
        href="/register/agent"
        className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#6B9E6E] bg-[#FAF8F4] px-4 py-8 text-center shadow-sm transition hover:bg-[#F4F1EA] md:min-h-0"
      >
        <UserPlus className="mb-3 h-11 w-11 text-[#6B9E6E]" strokeWidth={1.5} aria-hidden />
        <h3 className="font-serif text-lg font-bold tracking-tight text-[#2C2C2C]">More Agents Coming Soon</h3>
        <p className="mt-2 text-sm font-semibold text-[#2C2C2C]">Join as a verified agent</p>
      </Link>
    </motion.div>
  );
}

function RowCarousel({
  rowKey,
  title,
  subtitle,
  items,
  featured,
  rowRefs,
  cardRoomIdx,
  setCardRoomIdx,
  engagement,
  connectedAgentsByPropertyId,
  viewerUserId,
  onOpenPropertyZoom,
  viewerVerifiedListingAgent,
  listingsOnboardingHref,
}: {
  rowKey: string;
  title: string;
  subtitle: string;
  items: DbProperty[];
  featured: boolean;
  rowRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  cardRoomIdx: Record<string, number>;
  setCardRoomIdx: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  engagement: PropertyEngagement;
  connectedAgentsByPropertyId: Map<string, MarketplaceAgent[]>;
  viewerUserId?: string | null;
  onOpenPropertyZoom: (p: DbProperty) => void;
  viewerVerifiedListingAgent: boolean;
  listingsOnboardingHref: string;
}) {
  const scroll = (dir: "prev" | "next") => {
    const el = rowRefs.current[rowKey];
    if (!el) return;
    const step = Math.max(300, Math.round(el.clientWidth * 0.85));
    el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
  };

  const list = items.slice(0, 12);
  const fillerCount =
    list.length === 0 ? 3 : list.length > 0 && list.length < 5 ? 5 - list.length : 0;
  const featuredClasses = featured ? "rounded-2xl border border-[#D4A843]/30 bg-[#D4A843]/5 px-3 pt-3" : "";
  const cardWidthClass = "w-[220px] shrink-0 sm:w-[232px] lg:w-[240px]";
  const reserveBrowseSectionMinH = title === "Featured Picks" || title === "Newly Listed Rentals";

  return (
    <div className={cn(featuredClasses, reserveBrowseSectionMinH && "min-h-[400px]")}>
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {featured ? <Star className="h-4 w-4 shrink-0 text-[#D4A843]" /> : null}
          <h2 className="min-w-0 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">{title}</h2>
        </div>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">{subtitle}</p>
      </div>

      <div className="-mx-4 flex items-stretch gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => scroll("prev")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pl-2"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          ref={(el) => {
            rowRefs.current[rowKey] = el;
          }}
          className="min-w-0 flex-1 overflow-x-auto px-1 pb-2 scrollbar-hide"
        >
          <div className="flex w-max flex-nowrap gap-3">
            {list.map((p) => (
              <NewlyListedCard
                key={`${rowKey}-${p.id}`}
                property={p}
                roomUrls={roomUrlsFor(p)}
                roomIdx={cardRoomIdx[p.id] ?? 0}
                onRoomPrev={() =>
                  setCardRoomIdx((s) => ({
                    ...s,
                    [p.id]:
                      (roomUrlsFor(p).length + (s[p.id] ?? 0) - 1) %
                      Math.max(1, roomUrlsFor(p).length),
                  }))
                }
                onRoomNext={() =>
                  setCardRoomIdx((s) => ({
                    ...s,
                    [p.id]: ((s[p.id] ?? 0) + 1) % Math.max(1, roomUrlsFor(p).length),
                  }))
                }
                engagement={engagement}
                connectedAgents={connectedAgentsByPropertyId.get(p.id) ?? []}
                onOpenPropertyZoom={() => onOpenPropertyZoom(p)}
                cardWidthClass={cardWidthClass}
                viewerUserId={viewerUserId}
                compact
                verifiedListingAgent={viewerVerifiedListingAgent}
              />
            ))}
            {Array.from({ length: fillerCount }).map((_, i) => (
              <ListingsComingSoonPlaceholderCard
                key={`ph-${rowKey}-${i}`}
                cardWidthClass={cardWidthClass}
                href={listingsOnboardingHref}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => scroll("next")}
          className="hidden shrink-0 self-center rounded-full border border-black/10 bg-white p-2 shadow-sm hover:bg-neutral-50 md:flex md:pr-2"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

