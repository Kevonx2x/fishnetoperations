"use client";

import { motion } from "framer-motion";
import { Building2, Home, Map, Search, Sparkles, User } from "lucide-react";

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
              className="relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-semibold text-[#2C2C2C]/55 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/30"
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
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6B9E6E]/15 text-[#6B9E6E] shadow-[0_10px_22px_rgba(0,0,0,0.12)] ring-2 ring-[#D4A843]/30"
                  >
                    <Sparkles className="h-5 w-5" aria-hidden />
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
