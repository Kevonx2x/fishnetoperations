"use client";

import { type ReactNode, useCallback, useState } from "react";

import { HomepageLcpReleaseProvider } from "@/components/client/homepage-lcp-release-context";

/**
 * Keeps the server-rendered LCP strip visible until the marketplace client bundle
 * mounts and calls releaseLcpStrip() — never imperative DOM removal.
 */
export function HomepageLcpOrchestrator({
  hasLcpStrip,
  lcpStrip,
  children,
}: {
  hasLcpStrip: boolean;
  lcpStrip: ReactNode;
  children: ReactNode;
}) {
  const [clientReady, setClientReady] = useState(!hasLcpStrip);
  const releaseLcpStrip = useCallback(() => {
    setClientReady(true);
  }, []);

  return (
    <HomepageLcpReleaseProvider releaseLcpStrip={releaseLcpStrip}>
      {hasLcpStrip && !clientReady ? lcpStrip : null}
      <div className={hasLcpStrip && !clientReady ? "max-md:hidden" : undefined}>{children}</div>
    </HomepageLcpReleaseProvider>
  );
}
