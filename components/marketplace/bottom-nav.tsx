"use client";

import { motion } from "framer-motion";
import { Building2, Home, Map, Search, User } from "lucide-react";

export type BottomTab = "home" | "search" | "map" | "brokers" | "profile";

export function BottomNav({
  active,
  onTab,
}: {
  active: BottomTab;
  onTab: (t: BottomTab) => void;
}) {
  const items: Array<{ id: BottomTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: "home", label: "Home", Icon: Home },
    { id: "search", label: "Search", Icon: Search },
    { id: "map", label: "Map", Icon: Map },
    { id: "brokers", label: "Brokers", Icon: Building2 },
    { id: "profile", label: "Profile", Icon: User },
  ];

  const activeIdx = items.findIndex((x) => x.id === active);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#2C2C2C]/8 bg-white/92 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-5 px-2 py-2">
        {items.map((item, idx) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTab(item.id)}
              className="relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold text-[#2C2C2C]/55 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/30"
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-pill"
                  className="absolute inset-1 rounded-xl bg-[#6B9E6E]/12"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}

              <span className="relative">
                <item.Icon className={`h-5 w-5 ${isActive ? "text-[#6B9E6E]" : "text-[#2C2C2C]/55"}`} />
              </span>
              <span className={`relative ${isActive ? "text-[#6B9E6E]" : ""}`}>{item.label}</span>

              {isActive && (
                <motion.div
                  className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2"
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                  style={{
                    transform: "translateX(-50%)",
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    className="drop-shadow-[0_10px_22px_rgba(0,0,0,0.12)]"
                  >
                    <FinnPeekSvg className="h-10 w-10" />
                  </motion.div>
                </motion.div>
              )}

              {/* keep layout stable */}
              {isActive && idx === activeIdx && <span className="sr-only">Selected</span>}
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

function FinnPeekSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Finn peeking">
      <defs>
        <linearGradient id="peekRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A843" />
          <stop offset="100%" stopColor="#B99333" />
        </linearGradient>
      </defs>

      {/* mask bottom so it looks like it peeks */}
      <path
        d="M10 30 L32 16 L54 30 V54 C54 56.2 52.2 58 50 58 H14 C11.8 58 10 56.2 10 54 Z"
        fill="#FFFFFF"
        stroke="rgba(44,44,44,0.16)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M8 30 L32 14 L56 30"
        fill="none"
        stroke="url(#peekRoof)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="36" r="3.2" fill="#2C2C2C" opacity="0.9" />
      <circle cx="40" cy="36" r="3.2" fill="#2C2C2C" opacity="0.9" />
      <path
        d="M26 45 C28.5 48, 35.5 48, 38 45"
        fill="none"
        stroke="#2C2C2C"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* crop line */}
      <rect x="0" y="52" width="64" height="12" fill="#FFFFFF" opacity="0" />
    </svg>
  );
}

