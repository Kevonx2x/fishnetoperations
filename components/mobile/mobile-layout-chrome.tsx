"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MobileBottomChrome } from "@/components/mobile/mobile-bottom-chrome";
import {
  MobileChromeProvider,
  useMobileStickyFooterContent,
} from "@/contexts/mobile-chrome-context";
import { isMessagesThreadOpen } from "@/lib/messages-mobile-chrome";
import { cn } from "@/lib/utils";

function MobileLayoutContent({
  children,
  messagesThreadOpen,
  stickyFooter,
}: {
  children: ReactNode;
  messagesThreadOpen: boolean;
  stickyFooter: ReactNode | null;
}) {
  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-col",
          /* Mobile: let the document scroll (flex-1 + min-h-0 traps content inside 100vh). */
          "max-md:h-auto max-md:min-h-0 max-md:flex-none",
          "md:min-h-0 md:flex-1",
          messagesThreadOpen
            ? "max-md:pb-0"
            : "max-md:pb-[var(--bahaygo-mobile-bottom-chrome-height,calc(4rem+env(safe-area-inset-bottom)))] md:pb-0",
        )}
      >
        {children}
      </div>
      <Suspense fallback={null}>
        <MobileBottomChrome stickyFooter={stickyFooter} />
      </Suspense>
    </>
  );
}

function MobileLayoutChromeInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const sp = useSearchParams();
  const threadParam = sp.get("c") ?? sp.get("channel");
  const messagesThreadOpen = isMessagesThreadOpen(pathname, threadParam);
  const stickyFooter = useMobileStickyFooterContent();

  return (
    <MobileLayoutContent messagesThreadOpen={messagesThreadOpen} stickyFooter={stickyFooter}>
      {children}
    </MobileLayoutContent>
  );
}

/** Wraps page content with mobile bottom-nav clearance and mounts global mobile nav. */
export function MobileLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <MobileChromeProvider>
      <Suspense
        fallback={
          <MobileLayoutContent messagesThreadOpen={false} stickyFooter={null}>
            {children}
          </MobileLayoutContent>
        }
      >
        <MobileLayoutChromeInner>{children}</MobileLayoutChromeInner>
      </Suspense>
    </MobileChromeProvider>
  );
}
