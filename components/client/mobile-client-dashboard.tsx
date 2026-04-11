"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Bookmark,
  Calendar,
  FileText,
  Heart,
  Home,
  Rocket,
  Search,
  Shield,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { labelForClientDocType } from "@/lib/client-documents";
import { cn } from "@/lib/utils";

type MainTab = "profile" | "saved" | "pins" | "documents";

type PropertyPhoto = { url: string; sort_order: number | null };

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  status: "for_sale" | "for_rent" | "sold" | "rented";
  image_url: string;
  property_photos?: PropertyPhoto[] | null;
};

type SavedJoinRow = { created_at: string; properties: PropertyRow | PropertyRow[] | null };
type LikeJoinRow = { created_at: string; properties: PropertyRow | PropertyRow[] | null };

function oneProperty(p: PropertyRow | PropertyRow[] | null | undefined): PropertyRow | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

type ClientDocRow = {
  id: string;
  created_at: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
};

type SharedDocRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type BadgeSlug = "first-save" | "smart-shopper" | "active-hunter" | "early-adopter" | "document-ready";

const BADGE_META: Record<
  BadgeSlug,
  { label: string; description: string; Icon: typeof Bookmark }
> = {
  "first-save": {
    label: "First Save",
    description: "You saved your first property.",
    Icon: Bookmark,
  },
  "smart-shopper": {
    label: "Smart Shopper",
    description: "You saved 5 or more listings.",
    Icon: ShoppingBag,
  },
  "active-hunter": {
    label: "Active Hunter",
    description: "You booked 3 viewing requests.",
    Icon: Calendar,
  },
  "early-adopter": {
    label: "Early Adopter",
    description: "Thanks for joining BahayGo early.",
    Icon: Rocket,
  },
  "document-ready": {
    label: "Document Ready",
    description: "You uploaded 3 documents.",
    Icon: Shield,
  },
};

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function memberSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Member since ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

