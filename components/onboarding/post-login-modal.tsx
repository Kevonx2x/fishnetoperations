"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  GitBranch,
  Heart,
  House,
  Rocket,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CHANGELOG_VERSION = "v1.0";
const OPEN_DELAY_MS = 4000;

function MiniPropertyCard({
  title,
  price,
  className,
  style,
}: {
  title: string;
  price: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`flex flex-col justify-center rounded-md bg-[#6B9E6E] px-2 py-1.5 shadow-md ${className ?? ""}`}
      style={style}
    >
      <p className="truncate text-[9px] font-bold leading-tight text-white">{title}</p>
      <p className="text-[8px] font-semibold text-white/90">{price}</p>
    </div>
  );
}

function KanbanColumns({ labels }: { labels: string[] }) {
  return (
    <div className="flex h-[148px] w-[272px] shrink-0 gap-1.5">
      {labels.map((label) => (
        <div
          key={label}
          className="flex w-[62px] shrink-0 flex-col rounded border border-white/12 bg-[#252525] pt-4"
        >
          <span className="block text-center text-[7px] font-bold uppercase tracking-wide text-white/35">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Onboarding slide 1 — row1 Lead→Viewing (1s), pause (0.5s), row2 Viewing→Offer (1s), loop */
function PreviewKanbanOnboarding() {
  const col = 62 + 6;
  return (
    <div className="relative mx-auto flex h-[200px] w-[272px] items-end justify-center pb-2">
      <KanbanColumns labels={["Lead", "Viewing", "Offer", "Closed"]} />
      <motion.div
        className="absolute left-[5px] top-9 w-[56px]"
        initial={false}
        animate={{ x: [0, col, col, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.286, 0.429, 1],
        }}
      >
        <MiniPropertyCard title="BGC Unit" price="₱18M" className="w-full" />
      </motion.div>
      <motion.div
        className="absolute top-[118px] w-[56px]"
        style={{ left: 5 + col }}
        initial={false}
        animate={{ x: [0, col, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.4, 1],
        }}
      >
        <MiniPropertyCard title="QC Row" price="₱8.2M" className="w-full" />
      </motion.div>
      <div className="absolute right-[6px] top-[118px] w-[56px]">
        <MiniPropertyCard title="Makati Loft" price="₱12.5M" className="w-full opacity-75" />
      </div>
    </div>
  );
}

function StagePill({ text, tone }: { text: string; tone: "gold" | "sage" | "muted" }) {
  const bg =
    tone === "gold"
      ? "bg-[#D4A843]/25 text-[#D4A843]"
      : tone === "sage"
        ? "bg-[#6B9E6E]/25 text-[#6B9E6E]"
        : "bg-white/10 text-white/60";
  return (
    <span className={`inline-block max-w-full truncate rounded px-1 py-0.5 text-[6px] font-bold ${bg}`}>
      {text}
    </span>
  );
}

/** What's new slide 1 — kanban with pills + faint bg on one card */
function PreviewKanbanWhatsNew() {
  const col = 62 + 6;
  return (
    <div className="relative mx-auto flex h-[200px] w-[272px] items-end justify-center pb-2">
      <KanbanColumns labels={["Lead", "Viewing", "Offer", "Closed"]} />
      <motion.div
        className="absolute left-[5px] top-9 w-[56px] overflow-hidden rounded-md border border-white/10 shadow-md"
        initial={false}
        animate={{ x: [0, col * 2, col * 2, 0] }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          ease: [0.22, 1, 0.36, 1],
          times: [0, 0.35, 0.5, 1],
        }}
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#6B9E6E]/40 to-[#2C2C2C]/80"
          aria-hidden
        />
        <div className="relative z-10 flex h-full flex-col justify-between bg-[#2C2C2C]/75 p-1.5">
          <StagePill text="Viewing Apr 30" tone="gold" />
          <div>
            <p className="text-[8px] font-bold text-white">Ortigas View</p>
            <p className="text-[7px] text-white/70">₱9.1M</p>
          </div>
        </div>
      </motion.div>
      <div className="absolute left-[5px] top-[118px] w-[56px] rounded-md border border-white/10 bg-[#333] p-1.5 shadow-md">
        <StagePill text="New lead Apr 27" tone="sage" />
        <p className="mt-1 text-[8px] font-bold text-white">Pasig TH</p>
      </div>
    </div>
  );
}

function PreviewAgentVerified() {
  return (
    <div className="relative mx-auto flex w-[220px] flex-col items-center gap-3 py-2">
      <div className="relative w-full rounded-xl border border-white/10 bg-[#2C2C2C] p-3 shadow-lg">
        <div className="flex items-start gap-2">
          <div className="h-11 w-11 shrink-0 rounded-full bg-white/10 ring-1 ring-white/15" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">Alex Rivera</p>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 18, repeat: Infinity, repeatDelay: 2 }}
              className="mt-1 inline-flex items-center rounded-full bg-[#6B9E6E]/25 px-2 py-0.5 text-[8px] font-bold text-[#6B9E6E]"
            >
              Verified
            </motion.span>
          </div>
        </div>
        <div className="mt-2 flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              className="text-[#D4A843]"
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.35,
                delay: i * 0.12,
                repeat: Infinity,
                repeatDelay: 2.2,
              }}
            >
              ★
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewClientCarousel() {
  return (
    <div className="relative mx-auto h-[160px] w-[240px] overflow-hidden py-2">
      <motion.div
        className="flex gap-2"
        animate={{ x: [0, -56, -112, -56, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {["Alabang", "BGC", "Makati", "Pasig", "QC"].map((city, i) => (
          <div
            key={city}
            className="relative h-[100px] w-[72px] shrink-0 rounded-lg border border-white/10 bg-[#6B9E6E]/30"
          >
            <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-1.5">
              <p className="text-[8px] font-bold text-white">{city}</p>
            </div>
            {i === 2 ? (
              <motion.span
                className="absolute right-1 top-1 text-white"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Heart className="h-3.5 w-3.5 fill-[#6B9E6E] text-[#6B9E6E]" strokeWidth={1.5} />
              </motion.span>
            ) : null}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function BahayGoLogoMark({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ""}`}>
      <div className="flex items-center gap-1">
        <House className="h-8 w-8 text-[#D4A843]" strokeWidth={1.75} />
      </div>
      <p className="text-center font-sans text-lg font-bold tracking-tight">
        <span className="text-white">bahay</span>
        <span className="text-[#6B9E6E]">go</span>
      </p>
    </div>
  );
}

function PreviewLogoPulse() {
  return (
    <div className="flex h-[180px] items-center justify-center">
      <motion.div
        animate={{
          scale: [1, 1.03, 1],
          filter: [
            "drop-shadow(0 0 0px rgba(212,168,67,0))",
            "drop-shadow(0 0 14px rgba(212,168,67,0.35))",
            "drop-shadow(0 0 0px rgba(212,168,67,0))",
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <BahayGoLogoMark />
      </motion.div>
    </div>
  );
}

function PreviewOffersDocument() {
  return (
    <div className="relative mx-auto flex w-[200px] items-center justify-center py-6">
      <div className="relative w-full rounded-xl border border-white/12 bg-[#2C2C2C] p-3 shadow-xl">
        <motion.span
          className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#6B9E6E]"
          animate={{ opacity: [1, 0.35, 1], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <p className="pr-4 text-[10px] font-bold text-white">Marina View — Offer</p>
        <p className="mt-1 text-[8px] text-white/50">Awaiting client</p>
        <motion.div
          className="mt-3 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1"
          initial={{ x: 8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.2, ease: "easeOut" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#D4A843]">
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-[7px] font-semibold text-white/80">Offer.pdf</span>
        </motion.div>
      </div>
    </div>
  );
}

type Track = "onboarding" | "whatsnew";

type SlideDef = {
  key: string;
  left: ReactNode;
  right: ReactNode;
};

function newPill() {
  return (
    <span className="mb-3 inline-block rounded-full bg-[#D4A843]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#D4A843]">
      New
    </span>
  );
}

function iconWrap(children: ReactNode) {
  return (
    <div className="mb-4 flex h-8 w-8 items-center justify-center text-[#6B9E6E]" aria-hidden>
      {children}
    </div>
  );
}

function buildOnboardingSlides(isClient: boolean): SlideDef[] {
  const s2: SlideDef = isClient
    ? {
        key: "find-home",
        left: (
          <>
            {iconWrap(<Search className="h-7 w-7" strokeWidth={1.75} />)}
            <h2 className="font-sans text-2xl font-bold text-white">Find your perfect home</h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">
              Browse verified listings, save your favorites, and connect with trusted agents across the Philippines.
            </p>
          </>
        ),
        right: <PreviewClientCarousel />,
      }
    : {
        key: "verified",
        left: (
          <>
            {iconWrap(<ShieldCheck className="h-7 w-7" strokeWidth={1.75} />)}
            <h2 className="font-sans text-2xl font-bold text-white">Get verified, get trusted</h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">
              Upload your PRC license, earn the verified badge, and stand out to clients searching for agents they can
              trust.
            </p>
          </>
        ),
        right: <PreviewAgentVerified />,
      };

  const s3Body = isClient
    ? "Start exploring properties. Your next home is one search away."
    : "Post your first listing to start receiving leads. Your dashboard is ready.";

  return [
    {
      key: "pipeline",
      left: (
        <>
          {iconWrap(<GitBranch className="h-7 w-7" strokeWidth={1.75} />)}
          <h2 className="font-sans text-2xl font-bold text-white">Track every deal</h2>
          <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">
            From first inquiry to closed deal — your pipeline keeps everything organized in one place.
          </p>
        </>
      ),
      right: <PreviewKanbanOnboarding />,
    },
    s2,
    {
      key: "ready",
      left: (
        <>
          <div className="mb-4 flex h-8 w-8 items-center justify-center text-[#D4A843]" aria-hidden>
            <Rocket className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h2 className="font-sans text-2xl font-bold text-white">You&apos;re ready</h2>
          <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">{s3Body}</p>
        </>
      ),
      right: <PreviewLogoPulse />,
    },
  ];
}

function buildWhatsNewSlides(): SlideDef[] {
  return [
    {
      key: "pipeline-updates",
      left: (
        <>
          {newPill()}
          <h2 className="font-sans text-2xl font-bold text-white">Your pipeline just got smarter</h2>
          <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">
            Stage pills show dates at a glance. Property photos appear as card backgrounds. Drag deals between stages
            instantly.
          </p>
        </>
      ),
      right: <PreviewKanbanWhatsNew />,
    },
    {
      key: "offers-docs",
      left: (
        <>
          {newPill()}
          <h2 className="font-sans text-2xl font-bold text-white">Send offers, track documents</h2>
          <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">
            Upload offer letters directly from your pipeline. Green dot notifications tell you when clients respond.
          </p>
        </>
      ),
      right: <PreviewOffersDocument />,
    },
    {
      key: "try-now",
      left: (
        <>
          {iconWrap(<ArrowRight className="h-7 w-7" strokeWidth={1.75} />)}
          <h2 className="font-sans text-2xl font-bold text-white">Ready to explore?</h2>
          <p className="mt-3 font-sans text-sm leading-relaxed text-white/70">
            Your updated pipeline is waiting. Try dragging a deal or sending your first offer.
          </p>
        </>
      ),
      right: <PreviewLogoPulse />,
    },
  ];
}

export function PostLoginModal() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [track, setTrack] = useState<Track | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (authLoading || !user?.id || !profile) return;
    const id = window.setTimeout(() => {
      const tutorialDone = profile.tutorial_completed === true;
      const changelogSeen = profile.last_seen_changelog === CHANGELOG_VERSION;
      if (!tutorialDone) {
        setTrack("onboarding");
        setSlideIndex(0);
        setModalOpen(true);
      } else if (!changelogSeen) {
        setTrack("whatsnew");
        setSlideIndex(0);
        setModalOpen(true);
      }
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [
    authLoading,
    user?.id,
    profile?.id,
    profile?.tutorial_completed,
    profile?.last_seen_changelog,
  ]);

  const isClient = profile?.role === "client";
  const slides = useMemo(() => {
    if (track === "onboarding") return buildOnboardingSlides(isClient);
    if (track === "whatsnew") return buildWhatsNewSlides();
    return [];
  }, [track, isClient]);

  const total = slides.length;
  const isLast = slideIndex >= total - 1;

  const persistAndClose = useCallback(async () => {
    if (!user?.id || !track) return;
    if (track === "onboarding") {
      await supabase.from("profiles").update({ tutorial_completed: true }).eq("id", user.id);
    } else {
      await supabase.from("profiles").update({ last_seen_changelog: CHANGELOG_VERSION }).eq("id", user.id);
    }
    await refreshProfile();
    setModalOpen(false);
  }, [user?.id, track, supabase, refreshProfile]);

  const onDismiss = useCallback(() => {
    void persistAndClose();
  }, [persistAndClose]);

  const onNext = useCallback(() => {
    if (!isLast) {
      setSlideIndex((i) => i + 1);
      return;
    }
    void persistAndClose();
  }, [isLast, persistAndClose]);

  const ctaLabel =
    track === "whatsnew" && isLast ? "Let's Go" : isLast ? "Get Started" : "Next";

  const dialogLabel = track === "onboarding" ? "Welcome to BahayGo" : "What's new in BahayGo";

  return (
    <AnimatePresence
      onExitComplete={() => {
        setTrack(null);
        setSlideIndex(0);
      }}
    >
      {modalOpen && track ? (
        <motion.div
          key="post-login-root"
          role="presentation"
          className="fixed inset-0 z-[130] flex items-end justify-center p-0 md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-[rgba(44,44,44,0.85)] backdrop-blur-sm" aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            className="relative z-10 flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none bg-white shadow-2xl md:h-auto md:max-h-[min(560px,90vh)] md:min-h-[420px] md:rounded-2xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{
              opacity: { duration: 0.5, delay: 0.2 },
              y: { duration: 0.5, delay: 0.2, ease: [0, 0, 0.2, 1] },
            }}
          >
            <button
              type="button"
              onClick={onDismiss}
              className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-white/85 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row md:min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${track}-${slideIndex}`}
                  className="flex min-h-0 flex-1 flex-col md:flex-row"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="order-1 flex min-h-0 flex-1 flex-col justify-center bg-[#2C2C2C] px-6 pb-4 pt-10 md:order-none md:w-[45%] md:py-10 md:pl-8 md:pr-6 md:pt-10">
                    {slides[slideIndex]?.left}
                  </div>
                  <div className="order-2 flex min-h-[220px] shrink-0 flex-col items-center justify-center bg-[#1a1a1a] md:order-none md:w-[55%] md:min-h-[280px] md:flex-1">
                    <div className="flex h-full w-full items-center justify-center px-3 py-4">
                      {slides[slideIndex]?.right}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="order-3 flex shrink-0 items-center justify-between border-t border-white/10 bg-[#2C2C2C] px-5 py-4">
              <div className="flex items-center gap-2">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === slideIndex ? "bg-white" : "bg-white/30"
                    }`}
                    aria-hidden
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={onNext}
                className="rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5a8a5d]"
              >
                {ctaLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
