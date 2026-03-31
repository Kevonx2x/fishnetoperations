"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STORAGE_KEY = "fishnet_welcome_seen_v2";

function FinnMascotSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label="Finn mascot"
    >
      <defs>
        <linearGradient id="finnRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C9A84C" />
          <stop offset="100%" stopColor="#B99333" />
        </linearGradient>
      </defs>

      {/* House */}
      <path
        d="M18 56 L64 22 L110 56 V108 C110 112.4 106.4 116 102 116 H26 C21.6 116 18 112.4 18 108 Z"
        fill="#FFFFFF"
        stroke="rgba(44,44,44,0.18)"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Roof */}
      <path
        d="M12 58 L64 18 L116 58"
        fill="none"
        stroke="url(#finnRoof)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Door */}
      <path
        d="M54 116 V82 C54 77.6 57.6 74 62 74 H66 C70.4 74 74 77.6 74 82 V116"
        fill="#FAF8F4"
        stroke="rgba(44,44,44,0.14)"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Eyes */}
      <circle cx="48" cy="70" r="6" fill="#2C2C2C" opacity="0.9" />
      <circle cx="80" cy="70" r="6" fill="#2C2C2C" opacity="0.9" />
      <circle cx="46" cy="68" r="2" fill="#FFFFFF" opacity="0.9" />
      <circle cx="78" cy="68" r="2" fill="#FFFFFF" opacity="0.9" />

      {/* Smile */}
      <path
        d="M52 86 C58 94, 70 94, 76 86"
        fill="none"
        stroke="#2C2C2C"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* Cheeks */}
      <circle cx="38" cy="86" r="6" fill="#7C9A7E" opacity="0.18" />
      <circle cx="90" cy="86" r="6" fill="#7C9A7E" opacity="0.18" />
    </svg>
  );
}

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
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-3xl bg-[#FAF8F4] p-4 shadow-inner shadow-black/5"
              >
                <FinnMascotSvg className="h-20 w-20" />
              </motion.div>
            </div>

            <h2 className="mt-5 text-center font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
              Welcome to Fishnet — Find Your Home with Confidence
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
                className="w-full rounded-full bg-[#7C9A7E] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#7C9A7E]/25 transition-colors hover:bg-[#6C8C70] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
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

