"use client";

import { ChevronRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type Rect = { top: number; left: number; width: number; height: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function TourDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mt-5 flex justify-center gap-2" aria-hidden>
      {([0, 1, 2] as const).map((i) => {
        const filled = step === 3 ? true : step === 1 ? i === 0 : i === 1;
        return (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${filled ? "bg-[#6B9E6E]" : "bg-gray-300"}`}
          />
        );
      })}
    </div>
  );
}

function KanbanDemoCardForTour() {
  return (
    <div
      className="kanban-card-demo pointer-events-none w-[220px] select-none rounded-2xl border border-[#2C2C2C]/[0.08] bg-white p-3 shadow-none ring-0 [box-shadow:none]"
      aria-hidden
    >
      <div className="pr-6 pt-1">
        <p className="font-sans text-[15px] font-bold leading-snug tracking-tight text-[#2C2C2C]">
          2BR Condo in Sample Location
        </p>
        <p className="mt-1.5 font-sans text-[12px] font-semibold tabular-nums text-[#2C2C2C]/55">
          ₱25,000/mo
        </p>
      </div>
      <div className="mt-6 flex items-center gap-2 border-t border-transparent pt-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/12 text-[10px] font-bold text-[#6B9E6E]">
          SC
        </div>
        <span className="truncate font-sans text-[11px] font-medium text-[#888888]">Sample Client</span>
      </div>
      <div className="mt-3 flex h-6 w-full shrink-0 items-center justify-between gap-2 rounded-b-2xl bg-[#2C2C2C]/[0.06] px-3 py-0">
        <span className="flex max-w-full shrink-0 flex-row items-center gap-0.5 rounded-md bg-[#D4A843]/12 px-1 py-0 text-[9px] font-semibold leading-none tracking-tight text-[#D4A843]">
          <Clock className="h-2 w-2 shrink-0 opacity-90" aria-hidden />
          <span className="whitespace-nowrap">New request</span>
        </span>
        <p className="min-w-0 flex-1 truncate text-right font-sans text-[10px] font-semibold tracking-tight text-[#2C2C2C]/55">
          Viewing Jan 15 · 2:00 PM
        </p>
      </div>
    </div>
  );
}

type AgentSpotlightTourProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  onNavigatePipeline: () => void;
  onNavigateOverview: () => void;
  onTutorialComplete: () => Promise<void>;
};

export function AgentSpotlightTour({
  open,
  onOpenChange,
  firstName,
  onNavigatePipeline,
  onNavigateOverview,
  onTutorialComplete,
}: AgentSpotlightTourProps) {
  const router = useRouter();
  const maskId = useId().replace(/:/g, "");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null);
  const [useDemoCard, setUseDemoCard] = useState(false);
  const demoWrapRef = useRef<HTMLDivElement | null>(null);
  const step1Ref = useRef<HTMLDivElement | null>(null);
  const step2Ref = useRef<HTMLDivElement | null>(null);
  const step3Ref = useRef<HTMLDivElement | null>(null);

  const resolveTargetRect = useCallback((): Rect | null => {
    const el = document.querySelector("[data-tour=\"viewing-card\"]") as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return null;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSpotlightRect(null);
    setUseDemoCard(false);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || step !== 2) return;

    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const r = resolveTargetRect();
      if (r) {
        setSpotlightRect(r);
        return;
      }
      if (demoWrapRef.current) {
        const dr = demoWrapRef.current.getBoundingClientRect();
        if (dr.width > 4 && dr.height > 4) {
          setSpotlightRect({ top: dr.top, left: dr.left, width: dr.width, height: dr.height });
        }
      }
    };

    const t = window.setTimeout(measure, 450);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, useDemoCard, resolveTargetRect]);

  /** Demo card mounted after `useDemoCard`; measure on next frame. */
  useLayoutEffect(() => {
    if (!open || step !== 2 || !useDemoCard) return;
    const id = requestAnimationFrame(() => {
      if (demoWrapRef.current) {
        const dr = demoWrapRef.current.getBoundingClientRect();
        if (dr.width > 4 && dr.height > 4) {
          setSpotlightRect({ top: dr.top, left: dr.left, width: dr.width, height: dr.height });
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, step, useDemoCard]);

  const finishAndClose = useCallback(
    async (completeTutorial: boolean) => {
      if (completeTutorial) {
        try {
          await onTutorialComplete();
        } catch {
          // still close UI
        }
      }
      onOpenChange(false);
    },
    [onOpenChange, onTutorialComplete],
  );

  const handleSkip = useCallback(() => {
    void finishAndClose(true);
  }, [finishAndClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleSkip]);

  useEffect(() => {
    if (!open) return;
    const root =
      step === 1 ? step1Ref.current : step === 2 ? step2Ref.current : step === 3 ? step3Ref.current : null;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    window.setTimeout(() => first?.focus(), 50);
  }, [open, step, spotlightRect]);

  useEffect(() => {
    if (!open) return;
    const root =
      step === 1 ? step1Ref.current : step === 2 ? step2Ref.current : step === 3 ? step3Ref.current : null;
    if (!root) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = [
        ...root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
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
  }, [open, step, spotlightRect]);

  const goShowMe = () => {
    onNavigatePipeline();
    window.requestAnimationFrame(() => {
      const el = document.querySelector("[data-tour=\"viewing-card\"]") as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
    window.setTimeout(() => {
      const r = resolveTargetRect();
      setUseDemoCard(!r);
      setStep(2);
    }, 550);
  };

  if (!open) return null;

  const pad = 6;
  const rx = 16;
  let hole = spotlightRect;
  if (hole) {
    hole = {
      top: hole.top - pad,
      left: hole.left - pad,
      width: hole.width + pad * 2,
      height: hole.height + pad * 2,
    };
  }

  const tooltipRightOfSpotlight =
    hole &&
    (() => {
      const gap = 16;
      const tw = 380;
      const left = hole.left + hole.width + gap;
      const maxLeft = window.innerWidth - tw - 16;
      const top = clamp(hole.top + hole.height / 2 - 120, 16, window.innerHeight - 280);
      return { left: clamp(left, 16, maxLeft), top };
    })();

  const step2TooltipPosition =
    tooltipRightOfSpotlight ??
    (step === 2 ? { left: (window.innerWidth - 380) / 2, top: (window.innerHeight - 260) / 2 } : null);

  return (
    <div className="fixed inset-0 z-[10000] font-sans" role="presentation">
      {step === 2 && !hole ? (
        <div className="pointer-events-auto fixed inset-0 z-[9998] bg-black/55" aria-hidden />
      ) : null}
      {step === 2 && hole ? (
        <>
          <svg className="pointer-events-auto fixed inset-0 h-full w-full" aria-hidden>
            <defs>
              <mask id={`agent-spotlight-mask-${maskId}`}>
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={hole.left}
                  y={hole.top}
                  width={hole.width}
                  height={hole.height}
                  rx={rx}
                  ry={rx}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.55)"
              mask={`url(#agent-spotlight-mask-${maskId})`}
            />
          </svg>
          <div
            className="pointer-events-none fixed z-[10001] rounded-2xl border-[3px] border-[#6B9E6E]"
            style={{
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              boxShadow: "0 0 0 3px #6B9E6E, 0 0 24px rgba(107, 158, 110, 0.4)",
            }}
          />
        </>
      ) : null}

      {step === 2 && useDemoCard ? (
        <div
          ref={demoWrapRef}
          className="fixed z-[10002]"
          style={{
            top: "clamp(180px, 28vh, 320px)",
            left: "clamp(200px, calc(180px + 32vw), 560px)",
          }}
        >
          <KanbanDemoCardForTour />
        </div>
      ) : null}

      {step === 1 ? (
        <div
          className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
        >
          <div
            ref={step1Ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-tour-s1-title"
            className="relative w-full max-w-[380px] rounded-2xl bg-white p-7 shadow-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1 of 3</p>
            <h2
              id="agent-tour-s1-title"
              className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C]"
            >
              Welcome to BahayGo, {firstName} 👋
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Your pipeline is where every deal lives. Let&apos;s take a quick tour — under 30 seconds.
            </p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm font-semibold text-gray-500 underline-offset-2 hover:underline"
                onClick={() => void handleSkip()}
                aria-label="Skip tour"
              >
                Skip tour
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                onClick={goShowMe}
                aria-label="Show me"
              >
                Show me
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <TourDots step={1} />
          </div>
        </div>
      ) : null}

      {step === 2 && step2TooltipPosition ? (
        <div
          ref={step2Ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-tour-s2-title"
          className="pointer-events-auto fixed z-[10003] w-full max-w-[380px] rounded-2xl bg-white p-7 shadow-xl"
          style={{
            left: step2TooltipPosition.left,
            top: step2TooltipPosition.top,
          }}
        >
          {tooltipRightOfSpotlight ? (
            <div
              className="absolute left-0 top-8 z-10 h-0 w-0 -translate-x-full border-y-[8px] border-r-[10px] border-y-transparent border-r-white drop-shadow-sm"
              aria-hidden
            />
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2 of 3</p>
          <h2 id="agent-tour-s2-title" className="mt-3 font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">
            Action lives here
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            When a client sends a viewing request or asks to reschedule, you&apos;ll see a gold badge in the card
            footer. Tap the three-dot menu to view documents, approve, or decline.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="text-sm font-semibold text-gray-500 underline-offset-2 hover:underline"
              onClick={() => void handleSkip()}
              aria-label="Skip tour"
            >
              Skip tour
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full border border-[#2C2C2C]/20 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4]"
                onClick={() => setStep(1)}
                aria-label="Back"
              >
                Back
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                onClick={() => setStep(3)}
                aria-label="Next"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <TourDots step={2} />
        </div>
      ) : null}

      {step === 3 ? (
        <div
          className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/55 p-4"
          role="presentation"
        >
          <div
            ref={step3Ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="agent-tour-s3-title"
            className="relative w-full max-w-[380px] rounded-2xl bg-white p-7 shadow-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 3 of 3</p>
            <h2 id="agent-tour-s3-title" className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C]">
              You&apos;re all set 🎉
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Add your first listing and start receiving inquiries. We&apos;re glad to have you.
            </p>
            <button
              type="button"
              className="mt-8 w-full rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
              onClick={() => {
                void (async () => {
                  try {
                    await onTutorialComplete();
                  } catch {
                    // ignore
                  }
                  onNavigateOverview();
                  router.replace("/dashboard/agent?tab=overview");
                  onOpenChange(false);
                })();
              }}
              aria-label="Start using BahayGo"
            >
              Start using BahayGo
            </button>
            <TourDots step={3} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
