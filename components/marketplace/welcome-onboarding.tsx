"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pin,
  Shield,
  Sparkles,
  Star,
  X,
} from "lucide-react";

const STORAGE_KEY = "bahaygo_onboarded";

const TOTAL_SLIDES = 5;

type OnboardRole = "client" | "agent";

const IMG_ANA_REYES = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&q=80";
const IMG_JAMES_LIM = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&q=80";
const IMG_MARIA_SANTOS = "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&q=80";
const IMG_LISTING_HERO = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80";
const IMG_WISH_HOME1 = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=200&q=80";
const IMG_WISH_HOME2 = "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=200&q=80";
const IMG_WISH_HOME3 = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&q=80";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  active: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

function SpeechBubble({
  children,
  className,
  pointer = "bottom-left",
}: {
  children: React.ReactNode;
  className?: string;
  pointer?: "bottom-left" | "top-right" | "bottom-right";
}) {
  const pointerCls =
    pointer === "bottom-left"
      ? "bottom-0 left-4 -translate-y-full border-b-0 border-l-transparent border-r-transparent border-t-[#6B9E6E]"
      : pointer === "top-right"
        ? "right-3 top-full -translate-y-px border-l-transparent border-r-transparent border-t-white border-t-[10px] border-[#6B9E6E]"
        : "bottom-0 right-4 -translate-y-full border-b-0 border-l-transparent border-r-transparent border-t-[#6B9E6E]";

  return (
    <div className={`relative z-10 ${className ?? ""}`}>
      <div className="relative rounded-xl border-2 border-[#6B9E6E] bg-white px-2.5 py-1.5 text-[10px] font-bold leading-tight text-[#2C2C2C] shadow-md sm:text-[11px]">
        {children}
      </div>
      <div
        className={`pointer-events-none absolute h-0 w-0 border-[7px] ${pointerCls}`}
        aria-hidden
      />
    </div>
  );
}

function ChangeRoleLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 w-full shrink-0 text-left text-xs font-semibold text-[#6B9E6E] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843] sm:text-sm"
    >
      ← Change role
    </button>
  );
}

function RoleCard({
  title,
  description,
  emoji,
  disabled,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  emoji: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-all sm:gap-3 sm:p-5 ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-50/80 opacity-55"
          : selected
            ? "border-[#6B9E6E] bg-[#6B9E6E]/12 shadow-md ring-2 ring-[#6B9E6E]/30"
            : "border-[#2C2C2C]/12 bg-white shadow-sm hover:border-[#6B9E6E]/50 hover:bg-[#6B9E6E]/5 hover:shadow-md"
      }`}
    >
      <span className="text-2xl sm:text-3xl" aria-hidden>
        {emoji}
      </span>
      <span className="font-serif text-base font-bold text-[#2C2C2C] sm:text-lg">{title}</span>
      <span className="line-clamp-2 text-xs text-[#2C2C2C]/55 sm:text-sm">{description}</span>
      {disabled ? (
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Coming Soon
        </span>
      ) : null}
    </button>
  );
}

/** Browser / phone frame for mockups */
function DeviceFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className={`mx-auto w-full max-w-[340px] overflow-hidden rounded-[1.25rem] border-[6px] border-[#2C2C2C] bg-[#2C2C2C] shadow-xl shadow-[#6B9E6E]/15 ring-1 ring-black/10 ${className ?? ""}`}
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#2C2C2C] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
        <div className="ml-2 flex-1 rounded-md bg-white/10 py-1 text-center text-[9px] font-medium text-white/70">bahaygo.com</div>
      </div>
      <div className="max-h-[220px] overflow-hidden bg-gradient-to-b from-[#FAF8F4] to-white sm:max-h-[240px]">{children}</div>
    </motion.div>
  );
}

