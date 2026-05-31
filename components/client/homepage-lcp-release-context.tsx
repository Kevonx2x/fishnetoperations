"use client";

import { createContext, useContext, type ReactNode } from "react";

type HomepageLcpReleaseContextValue = {
  releaseLcpStrip: () => void;
};

const HomepageLcpReleaseContext = createContext<HomepageLcpReleaseContextValue | null>(null);

export function HomepageLcpReleaseProvider({
  releaseLcpStrip,
  children,
}: {
  releaseLcpStrip: () => void;
  children: ReactNode;
}) {
  return (
    <HomepageLcpReleaseContext.Provider value={{ releaseLcpStrip }}>
      {children}
    </HomepageLcpReleaseContext.Provider>
  );
}

export function useReleaseHomepageLcpStrip(): (() => void) | null {
  return useContext(HomepageLcpReleaseContext)?.releaseLcpStrip ?? null;
}
