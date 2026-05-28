"use client";

import { useEffect, useState } from "react";

type MobileVisualViewport = {
  /** Visual viewport height in px (mobile only); null until measured or on desktop. */
  height: number | null;
  keyboardOpen: boolean;
};

/** Tracks visual viewport height so thread UI shrinks when the soft keyboard opens. */
export function useMobileVisualViewport(enabled: boolean): MobileVisualViewport {
  const [height, setHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setHeight(null);
      setKeyboardOpen(false);
      return;
    }

    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) {
      setHeight(null);
      setKeyboardOpen(false);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setHeight(vv.height);
      setKeyboardOpen(window.innerHeight - vv.height > 120);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [enabled]);

  return { height, keyboardOpen };
}