function AgentSlideProfile() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 text-center">
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C] sm:text-2xl">Your Professional Profile</h2>
        <p className="mt-2 text-sm leading-snug text-[#2C2C2C]/65 sm:text-base">
          Showcase your listings like a pro. Clients find you, verify you, and contact you directly.
        </p>
      </div>
      <div className="relative mx-auto w-full min-h-0 flex-1">
        <DeviceFrame>
          <div className="p-3">
            <div className="flex items-start gap-3">
              <div className="relative h-14 w-14 shrink-0">
                <Image
                  src={IMG_ANA_REYES}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-white"
                  sizes="56px"
                />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-[#D4A843] p-0.5 shadow">
                  <BadgeCheck className="h-3.5 w-3.5 text-white" aria-hidden />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-bold text-[#2C2C2C]">Ana Reyes</span>
                  <span className="rounded-full bg-[#6B9E6E] px-1.5 py-0.5 text-[9px] font-bold text-white">PRC ✓</span>
                </div>
                <p className="text-[10px] text-[#2C2C2C]/50">BahayGo Realty · Score 9.2</p>
              </div>
            </div>
            <div className="mt-3 space-y-2 rounded-xl border border-[#2C2C2C]/8 bg-white p-2 shadow-sm">
              <div className="relative h-16 w-full overflow-hidden rounded-lg">
                <Image
                  src={IMG_LISTING_HERO}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="280px"
                />
              </div>
              <p className="text-[11px] font-bold text-[#2C2C2C]">BGC 2BR · ₱45k/mo</p>
            </div>
          </div>
        </DeviceFrame>
        <div className="pointer-events-none absolute right-0 top-8 sm:top-10">
          <SpeechBubble pointer="bottom-left" className="max-w-[130px]">
            PRC Verified ✓
          </SpeechBubble>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-0 sm:bottom-8">
          <SpeechBubble pointer="top-right" className="max-w-[150px]">
            Your listings, beautifully presented
          </SpeechBubble>
        </div>
      </div>
    </div>
  );
}

