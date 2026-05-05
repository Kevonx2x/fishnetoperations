import type { AgentTourStepId } from "@/lib/agent-tour/tour-store";
import { useAgentTourStore } from "@/lib/agent-tour/tour-store";

export type TourRouterLike = {
  push: (href: string) => void;
  replace: (href: string, opts?: { scroll?: boolean }) => void;
};

export type TourActionContext = {
  router: TourRouterLike;
  sleep: (ms: number) => Promise<void>;
  waitForSelector: (selector: string, timeoutMs?: number) => Promise<Element | null>;
};

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => window.setTimeout(r, ms));
}

export async function waitForSelector(selector: string, timeoutMs = 1000, intervalMs = 40): Promise<Element | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(intervalMs);
  }
  return null;
}

/** Match `page` from step config to current location. */
export function pathMatchesTourPage(page: string, pathname: string, search: string): boolean {
  const qIdx = page.indexOf("?");
  const base = qIdx === -1 ? page : page.slice(0, qIdx);
  const needQs = qIdx === -1 ? "" : page.slice(qIdx + 1);
  if (pathname !== base) return false;
  if (!needQs) {
    if (base === "/dashboard/agent") {
      const sp = new URLSearchParams(search);
      const t = sp.get("tab");
      return t === null || t === "" || t === "overview";
    }
    return true;
  }
  const need = new URLSearchParams(needQs);
  const have = new URLSearchParams(search);
  for (const [k, v] of need.entries()) {
    if (have.get(k) !== v) return false;
  }
  return true;
}

export type TourStepConfig = {
  id: AgentTourStepId;
  page: string;
  targetSelector: string;
  headline: (ctx: { firstName: string }) => string;
  body: string;
  showBack: boolean;
  /** Last step uses completion label instead of "Next". */
  primaryComplete: boolean;
  beforeNext?: (ctx: TourActionContext) => Promise<void>;
  afterNext?: (ctx: TourActionContext) => Promise<void>;
  /** Runs when leaving this step via Back (e.g. close UI before showing previous step). */
  beforeBack?: (ctx: TourActionContext) => Promise<void>;
};

function closeKanbanMenu(): void {
  const backdrop = document.querySelector("[data-kanban-menu-backdrop=\"true\"]") as HTMLElement | null;
  backdrop?.click();
}

export const AGENT_TOUR_STEPS: TourStepConfig[] = [
  {
    id: 1,
    page: "/",
    targetSelector: "[data-tour=\"avatar-button\"]",
    headline: ({ firstName }) => `Welcome to BahayGo, ${firstName}`,
    body: "View your dashboard here to see your pipeline, messages, and more.",
    showBack: false,
    primaryComplete: false,
    beforeNext: async (ctx) => {
      const btn = document.querySelector<HTMLElement>("[data-tour=\"avatar-button\"]");
      btn?.click();
      await ctx.sleep(150);
    },
    afterNext: async (ctx) => {
      ctx.router.push("/dashboard/agent");
      await ctx.sleep(500);
    },
  },
  {
    id: 2,
    page: "/dashboard/agent",
    targetSelector: "[data-tour=\"agent-sidebar\"]",
    headline: () => "Your dashboard",
    body: "Everything you need is here. Pipeline tracks your deals, Messages connects you with clients, Listings manages your properties, and more.",
    showBack: true,
    primaryComplete: false,
    afterNext: async (ctx) => {
      ctx.router.push("/dashboard/agent?tab=pipeline");
      const el = await ctx.waitForSelector("[data-tour=\"viewing-card\"]", 1000);
      useAgentTourStore.getState().setStep3DemoFallback(!el);
      await ctx.sleep(el ? 80 : 120);
    },
  },
  {
    id: 3,
    page: "/dashboard/agent?tab=pipeline",
    targetSelector: "[data-tour=\"viewing-card\"]",
    headline: () => "This is your deal card",
    body: "Each card represents a deal in your pipeline. Tap to see client details, message them, and manage documents.",
    showBack: true,
    primaryComplete: false,
    beforeNext: async (ctx) => {
      const trigger = document.querySelector<HTMLElement>("[data-tour=\"viewing-card-menu-trigger\"]");
      if (trigger) {
        trigger.click();
        await ctx.sleep(150);
      } else {
        await ctx.sleep(80);
      }
    },
  },
  {
    id: 4,
    page: "/dashboard/agent?tab=pipeline",
    targetSelector: "[data-tour=\"viewing-card-menu-content\"]",
    headline: () => "Action items live here",
    body: "Tap the three dots on any card to view documents, approve viewing requests, or message the client. A green dot means there's something new for you.",
    showBack: true,
    primaryComplete: false,
    beforeBack: async (ctx) => {
      closeKanbanMenu();
      await ctx.sleep(100);
    },
    afterNext: async (ctx) => {
      closeKanbanMenu();
      await ctx.sleep(100);
      ctx.router.push("/dashboard/agent?tab=messages");
      await ctx.sleep(500);
    },
  },
  {
    id: 5,
    page: "/dashboard/agent?tab=messages",
    targetSelector: "[data-tour=\"messages-panel\"]",
    headline: () => "Stay connected",
    body: "All client messages land here. Reply directly — no email back-and-forth needed.",
    showBack: true,
    primaryComplete: true,
  },
];

export function getStepConfig(step: AgentTourStepId): TourStepConfig {
  return AGENT_TOUR_STEPS[step - 1]!;
}