function pickPropertyImage(p: PropertyRow): string {
  const photos = p.property_photos;
  if (photos?.length) {
    const sorted = [...photos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const u = sorted[0]?.url?.trim();
    if (u) return u;
  }
  return p.image_url?.trim() || "";
}

function firstNameFromFull(full: string): string {
  const t = full.trim();
  if (!t) return "there";
  return t.split(/\s+/)[0] ?? "there";
}

export function MobileClientDashboard() {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mainTab, setMainTab] = useState<MainTab>("profile");
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [memberSinceIso, setMemberSinceIso] = useState<string | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [badges, setBadges] = useState<{ badge_slug: BadgeSlug }[]>([]);
  const [openBadge, setOpenBadge] = useState<BadgeSlug | null>(null);
  const [savedRows, setSavedRows] = useState<SavedJoinRow[]>([]);
  const [likeRows, setLikeRows] = useState<LikeJoinRow[]>([]);
  const [ownDocs, setOwnDocs] = useState<ClientDocRow[]>([]);
  const [sharedDocs, setSharedDocs] = useState<SharedDocRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewBusyUrl, setViewBusyUrl] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const uid = user.id;

    const [
      profileRes,
      badgesRes,
      docsCountRes,
      savedRes,
      likesRes,
      ownDocsRes,
      sharedRes,
      notifRes,
    ] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url, created_at").eq("id", uid).maybeSingle(),
      supabase.from("client_badges").select("badge_slug").eq("client_id", uid),
      supabase.from("client_documents").select("id", { count: "exact", head: true }).eq("client_id", uid),
      supabase
        .from("saved_properties")
        .select(
          `
          created_at,
          properties (
            id,
            name,
            location,
            price,
            status,
            image_url,
            property_photos (url, sort_order)
          )
        `,
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_likes")
        .select(
          `
          created_at,
          properties (
            id,
            name,
            location,
            price,
            status,
            image_url,
            property_photos (url, sort_order)
          )
        `,
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_documents")
        .select("id, created_at, document_type, file_url, file_name")
        .eq("client_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id, created_at, metadata")
        .eq("user_id", uid)
        .eq("type", "document_shared")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
    ]);

    const prow = profileRes.data as {
      full_name?: string | null;
      avatar_url?: string | null;
      created_at?: string;
    } | null;
    if (prow) {
      setFullName(prow.full_name?.trim() ?? "");
      setAvatarUrl(prow.avatar_url?.trim() || null);
      setMemberSinceIso(prow.created_at ?? null);
    }

    const rawBadges = (badgesRes.data ?? []) as { badge_slug: string }[];
    setBadges(
      rawBadges.filter((b): b is { badge_slug: BadgeSlug } => b.badge_slug in BADGE_META),
    );

    setDocCount(docsCountRes.count ?? 0);

    setSavedRows((savedRes.data ?? []) as unknown as SavedJoinRow[]);
    setLikeRows((likesRes.data ?? []) as unknown as LikeJoinRow[]);

    setOwnDocs((ownDocsRes.data ?? []) as ClientDocRow[]);

    if (sharedRes.data) {
      const filtered = (sharedRes.data as SharedDocRow[]).filter((r) => {
        const url = r.metadata && typeof r.metadata.signed_url === "string" ? r.metadata.signed_url : "";
        return Boolean(url?.trim());
      });
      setSharedDocs(filtered);
    } else {
      setSharedDocs([]);
    }

    setUnreadCount(typeof notifRes.count === "number" ? notifRes.count : 0);
    setLoading(false);
  }, [supabase, user?.id]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setOpenBadge(null);
  }, [mainTab]);

  const profileGridItems = useMemo(() => {
    const map = new Map<
      string,
      { property: PropertyRow; sortKey: number; saved: boolean; liked: boolean }
    >();
    for (const r of savedRows) {
      const p = oneProperty(r.properties);
      if (!p?.id) continue;
      const prev = map.get(p.id);
      const t = new Date(r.created_at).getTime();
      if (!prev) {
        map.set(p.id, { property: p, sortKey: t, saved: true, liked: false });
      } else {
        map.set(p.id, {
          ...prev,
          sortKey: Math.max(prev.sortKey, t),
          saved: true,
        });
      }
    }
    for (const r of likeRows) {
      const p = oneProperty(r.properties);
      if (!p?.id) continue;
      const prev = map.get(p.id);
      const t = new Date(r.created_at).getTime();
      if (!prev) {
        map.set(p.id, { property: p, sortKey: t, saved: false, liked: true });
      } else {
        map.set(p.id, {
          ...prev,
          sortKey: Math.max(prev.sortKey, t),
          liked: true,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.sortKey - a.sortKey);
  }, [savedRows, likeRows]);

  const openOwnDocument = async (file_url: string) => {
    setViewBusyUrl(file_url);
    try {
      const res = await fetch("/api/client/get-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ file_url }),
      });
      const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) {
        return;
      }
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setViewBusyUrl(null);
    }
  };

  const first = firstNameFromFull(fullName);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] transition-all duration-200 dark:bg-[#0A0A0A]">
        <div className="animate-pulse px-4 pt-6">
          <div className="h-8 w-48 rounded-lg bg-neutral-300/80 dark:bg-white/10" />
          <div className="mt-4 h-10 w-full rounded-full bg-neutral-300/80 dark:bg-white/10" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="aspect-[4/5] rounded-2xl bg-neutral-300/80 dark:bg-white/10" />
            <div className="aspect-[4/5] rounded-2xl bg-neutral-300/80 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-28 font-sans text-[#2C2C2C] transition-all duration-200 dark:bg-[#0A0A0A] dark:text-white">
      <header className="relative px-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#2C2C2C]/70 dark:text-white/70">
              {greetingForHour()},{" "}
              <span className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] dark:text-white">
                {first}
              </span>
            </p>
            <p className="mt-1 font-serif text-sm font-medium text-[#2C2C2C]/60 dark:text-white/55">
              Here&apos;s your BahayGo.
            </p>
          </div>
          <Link
            href="/notifications"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5 transition-all duration-200 dark:bg-[#1A1A1A] dark:ring-white/10"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-[#2C2C2C] dark:text-white" />
            {unreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(
            [
              ["profile", "Profile"],
              ["saved", "Saved"],
              ["pins", "Pins"],
              ["documents", "Documents"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMainTab(id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                mainTab === id
                  ? "bg-[#6B9E6E] text-white shadow-md"
                  : "bg-transparent text-[#2C2C2C]/50 dark:text-white/45",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mt-4 px-4">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-40 w-full rounded-2xl bg-neutral-300/80 dark:bg-white/10" />
            <div className="h-24 w-full rounded-2xl bg-neutral-300/80 dark:bg-white/10" />
          </div>
        ) : mainTab === "profile" ? (
          <ProfileTab
            fullName={fullName}
            avatarUrl={avatarUrl}
            memberSinceIso={memberSinceIso}
            verified={docCount >= 1}
            badges={badges}
            openBadge={openBadge}
            setOpenBadge={setOpenBadge}
            gridItems={profileGridItems}
          />
        ) : mainTab === "saved" ? (
          <SavedPinsTab
            mode="saved"
            savedRows={savedRows}
            likeRows={likeRows}
          />
        ) : mainTab === "pins" ? (
          <SavedPinsTab mode="pins" savedRows={savedRows} likeRows={likeRows} />
        ) : (
          <DocumentsTab
            ownDocs={ownDocs}
            sharedDocs={sharedDocs}
            viewBusyUrl={viewBusyUrl}
            onViewOwn={openOwnDocument}
          />
        )}
      </main>

      <BottomNav
        pathname={pathname}
        userId={user.id}
        avatarUrl={avatarUrl}
        fullName={fullName}
        unreadCount={unreadCount}
      />
    </div>
  );
}

function ProfileTab({
  fullName,
  avatarUrl,
  memberSinceIso,
  verified,
  badges,
  openBadge,
  setOpenBadge,
  gridItems,
}: {
  fullName: string;
  avatarUrl: string | null;
  memberSinceIso: string | null;
  verified: boolean;
  badges: { badge_slug: BadgeSlug }[];
  openBadge: BadgeSlug | null;
  setOpenBadge: (s: BadgeSlug | null) => void;
  gridItems: { property: PropertyRow; saved: boolean; liked: boolean }[];
}) {
  const initial = fullName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            "relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]/20 ring-offset-2 transition-all duration-200 dark:bg-[#6B9E6E]/25 dark:ring-offset-[#0A0A0A]",
            verified ? "ring-4 ring-[#D4A843]" : "ring-2 ring-black/5 dark:ring-white/10",
          )}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" sizes="96px" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-2xl font-bold text-[#6B9E6E]">
              {initial}
            </div>
          )}
        </div>
        <h2 className="mt-4 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] dark:text-white">
          {fullName.trim() || "Your profile"}
        </h2>
        {memberSinceIso ? (
          <p className="mt-1 text-xs font-medium text-[#2C2C2C]/45 dark:text-white/45">
            {memberSince(memberSinceIso)}
          </p>
        ) : null}

        {badges.length > 0 ? (
          <div className="relative mt-5 flex flex-wrap justify-center gap-3">
            {badges.map((b) => {
              const meta = BADGE_META[b.badge_slug];
              if (!meta) return null;
              const Icon = meta.Icon;
              const open = openBadge === b.badge_slug;
              return (
                <div key={b.badge_slug} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenBadge(open ? null : b.badge_slug)}
                    className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#D4A843] to-[#b8922e] text-white shadow-lg ring-2 ring-[#D4A843]/40 transition-all duration-200 active:scale-95"
                    aria-label={meta.label}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </button>
                  {open ? (
                    <div className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-black/10 bg-white p-3 text-left shadow-xl dark:border-white/10 dark:bg-[#1A1A1A]">
                      <p className="font-semibold text-[#2C2C2C] dark:text-white">{meta.label}</p>
                      <p className="mt-1 text-xs text-[#2C2C2C]/65 dark:text-white/60">{meta.description}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {gridItems.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved properties yet"
          subtitle="Start exploring listings and save your favorites."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {gridItems.map(({ property: p }) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-200 shadow-lg ring-1 ring-black/5 transition-all duration-200 dark:bg-[#1A1A1A] dark:ring-white/10"
            >
              {pickPropertyImage(p) ? (
                <Image
                  src={pickPropertyImage(p)}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-200 group-active:scale-[1.02]"
                  sizes="(max-width:768px) 45vw, 300px"
                  unoptimized
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-2 font-serif text-sm font-bold leading-tight text-white drop-shadow">
                  {p.name?.trim() || p.location}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/95 drop-shadow">
                  {formatPropertyPriceDisplay(p.price, p.status)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedPinsTab({
  mode,
  savedRows,
  likeRows,
}: {
  mode: "saved" | "pins";
  savedRows: SavedJoinRow[];
  likeRows: LikeJoinRow[];
}) {
  const rows = mode === "saved" ? savedRows : likeRows;
  const empty =
    mode === "saved" ? "No saved listings yet." : "No liked listings yet. Heart properties you love.";
  const Icon = mode === "saved" ? Bookmark : Heart;

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={mode === "saved" ? "No saved properties yet" : "No pins yet"}
        subtitle={empty}
      />
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const p = oneProperty(r.properties);
        if (!p) return null;
        const img = pickPropertyImage(p);
        return (
          <Link
            key={`${mode}-${r.created_at}-${p.id}`}
            href={`/properties/${p.id}`}
            className="relative block overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5 transition-all duration-200 dark:bg-[#1A1A1A] dark:ring-white/10"
          >
            <div className="relative aspect-[16/10] w-full bg-neutral-100 dark:bg-white/5">
              {img ? (
                <Image src={img} alt="" fill className="object-cover" sizes="100vw" unoptimized />
              ) : null}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold text-[#2C2C2C] dark:text-white">
                    {p.name?.trim() || "Listing"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#2C2C2C]/55 dark:text-white/55">{p.location}</p>
                  <p className="mt-2 text-base font-bold text-[#2C2C2C] dark:text-white">
                    {formatPropertyPriceDisplay(p.price, p.status)}
                  </p>
                </div>
                {mode === "saved" ? (
                  <Bookmark className="h-7 w-7 shrink-0 fill-[#D4A843] text-[#D4A843]" aria-hidden />
                ) : (
                  <Heart className="h-7 w-7 shrink-0 fill-[#6B9E6E] text-[#6B9E6E]" aria-hidden />
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function DocumentsTab({
  ownDocs,
  sharedDocs,
  viewBusyUrl,
  onViewOwn,
}: {
  ownDocs: ClientDocRow[];
  sharedDocs: SharedDocRow[];
  viewBusyUrl: string | null;
  onViewOwn: (file_url: string) => void;
}) {
  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/45 dark:text-white/45">
          Your uploads
        </h3>
        {ownDocs.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-[#2C2C2C]/55 dark:text-white/50">
            No documents uploaded yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {ownDocs.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-black/5 bg-white p-4 shadow-md dark:border-white/10 dark:bg-[#1A1A1A]"
              >
                <div className="flex gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45 dark:text-white/45">
                      {labelForClientDocType(d.document_type)}
                    </p>
                    <p className="mt-1 font-semibold text-[#2C2C2C] dark:text-white">
                      {d.file_name?.trim() || "Document"}
                    </p>
                    <p className="mt-1 text-xs text-[#2C2C2C]/50 dark:text-white/50">
                      {new Date(d.created_at).toLocaleDateString()}
                    </p>
                    <button
                      type="button"
                      disabled={viewBusyUrl === d.file_url}
                      onClick={() => void onViewOwn(d.file_url)}
                      className="mt-3 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow transition-all duration-200 disabled:opacity-50"
                    >
                      {viewBusyUrl === d.file_url ? "Opening…" : "View"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/45 dark:text-white/45">
          Shared by agents
        </h3>
        {sharedDocs.length === 0 ? (
          <p className="mt-3 text-sm font-medium text-[#2C2C2C]/55 dark:text-white/50">
            No shared documents yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sharedDocs.map((r) => {
              const meta = r.metadata ?? {};
              const signedUrl = typeof meta.signed_url === "string" ? meta.signed_url : "";
              const docType =
                typeof meta.document_type === "string" ? meta.document_type : "Document";
              const fileName =
                typeof meta.file_name === "string" && meta.file_name.trim()
                  ? meta.file_name
                  : "File";
              const agentName =
                typeof meta.agent_name === "string" && meta.agent_name.trim()
                  ? meta.agent_name
                  : "Agent";
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-black/5 bg-white p-4 shadow-md dark:border-white/10 dark:bg-[#1A1A1A]"
                >
                  <div className="flex gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45 dark:text-white/45">
                        {docType}
                      </p>
                      <p className="mt-1 font-semibold text-[#2C2C2C] dark:text-white">{fileName}</p>
                      <p className="mt-1 text-sm text-[#2C2C2C]/65 dark:text-white/60">
                        From {agentName} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <button
                        type="button"
                        onClick={() => signedUrl && window.open(signedUrl, "_blank", "noopener,noreferrer")}
                        className="mt-3 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow"
                      >
                        View
                      </button>
                      <p className="mt-2 text-[11px] font-semibold text-amber-800/90 dark:text-amber-200/90">
                        Link may expire after ~1 hour. Request a new one from your agent if needed.
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Bookmark;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#6B9E6E]/15 text-[#6B9E6E] dark:bg-[#6B9E6E]/25">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <p className="mt-4 font-serif text-lg font-bold text-[#2C2C2C] dark:text-white">{title}</p>
      <p className="mt-2 max-w-xs text-sm font-medium text-[#2C2C2C]/55 dark:text-white/55">{subtitle}</p>
    </div>
  );
}

function BottomNav({
  pathname,
  userId,
  avatarUrl,
  fullName,
  unreadCount,
}: {
  pathname: string;
  userId: string;
  avatarUrl: string | null;
  fullName: string;
  unreadCount: number;
}) {
  const initial = fullName.trim().slice(0, 1).toUpperCase() || "?";
  const profileHref = `/clients/${encodeURIComponent(userId)}`;
  const profileActive = pathname.startsWith("/clients/");

  const Item = ({
    href,
    label,
    icon: Icon,
    active,
    children,
  }: {
    href: string;
    label: string;
    icon?: typeof Home;
    active: boolean;
    children?: ReactNode;
  }) => (
    <Link
      href={href}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-all duration-200",
        active ? "text-[#6B9E6E]" : "text-[#2C2C2C]/40 dark:text-white/40",
      )}
    >
      {children ?? (Icon ? <Icon className="h-6 w-6" /> : null)}
      <span className="truncate">{label}</span>
    </Link>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-black/5 px-1 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md transition-all duration-200 dark:border-white/10 dark:bg-black/60 bg-white/80">
      <Item href="/" label="Home" icon={Home} active={pathname === "/"} />
      <Item href="/" label="Search" icon={Search} active={false} />
      <Item href="/notifications" label="Notifications" active={pathname.startsWith("/notifications")}>
        <span className="relative">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      </Item>
      <Link
        href={profileHref}
        className={cn(
          "relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold transition-all duration-200",
          profileActive ? "text-[#6B9E6E]" : "text-[#2C2C2C]/40 dark:text-white/40",
        )}
      >
        <span className="relative h-7 w-7 overflow-hidden rounded-full bg-[#6B9E6E]/25 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0A0A0A]">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill className="object-cover" sizes="28px" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[#6B9E6E]">
              {initial}
            </span>
          )}
        </span>
        <span className="truncate">Profile</span>
      </Link>
    </nav>
  );
}
