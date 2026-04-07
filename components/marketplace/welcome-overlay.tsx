"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home } from "lucide-react";

const STORAGE_KEY = "bahaygo_welcome_seen_v2";

export function WelcomeOverlay() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      return seen !== "1";
    } catch {
      return true;
    }
  });

  const dismiss = useMemo(
    () => () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      setOpen(false);
    },
    [],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#FAF8F4]/95 px-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
            initial={{ y: 14, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
          >
            <div className="flex items-center justify-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-3xl bg-[#FAF8F4] p-5 shadow-inner shadow-black/5"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#6B9E6E]/12 ring-2 ring-[#D4A843]/25">
                  <Home className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
                </div>
              </motion.div>
            </div>

            <h2 className="mt-5 text-center font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
              Welcome to BahayGo — Find Your Home with Confidence
            </h2>
            <p className="mt-3 text-center text-sm leading-relaxed text-[#2C2C2C]/60">
              Explore curated listings, meet verified agents, and refine your search with
              friendly tools built for clarity.
            </p>

            <div className="mt-6">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={dismiss}
                className="w-full rounded-full bg-[#6B9E6E] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#6B9E6E]/25 transition-colors hover:bg-[#6C8C70] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
              >
                Get Started
              </motion.button>
              <div className="mt-3 text-center text-[11px] font-medium text-[#2C2C2C]/45">
                Tip: you can revisit filters anytime from the bottom bar.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
