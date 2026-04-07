"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  Shield,
} from "lucide-react";

const STORAGE_KEY = "bahaygo_onboarded";

function CalloutBubble({
  children,
  className,
  pointer = "bottom",
}: {
  children: React.ReactNode;
  className?: string;
  pointer?: "bottom" | "left" | "right" | "top";
}) {
  const pointerClass =
    pointer === "bottom"
      ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-[10px] border-r-[10px] border-t-[12px] border-l-transparent border-r-transparent border-t-[#6B9E6E]"
      : pointer === "top"
        ? "top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-[10px] border-r-[10px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#6B9E6E]"
        : pointer === "left"
          ? "left-0 top-1/2 -translate-x-full -translate-y-1/2 border-t-[10px] border-b-[10px] border-r-[12px] border-t-transparent border-b-transparent border-r-[#6B9E6E]"
          : "right-0 top-1/2 translate-x-full -translate-y-1/2 border-t-[10px] border-b-[10px] border-l-[12px] border-t-transparent border-b-transparent border-l-[#6B9E6E]";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={`relative z-10 max-w-[220px] ${className ?? ""}`}
    >
      <div className="rounded-2xl bg-[#6B9E6E] px-3.5 py-2.5 text-center text-xs font-bold leading-snug text-white shadow-lg shadow-[#6B9E6E]/25">
        {children}
      </div>
      <div className={`absolute h-0 w-0 ${pointerClass}`} aria-hidden />
    </motion.div>
  );
}

function SlideVerifiedAgents() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-1">
      <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">
        Every Agent is PRC Verified ✓
      </h2>
      <div className="relative mt-6 flex min-h-[280px] flex-1 flex-col items-center sm:min-h-[320px]">
        <div className="relative w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#EBE6DC] ring-1 ring-black/10" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold text-[#2C2C2C]">Maria Santos</span>
                <span className="relative inline-flex shrink-0">
                  <motion.span
                    className="absolute -inset-1 rounded-full border-2 border-[#D4A843]"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.9, 0.35, 0.9] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="relative inline-flex items-center gap-1 rounded-full bg-[#D4A843]/20 px-2 py-0.5 text-[11px] font-bold text-[#8a6d32] ring-2 ring-[#D4A843]/40">
                    <BadgeCheck className="h-3.5 w-3.5 text-[#B99333]" aria-hidden />
                    Verified
                  </span>
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-[#2C2C2C]/55">BahayGo Realty · Makati</p>
              <div id="tour-agent-stats" className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/75">
                  24 closings
                </span>
                <span className="rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/75">
                  Score 9.2
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-full bg-[#2C2C2C] py-2.5 text-center text-sm font-semibold text-white">View Profile</div>
        </div>

        <div className="pointer-events-none absolute right-0 top-8 z-20 sm:right-2 sm:top-10">
          <CalloutBubble pointer="left" className="translate-x-1 sm:translate-x-0">
            Look for this badge — it means the agent is licensed by PRC
          </CalloutBubble>
        </div>
        <div className="pointer-events-none absolute -bottom-2 left-1/2 z-20 -translate-x-1/2 sm:bottom-4">
          <CalloutBubble pointer="top" className="translate-y-2">
            Check their score and number of closings
          </CalloutBubble>
        </div>
      </div>
    </div>
  );
}

function SlideAgentProfiles() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-1">
      <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">Browse Agent Profiles</h2>
      <div className="relative mt-6 flex min-h-[300px] flex-1 flex-col sm:min-h-[340px]">
        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/80 p-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-white bg-white p-3 shadow-sm">
              <div className="flex gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-[#EBE6DC]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#2C2C2C]">Modern loft · BGC</p>
                  <p className="text-xs font-semibold text-[#2C2C2C]/50">₱85,000/mo · 2 bed</p>
                </div>
              </div>
            </div>
          ))}
          <p className="text-center text-[11px] font-semibold text-[#2C2C2C]/45">+ more listings on full profile</p>
        </div>

        <div className="pointer-events-none absolute -left-1 top-24 z-20 sm:left-0">
          <CalloutBubble pointer="right" className="max-w-[200px]">
            See all their active listings in one place
          </CalloutBubble>
        </div>
        <div className="pointer-events-none absolute bottom-16 right-0 z-20 sm:bottom-20">
          <CalloutBubble pointer="left" className="max-w-[210px]">
            <span className="flex flex-wrap items-center justify-center gap-1">
              Contact them directly via
              <MessageCircle className="inline h-3.5 w-3.5 shrink-0" aria-hidden />
              WhatsApp,
              <Phone className="inline h-3.5 w-3.5 shrink-0" aria-hidden />
              SMS or
              <Mail className="inline h-3.5 w-3.5 shrink-0" aria-hidden />
              Email
            </span>
          </CalloutBubble>
        </div>
      </div>
    </div>
  );
}

function SlideViewing() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-1">
      <h2 className="font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">Schedule Viewings Instantly</h2>
      <div className="relative mt-6 flex min-h-[300px] flex-1 flex-col items-center sm:min-h-[340px]">
        <div className="w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-md">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Request a viewing</p>
          <div className="mt-4 grid gap-3">
            <label className="block text-xs font-semibold text-[#2C2C2C]/55">
              Preferred date
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]">
                <Calendar className="h-4 w-4 text-[#6B9E6E]" aria-hidden />
                Apr 12, 2026
              </div>
            </label>
            <label className="block text-xs font-semibold text-[#2C2C2C]/55">
              Time
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold text-[#2C2C2C]">
                <Clock className="h-4 w-4 text-[#6B9E6E]" aria-hidden />
                2:00 PM
              </div>
            </label>
            <button
              type="button"
              className="mt-2 w-full rounded-full bg-[#6B9E6E] py-3 text-sm font-bold text-white"
              tabIndex={-1}
            >
              Send request
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute right-0 top-28 z-20 sm:right-2">
          <CalloutBubble pointer="left" className="max-w-[200px]">
            Pick a date and time that works for you
          </CalloutBubble>
        </div>
        <div className="pointer-events-none absolute bottom-8 left-0 z-20 sm:bottom-12">
          <CalloutBubble pointer="right" className="max-w-[220px]">
            Agent gets notified immediately by SMS and email
          </CalloutBubble>
        </div>
      </div>
    </div>
  );
}

function SlideZeroScams() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 text-center">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-[#6B9E6E]/15 ring-4 ring-[#D4A843]/35"
      >
        <Shield className="h-14 w-14 text-[#6B9E6E]" strokeWidth={1.25} aria-hidden />
      </motion.div>
      <h2 className="mt-8 font-serif text-xl font-bold leading-tight text-[#2C2C2C] sm:text-2xl">
        Zero Scams. Zero Fake Listings. 🛡️
      </h2>
      <p className="mt-4 max-w-md text-sm font-semibold leading-relaxed text-[#2C2C2C]/65">
        Every listing on BahayGo is verified. Every agent is licensed. If something looks wrong, report it.
      </p>
    </div>
  );
}

const SLIDE_KEYS = ["verified", "profiles", "viewing", "trust"] as const;

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
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(92vh,880px)] sm:rounded-3xl sm:shadow-2xl sm:ring-1 sm:ring-[#2C2C2C]/10"
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
              className="flex min-h-[min(60vh,520px)] flex-1 flex-col sm:min-h-[420px]"
            >
              {idx === 0 ? <SlideVerifiedAgents /> : null}
              {idx === 1 ? <SlideAgentProfiles /> : null}
              {idx === 2 ? <SlideViewing /> : null}
              {idx === 3 ? <SlideZeroScams /> : null}
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
