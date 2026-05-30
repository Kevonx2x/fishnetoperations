"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * Keeps the server-rendered LCP strip visible until the client marketplace bundle
 * is ready, then unmounts the strip via React (never imperative DOM removal).
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

  useEffect(() => {
    if (!hasLcpStrip) return;
    setClientReady(true);
  }, [hasLcpStrip]);

  return (
    <>
      {hasLcpStrip && !clientReady ? lcpStrip : null}
      <div className={hasLcpStrip && !clientReady ? "max-md:hidden" : undefined}>{children}</div>
    </>
  );
}
