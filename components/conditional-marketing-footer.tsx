"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** BahayGo marketing footer — hidden on dormspaces sub-product routes. */
export function ConditionalMarketingFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/dormspaces") || pathname.startsWith("/messenger")) {
    return null;
  }
  return <div className="hidden min-h-[300px] md:block">{children}</div>;
}
