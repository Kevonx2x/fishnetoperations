"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, GitBranch, House, MessageSquare, ShieldCheck, Star, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CHANGELOG_VERSION = "v1.0";
const OPEN_DELAY_MS = 4000;

/** Backup if profile refetch lags: set on successful dismiss so the modal does not reopen. */
const MODAL_LOCALSTORAGE_DISMISS_KEY = "bahaygo_modal_dismissed";

/** Ensures only the first mounted `PostLoginModal` renders (guards duplicate parents / Strict Mode quirks). */
let postLoginModalOwner: object | null = null;

/** Same instant as `supabase/migrations/20260430140000_profiles_tutorial_tracking.sql` tutorial backfill. */
const TUTORIAL_ONBOARDING_CUTOFF_MS = Date.parse("2026-04-30T00:00:00.000Z");

/**
 * TEMPORARY (QA): the migration sets `tutorial_completed = true` for `created_at` before the cutoff, which
 * blocks the onboarding track for older test accounts. While true, pre-cutoff profiles are not treated as
 * tutorial-complete for onboarding routing only — What's New still uses `last_seen_changelog` only (never
 * `created_at`). Set to `false` after QA and restore onboarding-only cutoff behavior in this file.
 */
const TEMP_DISABLE_LEGACY_TUTORIAL_BACKSTOP = false;

function isLegacyProfileBeforeTutorialCutoff(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) && ms < TUTORIAL_ONBOARDING_CUTOFF_MS;
}

const CREAM = "#FAF8F4";
const RIGHT_SAGE = "#2d4a2f";
const CHARCOAL = "#2C2C2C";
const CLIENT_TRUST_RIGHT = "#FAF8F4";

/** Right-panel stage: centered content, ~70–85% usable area (inner overflow visible so previews are not clipped). */
function RightStage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-[240px] w-full flex-1 items-center justify-center overflow-visible md:min-h-0">
      <div className="relative flex w-[min(92%,95%)] max-w-[min(90vw,640px)] flex-col items-center justify-center overflow-visible md:w-[85%]">
        {children}
      </div>
    </div>
  );
}

/** Horizontal travel: centered card in Lead (160−140)/2=10 → same inset in Viewing (+160 gap +80) */
const PIPELINE_CARD_DX = 240;

