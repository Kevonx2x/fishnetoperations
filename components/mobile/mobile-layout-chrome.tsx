"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { isMessagesThreadOpen } from "@/lib/messages-mobile-chrome";
import { cn } from "@/lib/utils";

function MobileLayoutContent({
  children,
  messagesThreadOpen,
}: {
  children: ReactNode;
  messagesThreadOpen: boolean;
}) {
  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-col overflow-x-clip overflow-y-visible",
          /* Mobile: let the document scroll (flex-1 + min-h-0 traps content inside 100vh). */
          "max-md:h-auto max-md:min-h-0 max-md:flex-none",
          "md:min-h-0 md:flex-1",
          messagesThreadOpen ? "max-md:pb-0" : "pb-[80px] md:pb-0",
        )}
      >
        {children}
      </div>
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </>
  );
}

function MobileLayoutChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const channel = useSearchParams().get("channel");
  const messagesThreadOpen = isMessagesThreadOpen(pathname, channel);

  return (
    <MobileLayoutContent messagesThreadOpen={messagesThreadOpen}>
      {children}
    </MobileLayoutContent>
  );
}

/** Wraps page content with mobile bottom-nav clearance and mounts global mobile nav. */
export function MobileLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<MobileLayoutContent messagesThreadOpen={false}>{children}</MobileLayoutContent>}>
      <MobileLayoutChromeInner>{children}</MobileLayoutChromeInner>
    </Suspense>
  );
}
