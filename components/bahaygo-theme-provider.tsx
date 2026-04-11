"use client";

import { useEffect } from "react";

export const BAHAYGO_THEME_KEY = "bahaygo-theme";

function readTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  let v = window.localStorage.getItem(BAHAYGO_THEME_KEY);
  if (v !== "dark" && v !== "light") {
    const legacy = window.localStorage.getItem("bahaygo-client-theme");
    if (legacy === "dark" || legacy === "light") {
      v = legacy;
      window.localStorage.setItem(BAHAYGO_THEME_KEY, legacy);
    }
  }
  return v === "dark" ? "dark" : "light";
}

export function applyBahayGoTheme(mode: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
}

/**
 * Applies `dark` class on <html> from localStorage `bahaygo-theme` on mount and on events.
 */
export function BahayGoThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sync = () => {
      applyBahayGoTheme(readTheme());
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("bahaygo-theme", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("bahaygo-theme", sync);
    };
  }, []);
  return <>{children}</>;
}