/** Slide 1 — kanban-style columns, card drags Lead → Viewing, 6s loop */
function PreviewPipelineDrag() {
  const loop = 6;
  const ease = "easeInOut" as const;
  const t = [0, 1 / 6, 0.25, 1 / 3, 3.5 / 6, 2 / 3, 5.5 / 6, 0.93, 0.94, 1];

  const leadColOpacity = [1, 1, 1, 0.5, 0.5, 1, 1, 1, 1, 1];
  const viewingGlow = [
    "none",
    "none",
    "none",
    "0 0 8px rgba(107,158,110,0.4)",
    "0 0 8px rgba(107,158,110,0.4)",
    "none",
    "none",
    "none",
    "none",
    "none",
  ];

  const cardX = [0, 0, 0, 0, PIPELINE_CARD_DX, PIPELINE_CARD_DX, PIPELINE_CARD_DX, PIPELINE_CARD_DX, 0, 0];
  const cardY = [0, 0, -3, -3, -3, 0, 0, 0, 0, 0];
  const cardRotate = [0, 0, 0, 1.5, 1.5, 0, 0, 0, 0, 0];
  const cardScale = [1, 1, 1, 1.02, 1.02, 1, 1, 1, 1, 1];
  const cardOpacity = [1, 1, 1, 1, 1, 1, 1, 1, 0, 1];
  const cardShadow = [
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 10px 26px rgba(0,0,0,0.42)",
    "0 12px 28px rgba(0,0,0,0.48)",
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 4px 14px rgba(0,0,0,0.28)",
    "0 4px 14px rgba(0,0,0,0.28)",
  ];

  const pillLeadOpacity = [1, 1, 1, 1, 1, 0, 0, 0, 1, 1];
  const pillViewOpacity = [0, 0, 0, 0, 0, 1, 1, 1, 0, 0];

  const cursorOpacity = [0, 0, 1, 1, 1, 1, 0, 0, 0, 0];
  const cursorX = [312, 312, 76, 72, 72 + PIPELINE_CARD_DX, 72 + PIPELINE_CARD_DX, 72 + PIPELINE_CARD_DX, 72 + PIPELINE_CARD_DX, 312, 312];
  /** Nudged down with dragged card `top` so the pointer stays on the card (same timing as before). */
  const cursorY = [316, 316, 184, 180, 180, 192, 192, 192, 316, 316];

  const transition = { duration: loop, repeat: Infinity, ease, times: t };

  return (
    <RightStage>
      <div className="flex w-full justify-center px-2 py-6">
        <div className="relative h-[280px] w-[400px] max-w-[calc(100vw-2rem)] shrink-0">
          <div className="absolute inset-0 flex gap-[80px]">
            <motion.div
              className="flex h-[280px] w-[160px] shrink-0 flex-col rounded-xl border border-white/10 bg-white/5 px-2.5 pb-2 pt-3"
              initial={false}
              animate={{ opacity: leadColOpacity }}
              transition={transition}
            >
              <h3 className="text-sm font-semibold text-white">Lead</h3>
            </motion.div>
            <motion.div
              className="flex h-[280px] w-[160px] shrink-0 flex-col rounded-xl border border-white/10 bg-white/5 px-2.5 pb-2 pt-3"
              initial={false}
              animate={{ boxShadow: viewingGlow }}
              transition={transition}
            >
              <h3 className="text-sm font-semibold text-white">Viewing</h3>
            </motion.div>
          </div>

          <motion.div
            className="pointer-events-none absolute left-0 top-0 z-20 h-5 w-5"
            initial={false}
            animate={{ opacity: cursorOpacity, x: cursorX, y: cursorY }}
            transition={transition}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55)) drop-shadow(0 0 1px rgba(255,255,255,0.35))" }}
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
              <path
                d="M5.5 3.21L20.5 12L5.5 20.79V14.5L12 12L5.5 9.5V3.21Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <div
            className="pointer-events-none absolute left-[250px] top-[52px] z-[5] w-[140px] rounded-lg border border-white/[0.08] bg-[#1a1a1a] shadow-[0_4px_14px_rgba(0,0,0,0.28)]"
            aria-hidden
          >
            <div className="pointer-events-none absolute right-1.5 top-1.5">
              <span className="inline-flex items-center justify-center rounded-full bg-[#D4A843]/35 px-1.5 py-0.5 text-[9px] font-bold text-[#D4A843]">
                Viewing
              </span>
            </div>
            <div className="flex flex-col px-2.5 pb-2 pt-4">
              <p className="text-xs font-bold text-white">BGC Loft</p>
              <p className="mt-0.5 text-xs font-bold text-[#D4A843]">₱45,000/mo</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&q=80"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
                <span className="text-[10px] text-white/60">Maria Santos</span>
              </div>
            </div>
          </div>

          <motion.div
            className="pointer-events-none absolute left-[10px] top-[160px] z-10 w-[140px] rounded-lg border border-white/[0.08] bg-[#1a1a1a]"
            initial={false}
            animate={{
              x: cardX,
              y: cardY,
              rotate: cardRotate,
              scale: cardScale,
              opacity: cardOpacity,
              boxShadow: cardShadow,
            }}
            transition={transition}
          >
            <div className="pointer-events-none absolute right-1.5 top-1.5 h-4 w-11">
              <motion.span
                className="absolute inset-0 flex items-center justify-center rounded-full bg-[#6B9E6E]/45 px-1.5 text-[9px] font-bold text-[#6B9E6E]"
                initial={false}
                animate={{ opacity: pillLeadOpacity }}
                transition={transition}
              >
                Lead
              </motion.span>
              <motion.span
                className="absolute inset-0 flex items-center justify-center rounded-full bg-[#D4A843]/35 px-1.5 text-[9px] font-bold text-[#D4A843]"
                initial={false}
                animate={{ opacity: pillViewOpacity }}
                transition={transition}
              >
                Viewing
              </motion.span>
            </div>
            <div className="flex flex-col px-2.5 pb-2 pt-4">
              <p className="text-xs font-bold text-white">Studio Condo</p>
              <p className="mt-0.5 text-xs font-bold text-[#D4A843]">₱32,000/mo</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
                <span className="text-[10px] text-white/60">James Cruz</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </RightStage>
  );
}

/** Slide 2 — two-message chat, 6s loop, no cursor
 * 0–0.8s agent in | 0.8–1.6s typing | 1.6–2.0s client in | ~3s both visible | 0.5s fade */
function PreviewChatSimple() {
  const loopS = 6;
  const easeOut = [0.25, 0.1, 0.25, 1] as const;
  return (
    <RightStage>
      <div className="flex w-[70%] min-w-[260px] max-w-lg flex-col gap-5 py-4">
        <motion.div
          className="max-w-[92%] self-start"
          initial={false}
          animate={{ x: [-20, 0, 0, -6], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: loopS,
            repeat: Infinity,
            ease: easeOut,
            times: [0, 0.8 / loopS, 5.5 / loopS, 1],
          }}
        >
          <p className="mb-1 text-xs text-white/60">Maria Santos</p>
          <div className="flex gap-2">
            <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E] ring-1 ring-white/15">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&q=80"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div>
              <div className="rounded-2xl rounded-tl-sm bg-[#1a1a1a] px-3 py-2.5 shadow-md">
                <p className="text-sm text-white">Hi James, ready na yung documents?</p>
              </div>
              <p className="mt-1 pl-1 text-xs text-white/30">2:30 PM</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="flex items-center gap-1 self-end pr-2 sm:pr-4"
          initial={false}
          animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
          transition={{
            duration: loopS,
            repeat: Infinity,
            ease: "easeInOut",
            times: [0, 0.8 / loopS, 0.84 / loopS, 1.56 / loopS, 1.6 / loopS, 1],
          }}
          aria-hidden
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#6B9E6E]"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
            />
          ))}
        </motion.div>

        <motion.div
          className="max-w-[92%] self-end"
          initial={false}
          animate={{ x: [18, 18, 0, 0, 8], opacity: [0, 0, 1, 1, 0] }}
          transition={{
            duration: loopS,
            repeat: Infinity,
            ease: easeOut,
            times: [0, 1.6 / loopS, 2 / loopS, 5.5 / loopS, 1],
          }}
        >
          <p className="mb-1 text-right text-xs text-white/60">James Cruz</p>
          <div className="flex flex-row-reverse gap-2">
            <div className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#D4A843] ring-1 ring-white/15">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>
            <div>
              <div className="rounded-2xl rounded-tr-sm bg-[#6B9E6E] px-3 py-2.5 shadow-md">
                <p className="text-sm text-white">Naipadala ko na po, Maria 📎</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
                  <span>Offer_Letter.pdf</span>
                </div>
              </div>
              <p className="mt-1 pr-1 text-right text-xs text-white/30">2:32 PM</p>
            </div>
          </div>
        </motion.div>
      </div>
    </RightStage>
  );
}

