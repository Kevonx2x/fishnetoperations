"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { useSoftKeyboardOpen } from "@/hooks/use-soft-keyboard-open";
import { useMobileChromeOverlay } from "@/contexts/mobile-chrome-context";
import { isMessagesThreadOpen } from "@/lib/messages-mobile-chrome";
import {
  MOBILE_BOTTOM_CHROME_HEIGHT_VAR,
  MOBILE_BOTTOM_NAV_HEIGHT_VAR,
} from "@/lib/mobile-bottom-nav-layout";

const HIDDEN_PATH_PREFIXES = ["/auth", "/admin", "/messenger"] as const;
const HIDDEN_PATHS = ["/dormspaces/submit", "/dormspaces/welcome"] as const;

function isMobileBottomChromeHidden(
  pathname: string,
  hasActiveChannel: boolean,
  keyboardOpenOnMessagesThread: boolean,
): boolean {
  if (HIDDEN_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/messages/")) return true;
  if (pathname === "/messages" && hasActiveChannel) return true;
  if (keyboardOpenOnMessagesThread) return true;
  if (pathname === "/properties/submit" || pathname.startsWith("/properties/submit/")) return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  return false;
}

type Props = {
  stickyFooter: ReactNode | null;
};

/** Fixed footer: optional sticky slot + bottom nav in one column (flush, no offset gap). */
export function MobileBottomChrome({ stickyFooter }: Props) {
  const chromeRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const { overlayOpen } = useMobileChromeOverlay();
  const channelParam = searchParams.get("channel");
  const messagesThreadOpen = isMessagesThreadOpen(pathname, channelParam);
  const keyboardOpen = useSoftKeyboardOpen();
  const keyboardOnMessagesThread = keyboardOpen && messagesThreadOpen;
  const hidden =
    overlayOpen ||
    isMobileBottomChromeHidden(pathname, messagesThreadOpen, keyboardOnMessagesThread);

  useEffect(() => {
    if (hidden) {
      document.documentElement.style.removeProperty(MOBILE_BOTTOM_CHROME_HEIGHT_VAR);
      document.documentElement.style.removeProperty(MOBILE_BOTTOM_NAV_HEIGHT_VAR);
      return;
    }
    const el = chromeRef.current;
    if (!el) return;

    const syncHeight = () => {
      document.documentElement.style.setProperty(
        MOBILE_BOTTOM_CHROME_HEIGHT_VAR,
        `${el.offsetHeight}px`,
      );
      const nav = el.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
      if (nav) {
        document.documentElement.style.setProperty(
          MOBILE_BOTTOM_NAV_HEIGHT_VAR,
          `${nav.offsetHeight}px`,
        );
      }
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(MOBILE_BOTTOM_CHROME_HEIGHT_VAR);
      document.documentElement.style.removeProperty(MOBILE_BOTTOM_NAV_HEIGHT_VAR);
    };
  }, [hidden, stickyFooter]);

  if (hidden) {
    return null;
  }

  return (
    <div
      ref={chromeRef}
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col md:hidden"
      aria-label="Mobile footer"
    >
      {stickyFooter}
      <MobileBottomNav embedded />
    </div>
  );
}
