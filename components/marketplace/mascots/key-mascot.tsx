"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function KeyFavoriteBurst({
  show,
  onDone,
}: {
  show: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => onDone(), 950);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[120] grid place-items-center bg-[#2C2C2C]/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={() => {
            // safety: onDone is also called via timeout, but this keeps it snappy
          }}
        >
          <motion.div
            initial={{ scale: 0.35, rotate: -30, opacity: 0 }}
            animate={{ scale: 1.35, rotate: 540, opacity: 1 }}
            exit={{ scale: 1.55, rotate: 720, opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeInOut" }}
            className="drop-shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
          >
            <KeySvg className="h-40 w-40" />
          </motion.div>

          {/* radial burst */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,168,76,0.55),rgba(201,168,76,0.0)_60%)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KeySvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" className={className} role="img" aria-label="Golden key">
      <defs>
        <linearGradient id="keyGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F6E08A" />
          <stop offset="45%" stopColor="#D4A843" />
          <stop offset="100%" stopColor="#9C7A22" />
        </linearGradient>
      </defs>
      <path
        d="M86 24c-12.7 0-23 10.3-23 23 0 3.1.6 6 1.7 8.8L26 94.5V110h16l6-6h10l6-6h10l10.7-10.7c2.7 1.1 5.7 1.7 8.6 1.7 12.7 0 23-10.3 23-23S98.7 24 86 24zm0 14a9 9 0 1 1 0 18 9 9 0 0 1 0-18z"
        fill="url(#keyGold)"
        stroke="rgba(44,44,44,0.22)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="86" cy="47" r="4" fill="#2C2C2C" opacity="0.35" />
    </svg>
  );
}

