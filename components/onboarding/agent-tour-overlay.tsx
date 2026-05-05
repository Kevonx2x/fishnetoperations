"use client";

import { useAuth } from "@/contexts/auth-context";
import {
  getStepConfig,
  pathMatchesTourPage,
  sleep,
  waitForSelector,
  type TourActionContext,
} from "@/lib/agent-tour/tour-config";
import { useAgentTourStore, type AgentTourStepId } from "@/lib/agent-tour/tour-store";
import { ChevronRight, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

const OVERLAY_Z = 10050;
const TOOLTIP_Z = 10060;
const DEMO_CARD_Z = 10055;

function demoCardRect(): { x: number; y: number; width: number; height: number } {
  const w = Math.min(280, window.innerWidth - 48);
  const h = 168;
  const x = Math.max(24, Math.min(window.innerWidth - w - 24, window.innerWidth * 0.22));
  const y = Math.max(100, Math.min(window.innerHeight - h - 120, window.innerHeight * 0.28));
  return { x, y, width: w, height: h };
}

function padRect(
  r: { x: number; y: number; width: number; height: number },
  pad: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.max(0, r.x - pad),
    y: Math.max(0, r.y - pad),
    width: Math.min(window.innerWidth, r.width + pad * 2),
    height: Math.min(window.innerHeight, r.height + pad * 2),
  };
}

function pickTooltipPosition(
  hole: { x: number; y: number; width: number; height: number },
  tw: number,
  th: number,
): { left: number; top: number } {
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceRight = vw - margin - (hole.x + hole.width);
  const spaceLeft = hole.x - margin;
  const spaceBelow = vh - margin - (hole.y + hole.height);
  const spaceAbove = hole.y - margin;

  if (spaceRight >= tw + margin) {
    return { left: hole.x + hole.width + margin, top: Math.max(margin, Math.min(vh - th - margin, hole.y)) };
  }
  if (spaceBelow >= th + margin) {
    return { left: Math.max(margin, Math.min(vw - tw - margin, hole.x)), top: hole.y + hole.height + margin };
  }
  if (spaceLeft >= tw + margin) {
    return { left: hole.x - tw - margin, top: Math.max(margin, Math.min(vh - th - margin, hole.y)) };
  }
  if (spaceAbove >= th + margin) {
    return { left: Math.max(margin, Math.min(vw - tw - margin, hole.x)), top: hole.y - th - margin };
  }
  return { left: (vw - tw) / 2, top: (vh - th) / 2 };
}

async function postCompleteTutorial(): Promise<boolean> {
  const res = await fetch("/api/profile/complete-tutorial", { method: "POST", credentials: "include" });
  return res.ok;
}