function AgentSlideVerified() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden bg-gradient-to-b from-[#6B9E6E]/[0.07] to-transparent px-1">
      <div className="shrink-0 text-center">
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C] sm:text-2xl">Get Verified. Get Trusted.</h2>
        <p className="mt-2 text-sm leading-snug text-[#2C2C2C]/65 sm:text-base">
          Submit your PRC license. Our team verifies you within 24 hours. Verified agents get 3x more leads.
        </p>
      </div>
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#D4A843] to-[#b8922e] shadow-lg shadow-[#D4A843]/35 ring-4 ring-[#D4A843]/25"
      >
        <Shield className="h-12 w-12 text-white" strokeWidth={1.25} aria-hidden />
        <BadgeCheck className="absolute bottom-1 right-1 h-8 w-8 text-white drop-shadow-md" aria-hidden />
      </motion.div>
      <div className="w-full max-w-sm space-y-2 rounded-2xl border border-[#2C2C2C]/10 bg-white/90 p-3 shadow-sm">
        <p className="text-center text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">Score breakdown</p>
          <div className="flex flex-col gap-1.5 text-xs font-semibold text-[#2C2C2C]/85">
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 fill-[#D4A843] text-[#D4A843]" aria-hidden />
            <span>9.0–10.0 = Elite</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 fill-[#D4A843]/70 text-[#D4A843]" aria-hidden />
            <span>7.0–8.9 = Experienced</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 fill-[#D4A843]/45 text-[#D4A843]" aria-hidden />
            <span>5.0–6.9 = Growing</span>
          </div>
        </div>
      </div>
      <SpeechBubble className="mx-auto max-w-[240px]" pointer="bottom-right">
        Only verified agents appear on listings
      </SpeechBubble>
    </div>
  );
}

function AgentSlidePipeline() {
  const cols = [
    { title: "New Lead", card: { name: "J. Cruz", prop: "BGC Condo", date: "Apr 8" } },
    { title: "Viewing", card: { name: "M. Santos", prop: "Makati", date: "Apr 9" } },
    { title: "Negotiating", card: { name: "L. Tan", prop: "Cebu", date: "Apr 10" } },
    { title: "Closed", card: { name: "R. Go", prop: "Pasig", date: "Apr 12" } },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 text-center">
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C] sm:text-2xl">Manage Every Deal in One Place</h2>
        <p className="mt-2 text-sm leading-snug text-[#2C2C2C]/65 sm:text-base">
          Leads come to you automatically. Track viewings, follow up, and close deals — all from your dashboard.
        </p>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#2C2C2C] p-3 shadow-inner ring-1 ring-white/10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Pipeline</span>
          <span className="rounded-full border border-[#D4A843]/50 bg-[#D4A843]/15 px-2 py-0.5 text-[9px] font-bold text-[#D4A843]">
            AI Deal Assistant · Soon
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {cols.map((c) => (
            <div key={c.title} className="flex w-[72px] shrink-0 flex-col gap-1.5 sm:w-[80px]">
              <p className="text-center text-[9px] font-bold text-[#6B9E6E]">{c.title}</p>
              <div className="rounded-lg border border-white/10 bg-white/5 p-1.5 shadow-sm">
                <p className="truncate text-[9px] font-bold text-white">{c.card.name}</p>
                <p className="truncate text-[8px] text-white/55">{c.card.prop}</p>
                <p className="mt-1 text-[8px] text-[#D4A843]">{c.card.date}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 text-[9px] font-semibold text-[#6B9E6E]">
          <Sparkles className="h-3 w-3" aria-hidden />
          Kanban view
        </div>
      </div>
    </div>
  );
}

function ClientSlideWishlist() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 text-center">
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C] sm:text-2xl">Your Personal Home Wishlist</h2>
        <p className="mt-2 text-sm leading-snug text-[#2C2C2C]/65 sm:text-base">
          Pin properties you love. Build your wishlist. Share it with agents so they find your perfect match.
        </p>
      </div>
      <div className="relative mx-auto w-full">
        <DeviceFrame>
          <div className="p-3">
            <div className="flex items-center gap-2 border-b border-[#2C2C2C]/8 pb-2">
              <Image
                src={IMG_MARIA_SANTOS}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white"
                sizes="40px"
              />
              <div>
                <p className="text-sm font-bold text-[#2C2C2C]">Maria Santos</p>
                <p className="text-[10px] text-[#2C2C2C]/50">12 pins · Quezon City</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                { src: IMG_WISH_HOME1, label: "BGC Studio" },
                { src: IMG_WISH_HOME2, label: "Makati Loft" },
                { src: IMG_WISH_HOME3, label: "Ortigas 2BR" },
              ].map(({ src, label }) => (
                <div key={label} className="relative overflow-hidden rounded-lg bg-[#2C2C2C]/5">
                  <Pin className="absolute right-1 top-1 z-[1] h-3 w-3 text-[#D4A843]" aria-hidden />
                  <div className="relative h-14 w-full">
                    <Image src={src} alt="" fill className="object-cover" sizes="100px" />
                  </div>
                  <p className="p-1 text-center text-[8px] font-bold leading-tight text-[#2C2C2C]/90">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-semibold text-[#2C2C2C]/55">
              <Heart className="h-3.5 w-3.5 fill-red-400 text-red-400" aria-hidden />
              24 liked
            </div>
          </div>
        </DeviceFrame>
        <div className="pointer-events-none absolute -right-1 top-16 z-10 sm:right-0">
          <SpeechBubble pointer="bottom-left" className="max-w-[120px]">
            Pin to save to your profile
          </SpeechBubble>
        </div>
        <div className="pointer-events-none absolute bottom-10 left-0 z-10">
          <SpeechBubble pointer="top-right" className="max-w-[150px]">
            Your saved homes, all in one place
          </SpeechBubble>
        </div>
      </div>
    </div>
  );
}

const MOCK_AGENTS = [
  { name: "Ana Reyes", score: "9.4", closings: 156, photo: IMG_ANA_REYES },
  { name: "James Lim", score: "9.2", closings: 142, photo: IMG_JAMES_LIM },
  { name: "Rico Mendoza", score: "9.0", closings: 128, photo: IMG_MARIA_SANTOS },
] as const;

function ClientSlideAgents() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-hidden bg-gradient-to-b from-[#D4A843]/[0.06] to-transparent">
      <div className="shrink-0 text-center">
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C] sm:text-2xl">Every Agent is PRC Verified</h2>
        <p className="mt-2 text-sm leading-snug text-[#2C2C2C]/65 sm:text-base">
          No fake agents. No scams. Every agent on BahayGo has been verified against the PRC registry.
        </p>
      </div>
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#D4A843] to-[#a88430] shadow-lg ring-4 ring-[#D4A843]/25"
      >
        <BadgeCheck className="h-9 w-9 text-white" aria-hidden />
      </motion.div>
      <div className="flex w-full max-w-full gap-2 overflow-x-auto pb-1 scrollbar-hide sm:justify-center sm:overflow-visible">
        {MOCK_AGENTS.map((a, i) => (
          <div
            key={i}
            className="w-[100px] shrink-0 rounded-xl border border-[#2C2C2C]/10 bg-white p-2 shadow-md sm:w-[108px]"
          >
            <Image
              src={a.photo}
              alt=""
              width={40}
              height={40}
              className="mx-auto h-10 w-10 rounded-full object-cover ring-2 ring-white"
              sizes="40px"
            />
            <p className="mt-1 truncate text-center text-[10px] font-bold text-[#2C2C2C]">{a.name}</p>
            <div className="mt-0.5 flex justify-center">
              <span className="rounded bg-[#6B9E6E]/15 px-1 py-px text-[8px] font-bold text-[#6B9E6E]">✓</span>
            </div>
            <p className="mt-0.5 text-center text-[8px] font-semibold text-[#2C2C2C]/60">
              {a.closings} · {a.score}
            </p>
          </div>
        ))}
      </div>
      <SpeechBubble className="mx-auto max-w-[220px]" pointer="bottom-left">
        Check their score and closing history
      </SpeechBubble>
    </div>
  );
}

function ClientSlideViewing() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 text-center">
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C] sm:text-2xl">Book Viewings Instantly</h2>
        <p className="mt-2 text-sm leading-snug text-[#2C2C2C]/65 sm:text-base">
          See a property you love? Request a viewing in 30 seconds. The agent gets notified instantly by SMS and email.
        </p>
      </div>
      <div className="relative mx-auto w-full max-w-[320px]">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-lg">
          <p className="text-xs font-bold text-[#6B9E6E]">Request a viewing</p>
          <div className="mt-3 flex justify-between gap-1">
            {["M", "T", "W", "T", "F"].map((d, i) => (
              <div
                key={d + i}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-bold ${
                  i === 2 ? "border-[#6B9E6E] bg-[#6B9E6E] text-white" : "border-[#2C2C2C]/15 text-[#2C2C2C]/60"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#FAF8F4] px-2 py-1.5 text-[10px] font-semibold text-[#2C2C2C]">
            <Calendar className="h-3.5 w-3.5 text-[#6B9E6E]" aria-hidden />
            Apr 12 · 2:00 PM
          </div>
          <p className="mt-3 text-[10px] font-semibold text-[#2C2C2C]/50">Meet an agent</p>
          <div className="mt-1 flex gap-2">
            {[
              { photo: IMG_ANA_REYES, short: "Ana" },
              { photo: IMG_JAMES_LIM, short: "James" },
            ].map(({ photo, short }) => (
              <div key={short} className="flex flex-1 flex-col items-center rounded-lg border border-[#2C2C2C]/10 bg-[#FAF8F4] p-1.5">
                <Image
                  src={photo}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                  sizes="28px"
                />
                <span className="mt-0.5 text-[8px] font-bold text-[#2C2C2C]">{short}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-2 top-12 z-10">
          <SpeechBubble pointer="bottom-left" className="max-w-[120px]">
            Pick your preferred date
          </SpeechBubble>
        </div>
        <div className="pointer-events-none absolute bottom-16 left-0 z-10">
          <SpeechBubble pointer="top-right" className="max-w-[130px]">
            Choose which agent to meet
          </SpeechBubble>
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-[#6B9E6E]">Average response time: 2 hours</p>
    </div>
  );
}

function AgentSlide5CTA({ onRegister, onSkip }: { onRegister: () => void; onSkip: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden text-center">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#2C2C2C] sm:text-3xl">Ready to grow your business?</h2>
        <p className="mt-3 text-base text-[#2C2C2C]/55">Join 847+ verified agents already on BahayGo</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onRegister}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#6B9E6E]/25 transition hover:bg-[#5d8a60]"
        >
          Register as Agent
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full rounded-full border-2 border-[#2C2C2C]/15 bg-transparent py-3.5 text-sm font-bold text-[#2C2C2C]/75 transition hover:bg-[#2C2C2C]/5"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function ClientSlide5CTA({ onSignup, onBrowse }: { onSignup: () => void; onBrowse: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden text-center">
      <div>
        <h2 className="font-serif text-2xl font-bold text-[#2C2C2C] sm:text-3xl">Find your home in the Philippines</h2>
        <p className="mt-3 text-base text-[#2C2C2C]/55">Join thousands of Filipinos already using BahayGo</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={onSignup}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#6B9E6E]/25 transition hover:bg-[#5d8a60]"
        >
          Create Free Account
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onBrowse}
          className="w-full rounded-full border-2 border-[#2C2C2C]/15 bg-transparent py-3.5 text-sm font-bold text-[#2C2C2C]/75 transition hover:bg-[#2C2C2C]/5"
        >
          Browse listings first
        </button>
      </div>
    </div>
  );
}

function SlideRolePicker({
  selectedPreview,
  onPick,
}: {
  selectedPreview: OnboardRole | null;
  onPick: (r: OnboardRole) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-1">
      <img
        src="/bahaygologo.png"
        alt=""
        className="mx-auto mb-4 h-20 w-auto object-contain"
      />
      <h2 className="text-center font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">
        Welcome to BahayGo
      </h2>
      <p className="mt-3 text-center text-base font-medium text-[#2C2C2C]/60">What brings you here today?</p>
      <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-3 sm:gap-4">
        <RoleCard
          emoji="🏠"
          title="Client"
          description="Find your perfect home"
          selected={selectedPreview === "client"}
          onClick={() => onPick("client")}
        />
        <RoleCard
          emoji="🏆"
          title="Agent"
          description="List and grow your business"
          selected={selectedPreview === "agent"}
          onClick={() => onPick("agent")}
        />
        <RoleCard emoji="🏗️" title="Seller" description="List your property" disabled />
        <RoleCard emoji="🏢" title="Broker" description="Manage your team" disabled />
      </div>
    </div>
  );
}

export function WelcomeOnboarding() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [role, setRole] = useState<OnboardRole | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<OnboardRole | null>(null);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get("onboarding") === "true") {
          setOpen(true);
          sp.delete("onboarding");
          const qs = sp.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
          return;
        }
        if (!localStorage.getItem(STORAGE_KEY)) {
          setOpen(true);
        }
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

  const pickRole = useCallback((r: OnboardRole) => {
    setSelectedPreview(r);
    setDirection(1);
    setRole(r);
    setCurrentSlide(2);
  }, []);

  const resetToSlide1 = useCallback(() => {
    setDirection(-1);
    setRole(null);
    setSelectedPreview(null);
    setCurrentSlide(1);
  }, []);

  const next = useCallback(() => {
    setDirection(1);
    setCurrentSlide((s) => Math.min(TOTAL_SLIDES, s + 1));
  }, []);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrentSlide((s) => {
      if (s <= 2) {
        setRole(null);
        setSelectedPreview(null);
        return 1;
      }
      return s - 1;
    });
  }, []);

  useEffect(() => {
    if (currentSlide === 1) {
      setRole(null);
      setSelectedPreview(null);
    }
  }, [currentSlide]);

  const goAgentRegister = useCallback(() => {
    router.push("/register/agent");
    finish();
  }, [router, finish]);

  const goClientSignup = useCallback(() => {
    router.push("/auth/signup");
    finish();
  }, [router, finish]);

  const browseListings = useCallback(() => {
    finish();
    requestAnimationFrame(() => {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [finish]);

  if (!mounted || !open) return null;

  const pathStepIndex = currentSlide >= 2 ? currentSlide - 2 : -1;
  const showPathDots = currentSlide >= 2;
  const showFooterNav = currentSlide >= 2 && currentSlide < 5;
  const isSlide5 = currentSlide === 5;
  const canClose = currentSlide === 5;

  const renderSlide = () => {
    if (currentSlide === 1) return <SlideRolePicker selectedPreview={selectedPreview} onPick={pickRole} />;
    if (!role) return <SlideRolePicker selectedPreview={selectedPreview} onPick={pickRole} />;
    if (role === "agent") {
      if (currentSlide === 2) return <AgentSlideProfile />;
      if (currentSlide === 3) return <AgentSlideVerified />;
      if (currentSlide === 4) return <AgentSlidePipeline />;
      return <AgentSlide5CTA onRegister={goAgentRegister} onSkip={finish} />;
    }
    if (currentSlide === 2) return <ClientSlideWishlist />;
    if (currentSlide === 3) return <ClientSlideAgents />;
    if (currentSlide === 4) return <ClientSlideViewing />;
    return <ClientSlide5CTA onSignup={goClientSignup} onBrowse={browseListings} />;
  };

  const showChangeRole = currentSlide >= 2 && currentSlide <= 5;

  const animKey = `${role ?? "x"}-${currentSlide}`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboard-heading"
    >
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(92vh,780px)] lg:max-w-3xl lg:min-h-[680px] sm:rounded-3xl sm:shadow-2xl sm:ring-1 sm:ring-[#2C2C2C]/10">
        <div className="flex shrink-0 items-center justify-between border-b border-[#2C2C2C]/10 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1 text-xs font-semibold text-[#2C2C2C]/45 sm:text-sm">
            <span id="onboard-heading" className="tabular-nums">
              {currentSlide === 1 ? "Choose your path" : `Step ${currentSlide - 1} of 4`}
            </span>
          </div>
          {canClose ? (
            <button
              type="button"
              onClick={finish}
              className="shrink-0 rounded-full p-2 text-[#2C2C2C]/45 transition hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843]"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <span className="w-9 shrink-0" aria-hidden />
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-8 sm:py-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={animKey}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="active"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              {showChangeRole ? <ChangeRoleLink onClick={resetToSlide1} /> : null}
              {renderSlide()}
            </motion.div>
          </AnimatePresence>
        </div>

        {showPathDots ? (
          <div className="flex shrink-0 justify-center gap-2 border-t border-[#2C2C2C]/10 py-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${
                  pathStepIndex === i ? "w-8 bg-[#6B9E6E]" : "w-2 bg-[#2C2C2C]/15"
                }`}
                aria-hidden
              />
            ))}
          </div>
        ) : null}

        {showFooterNav ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#2C2C2C]/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8">
            <button
              type="button"
              onClick={prev}
              className="inline-flex items-center gap-1 rounded-full border-2 border-[#2C2C2C]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm transition hover:bg-[#FAF8F4]"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : isSlide5 ? (
          <div className="h-0 shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
