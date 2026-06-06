"use client";

import { useLayoutEffect } from "react";

const LOCK_CLASS = "bahaygo-mobile-thread-scroll-lock";

/** Prevent page-level scroll on mobile (e.g. messenger thread fullscreen). */
export function useLockMobileDocumentScroll(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;

    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };

    html.classList.add(LOCK_CLASS);
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.classList.remove(LOCK_CLASS);
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