export function AgentTourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const { refreshProfile } = useAuth();
  const maskId = useId().replace(/:/g, "");

  const isOpen = useAgentTourStore((s) => s.isOpen);
  const currentStep = useAgentTourStore((s) => s.currentStep);
  const firstName = useAgentTourStore((s) => s.firstName);
  const step3Demo = useAgentTourStore((s) => s.step3DemoFallback);
  const transitionLocked = useAgentTourStore((s) => s.transitionLocked);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hole, setHole] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number }>({ left: 16, top: 80 });

  const cfg = useMemo(() => getStepConfig(currentStep), [currentStep]);

  const ctx = useMemo<TourActionContext>(
    () => ({
      router: { push: (h) => router.push(h), replace: (h, o) => router.replace(h, o) },
      sleep,
      waitForSelector,
    }),
    [router],
  );

  const measure = useCallback(() => {
    if (!isOpen) return;
    const step = useAgentTourStore.getState().currentStep;
    const c = getStepConfig(step);
    let r: { x: number; y: number; width: number; height: number } | null = null;

    if (step === 3 && useAgentTourStore.getState().step3DemoFallback) {
      r = demoCardRect();
    } else {
      const el = document.querySelector(c.targetSelector);
      if (el) {
        const br = el.getBoundingClientRect();
        if (br.width > 0 && br.height > 0) r = { x: br.left, y: br.top, width: br.width, height: br.height };
      }
    }

    if (r) {
      const padded = padRect(r, 10);
      setHole(padded);
      setTooltipPos(pickTooltipPosition(padded, 380, 320));
    } else {
      setHole(null);
      setTooltipPos({ left: Math.max(16, (window.innerWidth - 380) / 2), top: Math.max(80, window.innerHeight * 0.2) });
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setHole(null);
      return;
    }
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const id = window.requestAnimationFrame(function tick() {
      measure();
      window.requestAnimationFrame(tick);
    });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.cancelAnimationFrame(id);
    };
  }, [isOpen, currentStep, step3Demo, measure]);

  const pageOk = pathMatchesTourPage(cfg.page, pathname, search);

  const runLocked = useCallback(
    async (fn: () => Promise<void>) => {
      if (useAgentTourStore.getState().transitionLocked) return;
      useAgentTourStore.getState().setTransitionLocked(true);
      try {
        await fn();
      } finally {
        useAgentTourStore.getState().setTransitionLocked(false);
      }
    },
    [],
  );

  const finishTour = useCallback(async () => {
    await postCompleteTutorial();
    await refreshProfile();
    useAgentTourStore.getState().close();
  }, [refreshProfile]);

  const handleSkip = useCallback(() => {
    void runLocked(async () => {
      await finishTour();
    });
  }, [finishTour, runLocked]);

  const handleNext = useCallback(() => {
    void runLocked(async () => {
      const step = useAgentTourStore.getState().currentStep;
      const c = getStepConfig(step);
      if (c.beforeNext) await c.beforeNext(ctx);
      if (c.afterNext) await c.afterNext(ctx);
      if (step < 5) {
        useAgentTourStore.getState().setStep((step + 1) as AgentTourStepId);
      }
    });
  }, [ctx, runLocked]);

  const handleComplete = useCallback(() => {
    void runLocked(async () => {
      await finishTour();
    });
  }, [finishTour, runLocked]);

  const handleBack = useCallback(() => {
    void runLocked(async () => {
      const step = useAgentTourStore.getState().currentStep;
      if (step <= 1) return;

      if (step === 2) {
        ctx.router.push("/");
        await ctx.sleep(500);
        useAgentTourStore.getState().setStep(1);
        return;
      }
      if (step === 3) {
        useAgentTourStore.getState().setStep3DemoFallback(false);
        ctx.router.replace("/dashboard/agent", { scroll: false });
        await ctx.sleep(500);
        useAgentTourStore.getState().setStep(2);
        return;
      }
      if (step === 4) {
        const c4 = getStepConfig(4);
        if (c4.beforeBack) await c4.beforeBack(ctx);
        useAgentTourStore.getState().setStep(3);
        return;
      }
      if (step === 5) {
        ctx.router.push("/dashboard/agent?tab=pipeline");
        await ctx.sleep(500);
        const trig = await ctx.waitForSelector("[data-tour=\"viewing-card-menu-trigger\"]", 2000);
        (trig as HTMLElement | null)?.click();
        await ctx.sleep(350);
        useAgentTourStore.getState().setStep(4);
      }
    });
  }, [ctx, runLocked]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleSkip]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const root = panelRef.current;
    const t = window.setTimeout(() => {
      const btn = root.querySelector<HTMLElement>("button");
      btn?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [isOpen, currentStep, hole]);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const root = panelRef.current;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = [
        ...root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", handler);
    return () => root.removeEventListener("keydown", handler);
  }, [isOpen, currentStep, hole]);

  if (!isOpen) return null;

  const rx = hole ? Math.max(12, hole.width * 0.04) : 12;
  const maskInner =
    hole != null ? (
      <>
        <rect width="100%" height="100%" fill="white" />
        <rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={rx} ry={rx} fill="black" />
      </>
    ) : (
      <rect width="100%" height="100%" fill="white" />
    );

  return (
    <div className="pointer-events-none fixed inset-0" style={{ zIndex: OVERLAY_Z }} aria-hidden={false}>
      <svg className="pointer-events-auto absolute inset-0 h-full w-full" width="100%" height="100%">
        <defs>
          <mask id={maskId}>{maskInner}</mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
        {hole ? (
          <rect
            x={hole.x - 2}
            y={hole.y - 2}
            width={hole.width + 4}
            height={hole.height + 4}
            rx={rx + 2}
            ry={rx + 2}
            fill="none"
            stroke="rgba(107, 158, 110, 0.85)"
            strokeWidth={3}
            pointerEvents="none"
          />
        ) : null}
      </svg>

      {currentStep === 3 && step3Demo ? (
        <div
          className="pointer-events-none fixed rounded-2xl border border-[#2C2C2C]/10 bg-white p-3 shadow-lg"
          style={{
            zIndex: DEMO_CARD_Z,
            left: demoCardRect().x,
            top: demoCardRect().y,
            width: demoCardRect().width,
            height: demoCardRect().height,
          }}
          aria-hidden
        >
          <div className="h-2 w-24 rounded bg-[#2C2C2C]/10" />
          <div className="mt-3 h-3 w-[90%] rounded bg-[#2C2C2C]/10" />
          <div className="mt-2 h-3 w-[70%] rounded bg-[#2C2C2C]/10" />
        </div>
      ) : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`agent-tour-title-${currentStep}`}
        className="pointer-events-auto fixed w-full max-w-[380px] rounded-2xl bg-white p-7 shadow-xl"
        style={{ left: tooltipPos.left, top: tooltipPos.top, zIndex: TOOLTIP_Z }}
      >
        {!pageOk ? (
          <p className="text-xs text-amber-800">
            Follow the tour navigation — this step expects to be on <span className="font-mono">{cfg.page}</span>.
          </p>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step {currentStep} of 5</p>
        <h2
          id={`agent-tour-title-${currentStep}`}
          className={`mt-3 font-serif font-semibold tracking-tight text-[#2C2C2C] ${currentStep === 1 ? "text-2xl" : "text-xl"}`}
        >
          {cfg.headline({ firstName })}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{cfg.body}</p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-sm font-semibold text-gray-500 underline-offset-2 hover:underline"
            onClick={() => void handleSkip()}
            disabled={transitionLocked}
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {cfg.showBack ? (
              <button
                type="button"
                className="rounded-full border border-[#2C2C2C]/20 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                onClick={() => void handleBack()}
                disabled={transitionLocked}
              >
                Back
              </button>
            ) : null}
            {cfg.primaryComplete ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                onClick={() => void handleComplete()}
                disabled={transitionLocked}
              >
                Start using BahayGo
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                onClick={() => void handleNext()}
                disabled={transitionLocked}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="Tour progress">
          {([1, 2, 3, 4, 5] as const).map((i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i === currentStep ? "bg-[#6B9E6E]" : "bg-[#2C2C2C]/20"}`}
              aria-current={i === currentStep ? "step" : undefined}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label="Skip tour"
        className="pointer-events-auto fixed right-4 top-4 z-[10070] rounded-full bg-white/90 p-2 text-[#2C2C2C]/60 shadow hover:text-[#2C2C2C]"
        onClick={() => void handleSkip()}
        disabled={transitionLocked}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
