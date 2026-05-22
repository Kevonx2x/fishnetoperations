"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MobileLayoutChrome } from "@/components/mobile/mobile-layout-chrome";

/**
 * Hides the global marketing footer on dashboard routes so the dashboard shell
 * owns vertical scrolling and sticky sidebars work (footer was a sibling below
 * all pages, forcing the whole page—including the shell—to scroll).
 */
export function RootLayoutChrome({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const isDashboard = pathname.startsWith("/dashboard");
  const isDormspacePortal = pathname.startsWith("/dormspaces");

  if (isDashboard || isDormspacePortal) {
    return <MobileLayoutChrome>{children}</MobileLayoutChrome>;
  }

  return (
    <MobileLayoutChrome>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        {footer}
      </div>
    </MobileLayoutChrome>
  );
}
