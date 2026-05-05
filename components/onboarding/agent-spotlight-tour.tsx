"use client";

import { ChevronRight, Clock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type Rect = { top: number; left: number; width: number; height: number };
type TourStep = 1 | 2 | 3 | 4 | 5;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

/** Poll for an element up to `timeoutMs` (default 2s). */
function waitForElement(selector: string, timeoutMs = 2000): Promise<Element | null> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      if (performance.now() - t0 >= timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function rectFromEl(el: Element | null): Rect | null {
  if (!el || !(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function TourDots({ step }: { step: TourStep }) {
  return (
    <div className="mt-5 flex justify-center gap-2" aria-hidden>
      {([0, 1, 2, 3, 4] as const).map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < step ? "bg-[#6B9E6E]" : "bg-gray-300"}`}
        />
      ))}
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

function SpotlightLayer({
  maskId,
  hole,
  rx,
}: {
  maskId: string;
  hole: Rect;
  rx: number;
}) {
  return (
    <>
      <svg className="pointer-events-auto fixed inset-0 z-[10000] h-full w-full" aria-hidden>
        <defs>
          <mask id={`agent-spotlight-mask-${maskId}`}>
            <rect width="100%" height="100%" fill="white" />
            <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx={rx} ry={rx} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask={`url(#agent-spotlight-mask-${maskId})`} />
      </svg>
      <div
        className="pointer-events-none fixed z-[10001] border-[3px] border-[#6B9E6E] bg-transparent"
        style={{
          left: hole.left,
          top: hole.top,
          width: hole.width,
          height: hole.height,
          borderRadius: rx,
          boxShadow: "0 0 0 3px #6B9E6E, 0 0 24px rgba(107, 158, 110, 0.4)",
        }}
      />
    </>
  );
}

type AgentSpotlightTourProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  onTutorialComplete: () => Promise<void>;
};

export function AgentSpotlightTour({
  open,
  onOpenChange,
  firstName,
  onTutorialComplete,
}: AgentSpotlightTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const maskId = useId().replace(/:/g, "");
  const [step, setStep] = useState<TourStep>(1);
  const [spotlightRect, setSpotlightRect] = useState<Rect | null>(null);
  const [useDemoCard, setUseDemoCard] = useState(false);
  /** Viewing column had no real card / menu trigger — fake menu for step 4. */
  const [useMockKanbanMenu, setUseMockKanbanMenu] = useState(false);
  const demoWrapRef = useRef<HTMLDivElement | null>(null);
  const mockMenuWrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const resolveViewingCardRect = useCallback((): Rect | null => {
    return rectFromEl(document.querySelector("[data-tour=\"viewing-card\"]"));
  }, []);

  const resolveAvatarButton = useCallback((): HTMLButtonElement | null => {
    return document.querySelector(
      "header button[aria-haspopup=\"menu\"].rounded-full",
    ) as HTMLButtonElement | null;
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSpotlightRect(null);
    setUseDemoCard(false);
    setUseMockKanbanMenu(false);
  }, [open]);

  useEffect(() => {
    if (!open || step !== 1) return;
    if (pathname !== "/") router.replace("/");
  }, [open, step, pathname, router]);

  /** Re-measure spotlight target for the current step. */
  useLayoutEffect(() => {
    if (!open) return;

    let cancelled = false;
    const measure = async () => {
      if (cancelled) return;

      if (step === 1) {
        const el = (await waitForElement("header button[aria-haspopup=\"menu\"].rounded-full")) as HTMLElement | null;
        setSpotlightRect(rectFromEl(el));
        return;
      }
      if (step === 2) {
        const el = (await waitForElement("[data-tour=\"agent-dashboard-sidebar\"]")) as HTMLElement | null;
        setSpotlightRect(rectFromEl(el));
        return;
      }
      if (step === 3) {
        const r = resolveViewingCardRect();
        if (r) {
          setUseDemoCard(false);
          setSpotlightRect(r);
          return;
        }
        setUseDemoCard(true);
        return;
      }
      if (step === 4) {
        if (useMockKanbanMenu) return;
        const el = (await waitForElement("[data-kanban-portal-menu=\"true\"]")) as HTMLElement | null;
        setSpotlightRect(rectFromEl(el));
        return;
      }
      if (step === 5) {
        const el = (await waitForElement("[data-tour=\"agent-messages-conversation-list\"]")) as HTMLElement | null;
        setSpotlightRect(rectFromEl(el));
        return;
      }
    };

    const t = window.setTimeout(() => void measure(), step === 4 ? 50 : 200);
    const onResize = () => void measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, step, resolveViewingCardRect, useMockKanbanMenu]);

  useLayoutEffect(() => {
    if (!open || step !== 4 || !useMockKanbanMenu) return;
    const id = window.setTimeout(() => {
      if (mockMenuWrapRef.current) setSpotlightRect(rectFromEl(mockMenuWrapRef.current));
    }, 80);
    return () => clearTimeout(id);
  }, [open, step, useMockKanbanMenu]);

  useLayoutEffect(() => {
    if (!open || step !== 3 || !useDemoCard) return;
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

  const closeKanbanMenu = useCallback(() => {
    if (useMockKanbanMenu) return;
    if (!document.querySelector("[data-kanban-portal-menu=\"true\"]")) return;
    const trigger = document.querySelector(
      "[data-tour=\"viewing-card-menu-trigger\"]",
    ) as HTMLButtonElement | null;
    trigger?.click();
  }, [useMockKanbanMenu]);

  const closeAvatarMenu = useCallback(() => {
    const btn = resolveAvatarButton();
    if (btn?.getAttribute("aria-expanded") === "true") btn.click();
  }, [resolveAvatarButton]);

  const finishAndClose = useCallback(
    async (completeTutorial: boolean) => {
      setUseMockKanbanMenu(false);
      closeKanbanMenu();
      closeAvatarMenu();
      if (completeTutorial) {
        try {
          await onTutorialComplete();
        } catch {
          // ignore
        }
      }
      onOpenChange(false);
    },
    [closeAvatarMenu, closeKanbanMenu, onOpenChange, onTutorialComplete],
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
    const root = panelRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    window.setTimeout(() => first?.focus(), 50);
  }, [open, step, spotlightRect]);

  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
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

  const step1Next = async () => {
    const avatarBtn = resolveAvatarButton();
    if (avatarBtn && avatarBtn.getAttribute("aria-expanded") !== "true") {
      avatarBtn.click();
    }
    await sleep(300);
    if (avatarBtn && avatarBtn.getAttribute("aria-expanded") === "true") {
      avatarBtn.click();
    }
    await sleep(100);
    router.push("/dashboard/agent");
    await sleep(500);
    setStep(2);
  };

  const step2Next = async () => {
    router.push("/dashboard/agent?tab=pipeline");
    await sleep(500);
    const r = resolveViewingCardRect();
    setUseDemoCard(!r);
    setStep(3);
  };

  const step3Next = async () => {
    const menuBtn = document.querySelector(
      "[data-tour=\"viewing-card-menu-trigger\"]",
    ) as HTMLButtonElement | null;
    if (menuBtn) {
      setUseMockKanbanMenu(false);
      if (!document.querySelector("[data-kanban-portal-menu=\"true\"]")) menuBtn.click();
    } else {
      setUseMockKanbanMenu(true);
    }
    await sleep(300);
    setStep(4);
  };

  const step4Back = async () => {
    closeKanbanMenu();
    setUseMockKanbanMenu(false);
    await sleep(200);
    setStep(3);
  };

  const step4Next = async () => {
    closeKanbanMenu();
    setUseMockKanbanMenu(false);
    await sleep(200);
    router.push("/dashboard/agent?tab=messages");
    await sleep(500);
    setStep(5);
  };

  const step5Back = async () => {
    router.push("/dashboard/agent?tab=pipeline");
    await sleep(500);
    const menuBtn = document.querySelector(
      "[data-tour=\"viewing-card-menu-trigger\"]",
    ) as HTMLButtonElement | null;
    if (menuBtn && !document.querySelector("[data-kanban-portal-menu=\"true\"]")) {
      menuBtn.click();
    }
    await sleep(350);
    setStep(4);
  };

  const step2Back = async () => {
    router.push("/");
    await sleep(500);
    setStep(1);
  };

  const step3Back = async () => {
    router.push("/dashboard/agent");
    await sleep(500);
    setStep(2);
  };

  if (!open) return null;

  const pad = 6;
  const rx = step === 2 ? 12 : 16;
  let hole = spotlightRect;
  if (hole) {
    hole = {
      top: hole.top - pad,
      left: hole.left - pad,
      width: hole.width + pad * 2,
      height: hole.height + pad * 2,
    };
  }

  const tw = 380;
  const fallbackModalPos = { left: clamp((window.innerWidth - tw) / 2, 12, window.innerWidth - tw - 12), top: clamp((window.innerHeight - 280) / 2, 12, window.innerHeight - 300) };

  let tooltipStyle: { left: number; top: number } = fallbackModalPos;
  let showArrowLeft = false;
  let showArrowTop = false;

  if (hole) {
    if (step === 1) {
      const spaceBelow = window.innerHeight - (hole.top + hole.height);
      const placeBelow = spaceBelow >= 200;
      if (placeBelow) {
        tooltipStyle = {
          left: clamp(hole.left + hole.width / 2 - tw / 2, 12, window.innerWidth - tw - 12),
          top: hole.top + hole.height + 16,
        };
        showArrowTop = true;
      } else {
        tooltipStyle = {
          left: clamp(hole.left - tw - 16, 12, window.innerWidth - tw - 12),
          top: clamp(hole.top + hole.height / 2 - 130, 12, window.innerHeight - 280),
        };
        showArrowLeft = true;
      }
    } else if (step === 2) {
      tooltipStyle = {
        left: clamp(hole.left + hole.width + 16, 12, window.innerWidth - tw - 12),
        top: clamp(hole.top + 24, 12, window.innerHeight - 280),
      };
      showArrowLeft = true;
    } else if (step === 3 || step === 4) {
      tooltipStyle = {
        left: clamp(hole.left + hole.width + 16, 12, window.innerWidth - tw - 12),
        top: clamp(hole.top + hole.height / 2 - 130, 12, window.innerHeight - 300),
      };
      showArrowLeft = true;
    } else {
      tooltipStyle = {
        left: clamp(hole.left + hole.width + 16, 12, window.innerWidth - tw - 12),
        top: clamp(hole.top + 40, 12, window.innerHeight - 300),
      };
      showArrowLeft = true;
    }
  }

  const showSpotlight = Boolean(hole && [1, 2, 3, 4, 5].includes(step));
  const showDemo = step === 3 && useDemoCard;

  return (
    <div className="fixed inset-0 z-[10000] font-sans" role="presentation">
      {showSpotlight && !hole ? (
        <div className="pointer-events-auto fixed inset-0 z-[9998] bg-black/55" aria-hidden />
      ) : null}
      {showSpotlight && hole ? <SpotlightLayer maskId={maskId} hole={hole} rx={rx} /> : null}

      {showDemo ? (
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

      {step === 4 && useMockKanbanMenu ? (
        <div
          ref={mockMenuWrapRef}
          className="fixed z-[10002] w-[min(280px,calc(100vw-24px))] rounded-lg border border-[#E5E5E5] bg-white p-1.5 text-[#2C2C2C] shadow-lg"
          style={{
            top: "clamp(260px, 36vh, 400px)",
            left: "clamp(200px, calc(180px + 32vw + 230px), 720px)",
          }}
          aria-hidden
        >
          <div className="space-y-0.5 px-1 py-1 text-[13px] font-semibold">
            <div className="rounded-md px-2.5 py-2 text-left text-[#2C2C2C]/80">View documents</div>
            <div className="rounded-md px-2.5 py-2 text-left text-[#2C2C2C]/80">View viewing request</div>
            <div className="rounded-md px-2.5 py-2 text-left text-[#2C2C2C]/80">Message client</div>
          </div>
        </div>
      ) : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`agent-tour-title-${step}`}
        className="pointer-events-auto fixed z-[10003] w-full max-w-[380px] rounded-2xl bg-white p-7 shadow-xl"
        style={{ left: tooltipStyle.left, top: tooltipStyle.top }}
      >
        {showArrowLeft && hole ? (
          <div
            className="absolute left-0 top-10 z-10 h-0 w-0 -translate-x-full border-y-[8px] border-r-[10px] border-y-transparent border-r-white drop-shadow-sm"
            aria-hidden
          />
        ) : null}
        {showArrowTop && hole ? (
          <div
            className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-full border-x-[8px] border-b-[10px] border-x-transparent border-b-white drop-shadow-sm"
            aria-hidden
          />
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 1 of 5</p>
            <h2 id="agent-tour-title-1" className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C]">
              Welcome to BahayGo, {firstName} 👋
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              View your dashboard here to see your pipeline, messages, and more.
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
                onClick={() => void step1Next()}
                aria-label="Next"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <TourDots step={1} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 2 of 5</p>
            <h2 id="agent-tour-title-2" className="mt-3 font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">
              Your dashboard
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Everything you need is here. Pipeline tracks your deals, Messages connects you with clients, Listings
              manages your properties, and more.
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
                  onClick={() => void step2Back()}
                  aria-label="Back"
                >
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                  onClick={() => void step2Next()}
                  aria-label="Next"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <TourDots step={2} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 3 of 5</p>
            <h2 id="agent-tour-title-3" className="mt-3 font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">
              This is your deal card
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Each card represents a deal in your pipeline. Tap to see client details, message them, and manage
              documents.
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
                  onClick={() => void step3Back()}
                  aria-label="Back"
                >
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                  onClick={() => void step3Next()}
                  aria-label="Next"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <TourDots step={3} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 4 of 5</p>
            <h2 id="agent-tour-title-4" className="mt-3 font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">
              Action items live here
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Tap the three dots on any card to view documents, approve viewing requests, or message the client. A green
              dot means there&apos;s something new for you.
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
                  onClick={() => void step4Back()}
                  aria-label="Back"
                >
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                  onClick={() => void step4Next()}
                  aria-label="Next"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <TourDots step={4} />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Step 5 of 5</p>
            <h2 id="agent-tour-title-5" className="mt-3 font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C]">
              Stay connected
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              All client messages land here. Reply directly — no email back-and-forth needed.
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
                  onClick={() => void step5Back()}
                  aria-label="Back"
                >
                  Back
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#5a8a5d]"
                  onClick={() => {
                    void (async () => {
                      try {
                        await onTutorialComplete();
                      } catch {
                        // ignore
                      }
                      onOpenChange(false);
                    })();
                  }}
                  aria-label="Start using BahayGo"
                >
                  Start using BahayGo
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <TourDots step={5} />
          </>
        ) : null}
      </div>
    </div>
  );
}
