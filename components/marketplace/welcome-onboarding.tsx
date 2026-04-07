"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  Shield,
} from "lucide-react";

const STORAGE_KEY = "bahaygo_onboarded";

/** Unsplash face crops for mock agent avatars */
const MOCK_AVATARS = [
  "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
] as const;

const MOCK_LISTING_IMG =
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=520&fit=crop";

function SlideWelcome() {
  const bullets = [
    "Verified agents only",
    "Real listings, zero scams",
    "Find your home in minutes",
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white px-2 py-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center"
      >
        <Image
          src="/bahaygologo.png"
          alt="BahayGo"
          width={180}
          height={72}
          className="h-auto w-[180px] object-contain"
          priority
          sizes="180px"
        />
        <h2 className="mt-8 max-w-md font-serif text-2xl font-bold leading-tight tracking-tight text-[#2C2C2C] sm:text-3xl">
          Welcome to BahayGo! 🏠
        </h2>
        <p className="mt-3 max-w-md text-base font-semibold text-[#2C2C2C]/65 sm:text-lg">
          The Philippines&apos; Trusted Real Estate Platform
        </p>
        <ul className="mt-10 w-full max-w-sm space-y-3.5 text-left">
          {bullets.map((line) => (
            <li key={line} className="flex items-center gap-3 text-sm font-semibold text-[#2C2C2C]/85 sm:text-base">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#6B9E6E]" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}

/** Mascot-style tip: white bubble, sage border, tail at bottom-left (guide “speaking”). */
function GuideSpeechBubble({ text, className }: { text: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`relative max-w-[220px] sm:max-w-[240px] ${className ?? ""}`}
    >
      <div className="relative rounded-2xl border-2 border-[#6B9E6E] bg-white px-3.5 py-2.5 shadow-md shadow-black/8">
        <p className="text-left text-[11px] font-bold leading-snug text-[#2C2C2C] sm:text-xs">{text}</p>
      </div>
      {/* Bottom-left pointer */}
      <div
        className="pointer-events-none absolute -bottom-[7px] left-4 h-0 w-0 border-l-[8px] border-r-[8px] border-t-[9px] border-l-transparent border-r-transparent border-t-[#6B9E6E]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[3px] left-[calc(1rem+2px)] h-0 w-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-white"
        aria-hidden
      />
    </motion.div>
  );
}

function MockAgentCard({
  name,
  avatarUrl,
  score,
  closings,
  broker,
  highlightBadge,
  highlightStats,
}: {
  name: string;
  avatarUrl: string;
  score: string;
  closings: number;
  broker: string;
  highlightBadge?: boolean;
  highlightStats?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#2C2C2C]/10 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
          <Image src={avatarUrl} alt="" width={48} height={48} className="object-cover" sizes="48px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-[#2C2C2C]">{name}</span>
            <span
              className={`relative inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#D4A843]/20 px-2 py-0.5 text-[10px] font-bold text-[#8a6d32] ${
                highlightBadge ? "ring-2 ring-[#D4A843] ring-offset-1" : ""
              }`}
            >
              <BadgeCheck className="h-3 w-3 text-[#B99333]" aria-hidden />
              Verified
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#2C2C2C]/50">{broker}</p>
          <div
            className={`mt-2 flex flex-wrap gap-1.5 ${highlightStats ? "rounded-lg ring-2 ring-[#D4A843]/60 ring-offset-1" : ""}`}
          >
            <span className="rounded-full bg-[#6B9E6E]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#2C2C2C]/80">
              {closings} closings
            </span>
            <span className="rounded-full bg-[#6B9E6E]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#2C2C2C]/80">
              Score {score}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-full bg-[#2C2C2C] py-2 text-center text-[11px] font-bold text-white">View Profile</div>
    </div>
  );
}

function SlideFindVerifiedAgents() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">Find Verified Agents</h2>
      <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/50">Directory — like in the app</p>

      <div className="relative mt-4 min-h-[300px] flex-1 sm:min-h-[340px]">
        {/* App chrome */}
        <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-[1.75rem] border-[10px] border-[#2C2C2C] bg-[#FAF8F4] shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
          <div className="border-b border-black/5 bg-white px-3 py-2.5">
            <div className="mx-auto h-1 w-24 rounded-full bg-black/10" />
          </div>
          <div className="max-h-[280px] space-y-2.5 overflow-y-auto px-2.5 py-3 sm:max-h-[300px]">
            <MockAgentCard
              name="Ana Reyes"
              avatarUrl={MOCK_AVATARS[0]!}
              score="9.2"
              closings={24}
              broker="BahayGo Realty · Makati"
              highlightBadge
              highlightStats
            />
            <MockAgentCard name="James Lim" avatarUrl={MOCK_AVATARS[1]!} score="8.7" closings={18} broker="Metro Homes · BGC" />
            <MockAgentCard name="Miguel Cruz" avatarUrl={MOCK_AVATARS[2]!} score="9.0" closings={31} broker="Cebu Prime · Lahug" />
          </div>
        </div>

        <div className="pointer-events-none absolute -right-1 top-2 z-20 sm:right-0 sm:top-4">
          <GuideSpeechBubble text="PRC Licensed & Verified" />
        </div>
        <div className="pointer-events-none absolute bottom-6 left-0 z-20 sm:bottom-10">
          <GuideSpeechBubble text="Real closing history" />
        </div>
      </div>
    </div>
  );
}

function SlideAgentProfileFeed() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">View Their Full Profile</h2>
      <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/50">Feed-style profile preview</p>

      <div className="relative mt-4 min-h-[300px] flex-1 sm:min-h-[360px]">
        <div className="relative mx-auto max-w-[340px] scale-[0.92] overflow-hidden rounded-[1.75rem] border-[10px] border-[#2C2C2C] bg-[#E8E4DC] shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:scale-100">
          {/* Cover */}
          <div className="relative h-24 w-full bg-gradient-to-br from-[#6B9E6E]/40 to-[#D4A843]/30" />
          {/* Header card */}
          <div className="relative -mt-8 px-3 pb-3">
            <div className="rounded-2xl border border-white/80 bg-white p-3 shadow-md">
              <div className="flex gap-3">
                <div className="relative -mt-10 h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-md ring-1 ring-black/10">
                  <Image src={MOCK_AVATARS[0]!} alt="" width={64} height={64} className="object-cover" sizes="64px" />
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold text-[#2C2C2C]">Ana Reyes</span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[#D4A843]/20 px-2 py-0.5 text-[10px] font-bold text-[#8a6d32]">
                      <BadgeCheck className="h-3 w-3" aria-hidden />
                      Verified
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/50">Licensed · Makati</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-black/5 pt-3">
                <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/75">24 listings</span>
                <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-[11px] font-bold text-[#2C2C2C]/75">Score 9.2</span>
              </div>
            </div>
          </div>
          {/* Listing post */}
          <div className="mx-2 mb-3 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-black/5">
              <Image src={MOCK_LISTING_IMG} alt="" fill className="object-cover" sizes="320px" />
            </div>
            <p className="mt-2 text-sm font-bold text-[#2C2C2C]">Sunny 2BR in BGC</p>
            <p className="text-xs font-semibold text-[#D4A843]">₱12,500,000 · 2 bed · 2 bath</p>
          </div>
          {/* Contact bar */}
          <div className="mx-2 mb-3 flex gap-1.5 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
            <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#25D366]/15 py-2 text-[10px] font-bold text-[#128C7E]">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              WhatsApp
            </span>
            <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#6B9E6E]/12 py-2 text-[10px] font-bold text-[#2C2C2C]">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              SMS
            </span>
            <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#2C2C2C]/8 py-2 text-[10px] font-bold text-[#2C2C2C]">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute -left-2 top-28 z-20 sm:left-0 sm:top-32">
          <GuideSpeechBubble text="See all their listings" />
        </div>
        <div className="pointer-events-none absolute -right-2 bottom-8 z-20 sm:right-0 sm:bottom-12">
          <GuideSpeechBubble text="Contact directly via WhatsApp, SMS or Email" />
        </div>
      </div>
    </div>
  );
}

function SlideScheduleViewing() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">Schedule a Viewing</h2>
      <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/50">Property zoom — request & agents</p>

      <div className="relative mt-4 min-h-[300px] flex-1 sm:min-h-[360px]">
        <div className="relative mx-auto max-w-[340px] overflow-hidden rounded-[1.75rem] border-[10px] border-[#2C2C2C] bg-black/80 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
          <div className="relative aspect-[4/3] w-full bg-black/40">
            <Image src={MOCK_LISTING_IMG} alt="" fill className="object-cover opacity-95" sizes="340px" />
            <div className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-[#2C2C2C] shadow">
              <span className="block h-3 w-3 rounded-full border-2 border-current" />
            </div>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className={`h-1.5 rounded-full ${i === 0 ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto rounded-t-2xl bg-white px-3 pb-3 pt-2">
            <p className="font-serif text-base font-bold text-[#2C2C2C]">Sunny 2BR in BGC</p>
            <p className="mt-0.5 font-serif text-lg font-bold text-[#D4A843]">₱12,500,000</p>
            <p className="mt-1 text-[11px] font-semibold text-[#2C2C2C]/65">2 beds · 2 baths · 86 sqm</p>

            <button
              type="button"
              className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] py-3 text-sm font-bold text-white shadow-md"
              tabIndex={-1}
            >
              <Calendar className="h-4 w-4" aria-hidden />
              Request Viewing
            </button>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Meet an agent</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {MOCK_AVATARS.map((url, i) => (
                <div
                  key={url}
                  className={`flex shrink-0 flex-col items-center gap-1 rounded-xl border p-2 ${
                    i === 0 ? "border-[#D4A843] bg-[#D4A843]/10 ring-2 ring-[#D4A843]/40" : "border-[#2C2C2C]/10 bg-[#FAF8F4]"
                  }`}
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-black/10">
                    <Image src={url} alt="" width={40} height={40} className="object-cover" sizes="40px" />
                  </div>
                  <span className="max-w-[56px] truncate text-[9px] font-bold text-[#2C2C2C]">
                    {["Ana", "James", "Miguel"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-0 top-[52%] z-20 sm:top-[50%]">
          <GuideSpeechBubble text="Pick your preferred date and time" />
        </div>
        <div className="pointer-events-none absolute bottom-16 left-0 z-20 sm:bottom-20">
          <GuideSpeechBubble text="Choose which agent to meet" />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-8 z-20 -translate-x-1/2 sm:top-10">
          <GuideSpeechBubble text="Agent gets notified instantly" />
        </div>
      </div>
    </div>
  );
}

function SlideZeroScams() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 text-center">
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-[#6B9E6E]/20 to-[#D4A843]/25 ring-4 ring-[#D4A843]/40"
      >
        <Shield className="h-16 w-16 text-[#6B9E6E]" strokeWidth={1.15} aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D4A843] shadow-lg ring-2 ring-white/90">
            <BadgeCheck className="h-7 w-7 text-white" strokeWidth={2.5} aria-hidden />
          </div>
        </div>
      </motion.div>
      <h2 className="mt-8 font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">Zero Scams Guaranteed</h2>
      <ul className="mt-6 w-full max-w-sm space-y-3 text-left">
        <li className="flex gap-3 rounded-xl border border-[#2C2C2C]/8 bg-[#FAF8F4]/90 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="text-sm font-semibold text-[#2C2C2C]/85">Every agent is PRC licensed</span>
        </li>
        <li className="flex gap-3 rounded-xl border border-[#2C2C2C]/8 bg-[#FAF8F4]/90 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="text-sm font-semibold text-[#2C2C2C]/85">Every listing is reviewed</span>
        </li>
        <li className="flex gap-3 rounded-xl border border-[#2C2C2C]/8 bg-[#FAF8F4]/90 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#6B9E6E]" aria-hidden />
          <span className="text-sm font-semibold text-[#2C2C2C]/85">Report suspicious activity instantly</span>
        </li>
      </ul>
    </div>
  );
}

const SLIDE_KEYS = ["welcome", "verified", "profiles", "viewing", "trust"] as const;

export function WelcomeOnboarding() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    if (idx < SLIDE_KEYS.length - 1) setIdx((i) => i + 1);
  }, [idx]);

  const prev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  const goToDot = useCallback(
    (i: number) => {
      if (i < idx) setIdx(i);
    },
    [idx],
  );

  if (!mounted || !open) return null;

  const isLast = idx === SLIDE_KEYS.length - 1;
  const progress = ((idx + 1) / SLIDE_KEYS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-heading"
      aria-describedby="welcome-tour-desc"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(92vh,900px)] sm:rounded-3xl sm:shadow-2xl sm:ring-1 sm:ring-[#2C2C2C]/10"
      >
        <div className="shrink-0 border-b border-[#2C2C2C]/10 px-4 pb-3 pt-4 sm:px-8 sm:pt-6">
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#2C2C2C]/55">
            <span>
              Slide {idx + 1} of {SLIDE_KEYS.length}
            </span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#2C2C2C]/10">
            <motion.div
              className="h-full rounded-full bg-[#6B9E6E]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
          <h2 id="welcome-tour-heading" className="sr-only">
            BahayGo guided tour — step {idx + 1} of {SLIDE_KEYS.length}
          </h2>
          <span id="welcome-tour-desc" className="sr-only">
            Guided tour of BahayGo. Use Next and Back to navigate. On the last step, choose Get Started to continue.
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={SLIDE_KEYS[idx]}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.25 }}
              className="flex min-h-[min(58vh,500px)] flex-1 flex-col sm:min-h-[440px]"
            >
              {idx === 0 ? <SlideWelcome /> : null}
              {idx === 1 ? <SlideFindVerifiedAgents /> : null}
              {idx === 2 ? <SlideAgentProfileFeed /> : null}
              {idx === 3 ? <SlideScheduleViewing /> : null}
              {idx === 4 ? <SlideZeroScams /> : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-[#2C2C2C]/10 px-4 py-4 sm:px-8">
          {SLIDE_KEYS.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => goToDot(i)}
              disabled={i >= idx}
              className={`h-2.5 rounded-full transition-all ${
                i === idx
                  ? "w-9 bg-[#6B9E6E]"
                  : i < idx
                    ? "w-2.5 cursor-pointer bg-[#6B9E6E]/45 hover:bg-[#6B9E6E]/70"
                    : "w-2.5 cursor-not-allowed bg-[#2C2C2C]/15 opacity-50"
              }`}
              aria-label={
                i < idx
                  ? `Go back to slide ${i + 1}`
                  : i === idx
                    ? `Current slide ${i + 1}`
                    : `Slide ${i + 1} not available yet`
              }
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#2C2C2C]/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/15 px-4 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              className="inline-flex items-center gap-1 rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
            >
              Get Started
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60]"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
