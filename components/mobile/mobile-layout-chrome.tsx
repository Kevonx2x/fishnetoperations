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
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden",
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
