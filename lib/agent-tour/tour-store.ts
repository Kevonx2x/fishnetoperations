import { create } from "zustand";

export type AgentTourStepId = 1 | 2 | 3 | 4 | 5;

export type AgentTourState = {
  isOpen: boolean;
  currentStep: AgentTourStepId;
  firstName: string;
  /** When true, next time pathname is `/` the tour starts immediately (Help replay). */
  pendingHelpStart: boolean;
  /** Step 3: no real viewing card found — show demo card + centered fallback rect. */
  step3DemoFallback: boolean;
  /** Prevents double-clicks while async step transitions run. */
  transitionLocked: boolean;

  setTransitionLocked: (v: boolean) => void;
  setStep3DemoFallback: (v: boolean) => void;
  requestHelpStart: () => void;
  consumeHelpStart: () => void;

  start: (firstName: string) => void;
  close: () => void;
  setStep: (step: AgentTourStepId) => void;
  reset: () => void;
};

const initial: Pick<
  AgentTourState,
  "isOpen" | "currentStep" | "firstName" | "pendingHelpStart" | "step3DemoFallback" | "transitionLocked"
> = {
  isOpen: false,
  currentStep: 1,
  firstName: "there",
  pendingHelpStart: false,
  step3DemoFallback: false,
  transitionLocked: false,
};

export const useAgentTourStore = create<AgentTourState>((set) => ({
  ...initial,

  setTransitionLocked: (v) => set({ transitionLocked: v }),
  setStep3DemoFallback: (v) => set({ step3DemoFallback: v }),
  requestHelpStart: () => set({ pendingHelpStart: true }),
  consumeHelpStart: () => set({ pendingHelpStart: false }),

  start: (firstName) =>
    set({
      isOpen: true,
      currentStep: 1,
      firstName: firstName.trim() || "there",
      step3DemoFallback: false,
      transitionLocked: false,
    }),

  close: () =>
    set({
      isOpen: false,
      currentStep: 1,
      pendingHelpStart: false,
      step3DemoFallback: false,
      transitionLocked: false,
    }),

  setStep: (step) => set({ currentStep: step }),

  reset: () => set({ ...initial }),
}));