/** Client Slide 1 — trust carousel + expand + agent highlight (plays once per mount) */
function PreviewClientTrustCarousel() {
  const loop = 10;
  const ease = "easeInOut" as const;
  /** Phases: scroll → settle → expand → highlight → license (hold final frame) */
  const t = [0, 0.3, 0.38, 0.4, 0.55, 0.62, 0.72, 0.75, 0.9, 1];
  const transition = { duration: loop, repeat: 0, ease, times: t };
  const badgeEase = [0.34, 1.56, 0.64, 1] as const;
  const badgeTransition = { duration: loop, repeat: 0, ease: badgeEase, times: t };

  const rootOpacity = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  /** Slow scroll R→L (positive x = row shifted right) */
  const rowX = [200, -56, -64, -64, 0, 0, 0, 0, 0, 0];
  const sideOpacity = [1, 1, 1, 0.5, 0, 0, 0, 0, 0, 0];
  const sideScale = [1, 1, 1, 0.85, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8];
  const centerW = [160, 160, 160, 160, 280, 280, 280, 280, 280, 280];
  const centerH = [220, 220, 220, 220, 260, 260, 260, 260, 260, 260];
  const badgeScale = [0, 0, 0, 0, 0, 0, 1.1, 1, 1, 1];
  const starOpacity = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
  const licenseOpacity = [0, 0, 0, 0, 0, 0, 0, 1, 1, 1];
  const licenseY = [8, 8, 8, 8, 8, 8, 8, 0, 0, 0];
  const avatarShadow = [
    "0 0 0 rgba(107,158,110,0)",
    "0 0 0 rgba(107,158,110,0)",
    "0 0 0 rgba(107,158,110,0)",
    "0 0 0 rgba(107,158,110,0)",
    "0 0 0 rgba(107,158,110,0)",
    "0 0 0 rgba(107,158,110,0)",
    "0 0 0 3px rgba(107,158,110,0.45)",
    "0 0 0 4px rgba(107,158,110,0.55)",
    "0 0 0 3px rgba(107,158,110,0.4)",
    "0 0 0 rgba(107,158,110,0)",
  ];
  const rowBg = [
    "rgba(255,255,255,0)",
    "rgba(255,255,255,0)",
    "rgba(255,255,255,0)",
    "rgba(255,255,255,0)",
    "rgba(255,255,255,0)",
    "rgba(255,255,255,0.12)",
    "rgba(255,255,255,0.18)",
    "rgba(255,255,255,0.14)",
    "rgba(255,255,255,0.08)",
    "rgba(255,255,255,0.08)",
  ];

  const cardShell =
    "shrink-0 overflow-hidden rounded-xl bg-white shadow-lg flex flex-col pointer-events-none";

  return (
    <RightStage>
      <motion.div
        className="flex w-full flex-col items-center justify-center gap-4 overflow-visible px-2 py-5"
        initial={false}
        animate={{ opacity: rootOpacity }}
        transition={transition}
      >
        <div className="relative flex min-h-[280px] w-full max-w-[min(100%,380px)] items-center justify-center overflow-visible">
          <motion.div
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 overflow-visible"
            initial={false}
            animate={{ x: rowX }}
            transition={transition}
          >
            <motion.div className={cardShell} style={{ width: 160, height: 220 }} initial={false} animate={{ opacity: sideOpacity, scale: sideScale }} transition={transition}>
              <img
                src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&q=80"
                alt=""
                className="h-[55%] w-full shrink-0 rounded-t-xl object-cover"
                draggable={false}
              />
              <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-1.5">
                <p className="text-xs font-bold text-[#2C2C2C]">1BR in BGC</p>
                <p className="mt-0.5 text-[10px] font-bold text-[#D4A843]">₱28,000/mo</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80"
                      alt=""
                      width={20}
                      height={20}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </span>
                  <span className="text-[10px] text-[#2C2C2C]/90">Alex R.</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              className={`relative z-[1] ${cardShell}`}
              initial={{ width: 160, height: 220 }}
              animate={{ width: centerW, height: centerH }}
              transition={transition}
            >
              <div className="relative h-[55%] min-h-[118px] w-full shrink-0 overflow-hidden rounded-t-xl">
                <motion.img
                  src="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80"
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                  initial={false}
                  animate={{ scale: [1, 1, 1, 1, 1.08, 1.1, 1.08, 1.06, 1.05, 1.05] }}
                  transition={transition}
                />
              </div>
              <div className="flex flex-1 flex-col px-2.5 pb-2 pt-1.5">
                <p className="text-xs font-bold text-[#2C2C2C]">2BR Condo Makati</p>
                <p className="mt-0.5 text-[10px] font-bold text-[#D4A843]">₱35,000/mo</p>
                <motion.div
                  className="mt-1.5 flex min-h-[32px] flex-wrap items-center gap-1 rounded-lg px-1 py-0.5"
                  initial={false}
                  animate={{ backgroundColor: rowBg }}
                  transition={transition}
                >
                  <motion.img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&q=80"
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                    draggable={false}
                    initial={false}
                    animate={{ boxShadow: avatarShadow }}
                    transition={transition}
                  />
                  <span className="text-[10px] font-medium text-[#2C2C2C]/90">Maria Santos</span>
                  <motion.span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/25 text-[#6B9E6E]"
                    initial={false}
                    animate={{ scale: badgeScale }}
                    transition={badgeTransition}
                  >
                    <ShieldCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  </motion.span>
                  <motion.span
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#D4A843]"
                    initial={false}
                    animate={{ opacity: starOpacity }}
                    transition={transition}
                  >
                    <Star className="h-3 w-3 fill-[#D4A843] text-[#D4A843]" aria-hidden />
                    4.8
                  </motion.span>
                </motion.div>
              </div>
            </motion.div>

            <motion.div className={cardShell} style={{ width: 160, height: 220 }} initial={false} animate={{ opacity: sideOpacity, scale: sideScale }} transition={transition}>
              <img
                src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80"
                alt=""
                className="h-[55%] w-full shrink-0 rounded-t-xl object-cover"
                draggable={false}
              />
              <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-1.5">
                <p className="text-xs font-bold text-[#2C2C2C]">Studio Ortigas</p>
                <p className="mt-0.5 text-[10px] font-bold text-[#D4A843]">₱18,000/mo</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
                    <img
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80"
                      alt=""
                      width={20}
                      height={20}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </span>
                  <span className="text-[10px] text-[#2C2C2C]/90">Carlo M.</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
        <motion.p
          className="max-w-[280px] text-center text-xs italic text-[#2C2C2C]/40"
          initial={false}
          animate={{ opacity: licenseOpacity, y: licenseY }}
          transition={transition}
        >
          PRC License #0045821 · Verified
        </motion.p>
      </motion.div>
    </RightStage>
  );
}

/** One-shot chat sequence length (seconds); ends after message 6 is fully visible. */
const SLIDE2_CHAT_SEQUENCE_S = 16.5;

/** Typing shell: fade in 0.2s at fadeInStart, fade out 0.2s starting fadeOutStart. Opacity only; plays once. */
function slide2TypingOpacityOnce(total: number, fadeInStart: number, fadeOutStart: number) {
  const a = fadeInStart / total;
  const b = (fadeInStart + 0.2) / total;
  const c = fadeOutStart / total;
  const d = (fadeOutStart + 0.2) / total;
  const eps = 0.00006;
  return {
    times: [0, Math.max(0, a - eps), a, b, Math.max(b + eps, c - eps), c, d, 1],
    opacity: [0, 0, 0, 1, 1, 1, 0, 0],
  };
}

/** Message row: fade in 0.3s at appearStart, then hold. Opacity only; plays once (no fade-out). */
function slide2MessageOpacityOnce(total: number, appearStart: number) {
  const a = appearStart / total;
  const b = (appearStart + 0.3) / total;
  const eps = 0.00006;
  return {
    times: [0, Math.max(0, a - eps), a, b, 1],
    opacity: [0, 0, 0, 1, 1],
  };
}

function Slide2TypingDots({ side }: { side: "client" | "agent" }) {
  const dot = side === "client" ? "bg-[#6B9E6E]" : "bg-white/40";
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`h-[3px] w-[3px] shrink-0 rounded-full ${dot}`}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

const SLIDE2_CLIENT_AVATAR = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80";
const SLIDE2_AGENT_AVATAR = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&q=80";

/** Client Slide 2 — one-shot sequence, opacity-only (no layout shift / bounce) */
function PreviewClientStayConnectedChat() {
  const L = SLIDE2_CHAT_SEQUENCE_S;
  const transitionOnce = { duration: L, repeat: 0, ease: "easeInOut" as const };

  const ty2 = slide2TypingOpacityOnce(L, 0.3, 2.5);
  const ty3 = slide2TypingOpacityOnce(L, 3.7, 5.7);
  const ty4 = slide2TypingOpacityOnce(L, 6.9, 8.9);
  const ty5 = slide2TypingOpacityOnce(L, 10.1, 12.1);
  const ty6 = slide2TypingOpacityOnce(L, 13.3, 15.3);

  const m2 = slide2MessageOpacityOnce(L, 2.7);
  const m3 = slide2MessageOpacityOnce(L, 5.9);
  const m4 = slide2MessageOpacityOnce(L, 9.1);
  const m5 = slide2MessageOpacityOnce(L, 12.3);
  const m6 = slide2MessageOpacityOnce(L, 15.5);

  return (
    <RightStage>
      <div className="w-full max-w-[min(92%,560px)] min-w-[260px] py-2">
        <div className="mx-auto flex w-full flex-col gap-5 px-1">
          {/* Slot 1 — client (message 1 visible immediately; no typing before first message) */}
          <div className="relative min-h-[56px] w-full">
            <div className="pointer-events-none absolute right-0 top-0 w-[min(82%,300px)]">
              <div className="absolute right-0 top-0 z-20 flex flex-row-reverse items-end gap-2 opacity-100">
                <div className="max-w-full shrink-0">
                  <p className="mb-0.5 text-right text-[10px] text-white/50">James Cruz</p>
                  <div className="flex flex-row-reverse items-end gap-2">
                    <img
                      src={SLIDE2_CLIENT_AVATAR}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                      draggable={false}
                    />
                    <div className="rounded-2xl rounded-tr-sm bg-[#6B9E6E] px-4 py-2 shadow-md">
                      <p className="text-xs text-white">Available pa po ba ito?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slot 2 — agent */}
          <div className="relative min-h-[60px] w-full">
            <div className="pointer-events-none absolute left-0 top-0 w-[min(82%,300px)]">
              <motion.div
                className="z-10 flex flex-col items-start pl-1"
                initial={false}
                animate={{ opacity: ty2.opacity }}
                transition={{ ...transitionOnce, times: ty2.times }}
              >
                <div className="mb-0.5 h-[14px] w-full shrink-0" aria-hidden />
                <div className="flex items-end gap-2">
                  <div className="h-6 w-6 shrink-0" aria-hidden />
                  <div className="rounded-2xl rounded-tl-sm bg-white/[0.08] px-4 py-2">
                    <Slide2TypingDots side="agent" />
                  </div>
                </div>
              </motion.div>
              <motion.div
                className="absolute left-0 top-0 z-20 flex items-end gap-2"
                initial={false}
                animate={{ opacity: m2.opacity }}
                transition={{ ...transitionOnce, times: m2.times }}
              >
                <div className="max-w-full">
                  <p className="mb-0.5 text-[10px] text-white/50">Maria Santos</p>
                  <div className="flex items-end gap-2">
                    <img
                      src={SLIDE2_AGENT_AVATAR}
                      alt=""
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded-full object-cover"
                      draggable={false}
                    />
                    <div className="rounded-2xl rounded-tl-sm bg-[#1a1a1a] px-4 py-2 shadow-md">
                      <p className="text-xs text-white">Yes po! Want to schedule a viewing?</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Slot 3 — client */}
          <div className="relative min-h-[48px] w-full">
            <div className="pointer-events-none absolute right-0 top-0 w-[min(82%,300px)]">
              <motion.div
                className="z-10 flex flex-row-reverse items-end gap-2"
                initial={false}
                animate={{ opacity: ty3.opacity }}
                transition={{ ...transitionOnce, times: ty3.times }}
              >
                <div className="h-6 w-6 shrink-0" aria-hidden />
                <div className="rounded-2xl rounded-tr-sm bg-[#6B9E6E]/25 px-4 py-2">
                  <Slide2TypingDots side="client" />
                </div>
              </motion.div>
              <motion.div
                className="absolute right-0 top-0 z-20 flex flex-row-reverse items-end gap-2"
                initial={false}
                animate={{ opacity: m3.opacity }}
                transition={{ ...transitionOnce, times: m3.times }}
              >
                <img
                  src={SLIDE2_CLIENT_AVATAR}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
                <div className="rounded-2xl rounded-tr-sm bg-[#6B9E6E] px-4 py-2 shadow-md">
                  <p className="text-xs text-white">I requested a viewing po 🏠</p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Slot 4 — agent */}
          <div className="relative min-h-[48px] w-full">
            <div className="pointer-events-none absolute left-0 top-0 w-[min(82%,300px)]">
              <motion.div
                className="z-10 flex items-end gap-2 pl-1"
                initial={false}
                animate={{ opacity: ty4.opacity }}
                transition={{ ...transitionOnce, times: ty4.times }}
              >
                <div className="h-6 w-6 shrink-0" aria-hidden />
                <div className="rounded-2xl rounded-tl-sm bg-white/[0.08] px-4 py-2">
                  <Slide2TypingDots side="agent" />
                </div>
              </motion.div>
              <motion.div
                className="absolute left-0 top-0 z-20 flex items-end gap-2"
                initial={false}
                animate={{ opacity: m4.opacity }}
                transition={{ ...transitionOnce, times: m4.times }}
              >
                <img
                  src={SLIDE2_AGENT_AVATAR}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
                <div className="rounded-2xl rounded-tl-sm bg-[#1a1a1a] px-4 py-2 shadow-md">
                  <p className="text-xs text-white">Accepted! See you Saturday 2PM ✓</p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Slot 5 — client + attachment */}
          <div className="relative min-h-[76px] w-full">
            <div className="pointer-events-none absolute right-0 top-0 w-[min(82%,300px)]">
              <motion.div
                className="z-10 flex flex-row-reverse items-end gap-2"
                initial={false}
                animate={{ opacity: ty5.opacity }}
                transition={{ ...transitionOnce, times: ty5.times }}
              >
                <div className="h-6 w-6 shrink-0" aria-hidden />
                <div className="rounded-2xl rounded-tr-sm bg-[#6B9E6E]/25 px-4 py-2">
                  <Slide2TypingDots side="client" />
                </div>
              </motion.div>
              <motion.div
                className="absolute right-0 top-0 z-20 flex flex-row-reverse items-end gap-2"
                initial={false}
                animate={{ opacity: m5.opacity }}
                transition={{ ...transitionOnce, times: m5.times }}
              >
                <img
                  src={SLIDE2_CLIENT_AVATAR}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
                <div className="flex flex-col items-end gap-0.5">
                  <div className="rounded-2xl rounded-tr-sm bg-[#6B9E6E] px-4 py-2 shadow-md">
                    <p className="text-xs text-white">Sent ko na po yung documents 📎</p>
                  </div>
                  <p className="pr-0.5 text-[9px] text-white/50">Offer_Letter.pdf</p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Slot 6 — agent */}
          <div className="relative min-h-[48px] w-full">
            <div className="pointer-events-none absolute left-0 top-0 w-[min(82%,300px)]">
              <motion.div
                className="z-10 flex items-end gap-2 pl-1"
                initial={false}
                animate={{ opacity: ty6.opacity }}
                transition={{ ...transitionOnce, times: ty6.times }}
              >
                <div className="h-6 w-6 shrink-0" aria-hidden />
                <div className="rounded-2xl rounded-tl-sm bg-white/[0.08] px-4 py-2">
                  <Slide2TypingDots side="agent" />
                </div>
              </motion.div>
              <motion.div
                className="absolute left-0 top-0 z-20 flex items-end gap-2"
                initial={false}
                animate={{ opacity: m6.opacity }}
                transition={{ ...transitionOnce, times: m6.times }}
              >
                <img
                  src={SLIDE2_AGENT_AVATAR}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                  draggable={false}
                />
                <div className="rounded-2xl rounded-tl-sm bg-[#1a1a1a] px-4 py-2 shadow-md">
                  <p className="text-xs text-white">Received and confirmed po! 🎉</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </RightStage>
  );
}

