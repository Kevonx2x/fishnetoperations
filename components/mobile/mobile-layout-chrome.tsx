"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { MobileBottomChrome } from "@/components/mobile/mobile-bottom-chrome";
import {
  MobileChromeProvider,
  useMessengerMobileThreadPane,
  useMobileStickyFooterContent,
} from "@/contexts/mobile-chrome-context";
import { useLockMobileDocumentScroll } from "@/hooks/use-lock-mobile-document-scroll";
import { useMobileMessagesThreadLocked } from "@/hooks/use-mobile-messages-thread-locked";
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
  useLockMobileDocumentScroll(messagesThreadOpen);

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-col",
          messagesThreadOpen
            ? "max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:overflow-hidden max-md:pb-0"
            : "max-md:h-auto max-md:min-h-0 max-md:flex-none max-md:pb-[var(--bahaygo-mobile-bottom-chrome-height,calc(4rem+env(safe-area-inset-bottom)))]",
          "md:min-h-0 md:flex-1 md:pb-0",
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
  const messagesThreadOpen = useMobileMessagesThreadLocked();
  const stickyFooter = useMobileStickyFooterContent();

  return (
    <MobileLayoutContent messagesThreadOpen={messagesThreadOpen} stickyFooter={stickyFooter}>
      {children}
    </MobileLayoutContent>
  );
}

/** Suspense fallback: pane context may be set before searchParams resolve. */
function MobileLayoutChromeSuspenseFallback({ children }: { children: ReactNode }) {
  const { messengerMobileThreadPaneOpen } = useMessengerMobileThreadPane();
  const stickyFooter = useMobileStickyFooterContent();

  return (
    <MobileLayoutContent
      messagesThreadOpen={messengerMobileThreadPaneOpen}
      stickyFooter={stickyFooter}
    >
      {children}
    </MobileLayoutContent>
  );
}

/** Wraps page content with mobile bottom-nav clearance and mounts global mobile nav. */
export function MobileLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <MobileChromeProvider>
      <Suspense fallback={<MobileLayoutChromeSuspenseFallback>{children}</MobileLayoutChromeSuspenseFallback>}>
        <MobileLayoutChromeInner>{children}</MobileLayoutChromeInner>
      </Suspense>
    </MobileChromeProvider>
  );
}
