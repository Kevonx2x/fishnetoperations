"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type MobileChromeDispatchValue = {
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  setStickyFooter: Dispatch<SetStateAction<ReactNode | null>>;
};

const MobileChromeDispatchContext = createContext<MobileChromeDispatchValue | null>(null);
const MobileChromeStickyFooterContext = createContext<ReactNode | null>(null);

export function MobileChromeProvider({ children }: { children: ReactNode }) {
  const [overlayOpen, setOverlayOpenState] = useState(false);
  const [stickyFooter, setStickyFooter] = useState<ReactNode | null>(null);
  const setOverlayOpen = useCallback((open: boolean) => setOverlayOpenState(open), []);
  const dispatch = useMemo(
    () => ({ overlayOpen, setOverlayOpen, setStickyFooter }),
    [overlayOpen],
  );

  return (
    <MobileChromeDispatchContext.Provider value={dispatch}>
      <MobileChromeStickyFooterContext.Provider value={stickyFooter}>
        {children}
      </MobileChromeStickyFooterContext.Provider>
    </MobileChromeDispatchContext.Provider>
  );
}

function useMobileChromeDispatch() {
  return useContext(MobileChromeDispatchContext);
}

export function useMobileChromeOverlay() {
  const ctx = useMobileChromeDispatch();
  if (!ctx) {
    return { overlayOpen: false, setOverlayOpen: () => {} };
  }
  return { overlayOpen: ctx.overlayOpen, setOverlayOpen: ctx.setOverlayOpen };
}

/** Set slot content above the bottom nav. Does not re-render when footer content changes. */
export function useMobileStickyFooter() {
  const ctx = useMobileChromeDispatch();
  if (!ctx) {
    return { setStickyFooter: () => {} };
  }
  return { setStickyFooter: ctx.setStickyFooter };
}

/** Read sticky footer slot content (layout chrome only). */
export function useMobileStickyFooterContent() {
  return useContext(MobileChromeStickyFooterContext);
}