/** Slide 3 — logo breathing + tagline, 3s loop (scale + sage glow ring) */
function PreviewLogoBreathSimple() {
  return (
    <RightStage>
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <motion.div
          className="flex flex-col items-center rounded-2xl px-6 py-2"
          animate={{
            scale: [1, 1.04, 1],
            boxShadow: [
              "0 0 40px rgba(107,158,110,0.3)",
              "0 0 60px rgba(107,158,110,0.5)",
              "0 0 40px rgba(107,158,110,0.3)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <House className="mx-auto h-12 w-12 text-[#D4A843]" strokeWidth={1.65} aria-hidden />
          <p className="mt-2 text-center font-sans text-2xl font-bold tracking-tight">
            <span className="text-white">bahay</span>
            <span className="text-[#6B9E6E]">go</span>
          </p>
        </motion.div>
        <p className="text-center text-sm text-white/50">Built for Philippine Real Estate</p>
      </div>
    </RightStage>
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
    <span className="mb-4 inline-block rounded-full bg-[#D4A843]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#D4A843]">
      New
    </span>
  );
}

function iconCell(children: ReactNode, tone: "sage" | "gold" = "sage") {
  const color = tone === "gold" ? "text-[#D4A843]" : "text-[#6B9E6E]";
  return (
    <div
      className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#6B9E6E]/12 p-2 ${color}`}
      aria-hidden
    >
      <span className="flex h-10 w-10 items-center justify-center [&_svg]:h-10 [&_svg]:w-10">{children}</span>
    </div>
  );
}

const titleClass = "font-sans text-3xl font-bold text-[#2C2C2C]";
const bodyClass = "mt-4 font-sans text-base leading-relaxed text-[#888888]";

function clientTrustSlideIcon() {
  return (
    <div
      className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 p-2 text-[#6B9E6E]"
      aria-hidden
    >
      <ShieldCheck className="h-10 w-10" strokeWidth={1.65} />
    </div>
  );
}

function buildOnboardingSlides(): SlideDef[] {
  return [
    {
      key: "pipeline",
      left: (
        <>
          {iconCell(<GitBranch strokeWidth={1.65} />)}
          <h2 className={titleClass}>Your deals, one view</h2>
          <p className={bodyClass}>
            Drag deals between stages as they progress. Your pipeline keeps everything organized.
          </p>
        </>
      ),
      right: <PreviewPipelineDrag />,
    },
    {
      key: "messages",
      left: (
        <>
          {iconCell(<MessageSquare strokeWidth={1.65} />)}
          <h2 className={titleClass}>Stay connected</h2>
          <p className={bodyClass}>Message clients directly. Get notified when documents arrive.</p>
        </>
      ),
      right: <PreviewChatSimple />,
    },
    {
      key: "brand",
      left: (
        <>
          {iconCell(<ShieldCheck strokeWidth={1.65} />, "gold")}
          <h2 className={titleClass}>Built for Philippine real estate</h2>
          <p className={bodyClass}>PRC-verified agents. Trusted listings. From Makati to Cebu.</p>
        </>
      ),
      right: <PreviewLogoBreathSimple />,
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
          <h2 className={titleClass}>Pipeline updates</h2>
          <p className={bodyClass}>
            Stage pills with dates, listing photos on cards, and quicker moves between stages.
          </p>
        </>
      ),
      right: <PreviewPipelineDrag />,
    },
    {
      key: "messaging",
      left: (
        <>
          {newPill()}
          <h2 className={titleClass}>Seamless messaging</h2>
          <p className={bodyClass}>Message clients directly. Get notified when documents arrive.</p>
        </>
      ),
      right: <PreviewChatSimple />,
    },
    {
      key: "coming-soon",
      left: (
        <>
          {newPill()}
          <h2 className={titleClass}>More coming soon</h2>
          <p className={bodyClass}>Maps, document tools, and more — shipping monthly.</p>
        </>
      ),
      right: <PreviewLogoBreathSimple />,
    },
  ];
}

function buildClientOnboardingSlides(): SlideDef[] {
  return [
    {
      key: "client-trust",
      left: (
        <>
          {clientTrustSlideIcon()}
          <h2 className="font-sans text-3xl font-bold text-white">Agents you can trust</h2>
          <p className="mt-4 font-sans text-base leading-relaxed text-white/60">
            Every agent on BahayGo is PRC-verified. No fake listings. No ghost brokers. Just licensed professionals
            ready to help you find your home.
          </p>
        </>
      ),
      right: <PreviewClientTrustCarousel />,
    },
    {
      key: "client-deal-progress",
      left: (
        <>
          {iconCell(<MessageSquare strokeWidth={1.65} />)}
          <h2 className={titleClass}>Stay connected</h2>
          <p className={bodyClass}>Message your agent directly. Every step of your deal — from inquiry to keys.</p>
        </>
      ),
      right: <PreviewClientStayConnectedChat />,
    },
    {
      key: "brand",
      left: (
        <>
          {iconCell(<ShieldCheck strokeWidth={1.65} />, "gold")}
          <h2 className={titleClass}>Built for Philippine real estate</h2>
          <p className={bodyClass}>PRC-verified agents. Trusted listings. From Makati to Cebu.</p>
        </>
      ),
      right: <PreviewLogoBreathSimple />,
    },
  ];
}

function buildClientWhatsNewSlides(): SlideDef[] {
  return [
    {
      key: "client-verification",
      left: (
        <>
          {newPill()}
          <h2 className={titleClass}>Verified agents, trusted listings</h2>
          <p className={bodyClass}>
            We&apos;ve strengthened our agent verification. Every listing is backed by a PRC-licensed professional.
          </p>
        </>
      ),
      right: <PreviewClientTrustCarousel />,
    },
    {
      key: "client-track-deals",
      left: (
        <>
          {newPill()}
          <h2 className={titleClass}>Track your deals</h2>
          <p className={bodyClass}>
            Your pipeline now shows exactly where each deal stands — from inquiry to close.
          </p>
        </>
      ),
      right: <PreviewClientStayConnectedChat />,
    },
    {
      key: "coming-soon",
      left: (
        <>
          {newPill()}
          <h2 className={titleClass}>More coming soon</h2>
          <p className={bodyClass}>Maps, document tools, and more — shipping monthly.</p>
        </>
      ),
      right: <PreviewLogoBreathSimple />,
    },
  ];
}

const slideEase = [0.22, 1, 0.36, 1] as const;

export function PostLoginModal() {
  const instanceRef = useRef<object | null>(null);
  if (instanceRef.current === null) instanceRef.current = {};
  const instance = instanceRef.current;

  useEffect(() => {
    return () => {
      if (postLoginModalOwner === instance) postLoginModalOwner = null;
    };
  }, [instance]);

  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [track, setTrack] = useState<Track | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (authLoading || !user?.id || !profile) return;
    const id = window.setTimeout(() => {
      if (typeof window !== "undefined" && localStorage.getItem(MODAL_LOCALSTORAGE_DISMISS_KEY) === "true") {
        return;
      }
      const changelogSeen = profile.last_seen_changelog === CHANGELOG_VERSION;
      const dbTutorialDone = profile.tutorial_completed === true;
      const tutorialDone =
        TEMP_DISABLE_LEGACY_TUTORIAL_BACKSTOP &&
        isLegacyProfileBeforeTutorialCutoff(profile.created_at)
          ? false
          : dbTutorialDone;
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
    profile?.role,
    profile?.created_at,
    profile?.tutorial_completed,
    profile?.last_seen_changelog,
  ]);

  const postLoginAudience = profile?.role === "client" ? "client" : "agent";

  const slides = useMemo(() => {
    const client = profile?.role === "client";
    if (track === "onboarding") return client ? buildClientOnboardingSlides() : buildOnboardingSlides();
    if (track === "whatsnew") return client ? buildClientWhatsNewSlides() : buildWhatsNewSlides();
    return [];
  }, [track, profile?.role]);

  const total = slides.length;
  const isLast = slideIndex >= total - 1;

  const isClientOnboardingCharcoalSlide =
    postLoginAudience === "client" && track === "onboarding" && slideIndex === 0;
  const isClientTrustCarouselRight = postLoginAudience === "client" && slideIndex === 0;

  const persistAndClose = useCallback(async () => {
    if (!user?.id || !track) return;
    console.log("[PostLoginModal] Dismiss clicked, saving flags...");
    const row = {
      tutorial_completed: true as const,
      last_seen_changelog: CHANGELOG_VERSION,
    };
    const result = await supabase.from("profiles").update(row).eq("id", user.id).select("id,tutorial_completed,last_seen_changelog").maybeSingle();
    console.log("[PostLoginModal] Supabase update result:", result);
    if (result.error) {
      console.log("[PostLoginModal] Supabase update ERROR:", result.error);
    } else {
      try {
        localStorage.setItem(MODAL_LOCALSTORAGE_DISMISS_KEY, "true");
      } catch {
        /* ignore quota / private mode */
      }
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

  if (postLoginModalOwner !== null && postLoginModalOwner !== instance) {
    return null;
  }
  if (postLoginModalOwner === null) {
    postLoginModalOwner = instance;
  }

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
          className="fixed inset-0 z-[130] flex items-end justify-center px-4 py-6 md:items-center md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-[rgba(44,44,44,0.70)] backdrop-blur-[2px]" aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            className="relative z-10 flex max-h-[min(100dvh-2rem,920px)] w-full max-w-5xl flex-col overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-transparent shadow-none md:max-h-[min(92vh,880px)] md:overflow-hidden"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{
              opacity: { duration: 0.5, delay: 0.2 },
              y: { duration: 0.5, delay: 0.2, ease: [0, 0, 0.2, 1] },
            }}
          >
            <button
              type="button"
              onClick={onDismiss}
              className={`absolute right-3 top-3 z-30 rounded-md p-1.5 transition md:right-4 md:top-4 md:text-white/50 md:hover:text-white/90 ${
                isClientOnboardingCharcoalSlide
                  ? "text-white/55 hover:text-white"
                  : "text-[#2C2C2C]/45 hover:text-[#2C2C2C]"
              }`}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="flex min-h-0 w-full flex-1 flex-col md:min-h-[500px] md:flex-row md:overflow-hidden">
              <motion.div
                className="order-1 flex min-h-0 w-full flex-col md:order-none md:w-[45%] md:shrink-0"
                initial={false}
                animate={{
                  backgroundColor: isClientOnboardingCharcoalSlide ? CHARCOAL : CREAM,
                }}
                transition={{ duration: 0.35, ease: slideEase }}
              >
                <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-12 md:p-10 md:pr-8 md:pt-14">
                  <div className="min-h-0 flex-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${track}-${slideIndex}-${postLoginAudience}-left`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.4, ease: slideEase }}
                      >
                        {slides[slideIndex]?.left}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div
                    className={`mt-8 flex shrink-0 items-center justify-between gap-4 border-t pt-3 ${
                      isClientOnboardingCharcoalSlide ? "border-white/10" : "border-[#2C2C2C]/10"
                    }`}
                  >
                    <div className="flex items-center gap-2.5" role="tablist" aria-label="Slides">
                      {Array.from({ length: total }).map((_, i) => {
                        const active = i === slideIndex;
                        return (
                          <button
                            key={i}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-label={`Go to slide ${i + 1}`}
                            onClick={() => setSlideIndex(i)}
                            className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                              isClientOnboardingCharcoalSlide
                                ? active
                                  ? "cursor-default bg-white"
                                  : "cursor-pointer bg-white/25 hover:bg-white/40"
                                : active
                                  ? "cursor-default bg-[#2C2C2C]"
                                  : "cursor-pointer bg-[#2C2C2C]/25 hover:bg-[#2C2C2C]/40"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={onNext}
                      className={`shrink-0 rounded-lg px-6 py-2.5 text-sm font-semibold transition ${
                        isClientOnboardingCharcoalSlide
                          ? "bg-white text-[#2C2C2C] hover:bg-white/90"
                          : "bg-[#6B9E6E] text-white hover:bg-[#5a8a5d]"
                      }`}
                    >
                      {ctaLabel}
                    </button>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="order-2 flex min-h-[240px] w-full flex-1 flex-col overflow-hidden md:order-none md:w-[55%] md:min-h-0"
                initial={false}
                animate={{
                  backgroundColor: isClientTrustCarouselRight ? CLIENT_TRUST_RIGHT : RIGHT_SAGE,
                }}
                transition={{ duration: 0.35, ease: slideEase }}
              >
                <div className="flex min-h-[240px] flex-1 flex-col items-stretch overflow-visible md:min-h-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${track}-${slideIndex}-${postLoginAudience}-right`}
                      className="flex min-h-0 flex-1 flex-col overflow-visible"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4, ease: slideEase }}
                    >
                      {slides[slideIndex]?.right}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
