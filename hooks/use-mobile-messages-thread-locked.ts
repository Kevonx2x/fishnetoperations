"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { useMessengerMobileThreadPane } from "@/contexts/mobile-chrome-context";
import { isMessagesThreadOpen } from "@/lib/messages-mobile-chrome";

/** True when a mobile messenger thread should lock the page frame (URL or pane state). */
export function useMobileMessagesThreadLocked(): boolean {
  const { messengerMobileThreadPaneOpen } = useMessengerMobileThreadPane();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const threadParam = searchParams.get("c") ?? searchParams.get("channel");
  const urlThreadOpen = isMessagesThreadOpen(pathname, threadParam);
  return urlThreadOpen || messengerMobileThreadPaneOpen;
}
