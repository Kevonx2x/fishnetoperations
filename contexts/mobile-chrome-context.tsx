"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type MobileChromeContextValue = {
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
};

const MobileChromeContext = createContext<MobileChromeContextValue | null>(null);

export function MobileChromeProvider({ children }: { children: ReactNode }) {
  const [overlayOpen, setOverlayOpenState] = useState(false);
  const setOverlayOpen = useCallback((open: boolean) => setOverlayOpenState(open), []);
  const value = useMemo(() => ({ overlayOpen, setOverlayOpen }), [overlayOpen, setOverlayOpen]);
  return <MobileChromeContext.Provider value={value}>{children}</MobileChromeContext.Provider>;
}

export function useMobileChromeOverlay() {
  const ctx = useContext(MobileChromeContext);
  if (!ctx) {
    return { overlayOpen: false, setOverlayOpen: () => {} };
  }
  return ctx;
}
