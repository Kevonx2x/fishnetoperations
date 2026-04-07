"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, ChevronLeft, ChevronRight, Home, Shield, X } from "lucide-react";
import { BahayGoLogoLink } from "@/components/marketplace/bahaygo-logo";
import { FinnMascot } from "@/components/marketplace/mascots/finn-mascot";

const STORAGE_KEY = "bahaygo_onboarded";

const SLIDES = [
  {
    key: "welcome",
    title: "Welcome to BahayGo 🏠",
    subtitle: "The Philippines' trusted real estate platform",
    visual: "logo" as const,
  },
  {
    key: "buyers",
    title: "Find Your Perfect Home",
    body: "Browse verified listings across Metro Manila, Cebu, and beyond. Every listing is real. Every agent is licensed.",
    visual: "house" as const,
  },
  {
    key: "agents",
    title: "Are You a Real Estate Agent?",
    body: "Join BahayGo to showcase your listings, get leads, and grow your business. Free to start.",
    visual: "badge" as const,
    cta: { href: "/auth/signup", label: "Join as Agent" },
  },
  {
    key: "trust",
    title: "Zero Scams. Zero Fake Listings.",
    body: "Every agent on BahayGo is PRC-verified. Every listing is reviewed. Your safety is our priority.",
    visual: "shield" as const,
  },
];

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
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    if (idx < SLIDES.length - 1) setIdx((i) => i + 1);
    else finish();
  }, [idx, finish]);

  const prev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  if (!mounted || !open) return null;

  const slide = SLIDES[idx]!;
  const isLast = idx === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-[#2C2C2C]/10"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm font-semibold text-[#2C2C2C]/55 underline-offset-2 hover:text-[#2C2C2C] hover:underline"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={finish}
            className="rounded-full p-2 text-[#2C2C2C]/45 hover:bg-[#FAF8F4]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={slide.key}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="min-h-[280px]"
          >
            <div className="mb-6 flex justify-center">
              {slide.visual === "logo" ? (
                <div className="flex flex-col items-center gap-3">
                  <BahayGoLogoLink />
                  <FinnMascot mood="happy" size={88} />
                </div>
              ) : null}
              {slide.visual === "house" ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#6B9E6E]/15">
                  <Home className="h-10 w-10 text-[#6B9E6E]" />
                </div>
              ) : null}
              {slide.visual === "badge" ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#D4A843]/15">
                  <BadgeCheck className="h-10 w-10 text-[#D4A843]" />
                </div>
              ) : null}
              {slide.visual === "shield" ? (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#6B9E6E]/12">
                  <Shield className="h-10 w-10 text-[#6B9E6E]" />
                </div>
              ) : null}
            </div>

            <h2 className="text-center font-serif text-2xl font-bold leading-tight text-[#2C2C2C]">{slide.title}</h2>
            {"subtitle" in slide && slide.subtitle ? (
              <p className="mt-3 text-center text-sm font-semibold text-[#2C2C2C]/70">{slide.subtitle}</p>
            ) : null}
            {"body" in slide && slide.body ? (
              <p className="mt-4 text-center text-sm font-semibold leading-relaxed text-[#2C2C2C]/65">{slide.body}</p>
            ) : null}
            {"cta" in slide && slide.cta ? (
              <div className="mt-6 flex justify-center">
                <Link
                  href={slide.cta.href}
                  className="inline-flex rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
                >
                  {slide.cta.label}
                </Link>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${
                i === idx ? "w-8 bg-[#6B9E6E]" : "w-2 bg-[#2C2C2C]/20 hover:bg-[#2C2C2C]/35"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 rounded-full border border-[#2C2C2C]/15 px-3 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              className="inline-flex items-center gap-1 rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
            >
              Get Started
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60]"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
