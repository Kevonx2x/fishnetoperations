"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type BahayGoGoGlowContextValue = {
  /** Increments on each route change to re-trigger the neon glow. */
  glowGeneration: number;
};

const BahayGoGoGlowContext = createContext<BahayGoGoGlowContextValue>({ glowGeneration: 0 });

export function BahayGoGoGlowProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [glowGeneration, setGlowGeneration] = useState(0);
  const isFirstPath = useRef(true);

  useEffect(() => {
    if (isFirstPath.current) {
      isFirstPath.current = false;
      return;
    }
    setGlowGeneration((n) => n + 1);
  }, [pathname]);

  return (
    <BahayGoGoGlowContext.Provider value={{ glowGeneration }}>{children}</BahayGoGoGlowContext.Provider>
  );
}

export function useBahayGoGoGlow() {
  return useContext(BahayGoGoGlowContext);
}
