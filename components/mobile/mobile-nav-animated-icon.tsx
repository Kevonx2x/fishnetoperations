"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { BahayGoNavHomeIcon } from "@/components/mobile/bahaygo-nav-home-icon";
import { cn } from "@/lib/utils";

export type MobileNavIconId =
  | "home"
  | "search"
  | "saved"
  | "inbox"
  | "more"
  | "pipeline"
  | "activity"
  | "notifications"
  | "profile"
  | "settings"
  | "map"
  | "agencies"
  | "add";

const ACTIVE = "#6B9E6E";
const INACTIVE = "#717171";

/** One-shot spring when a tab becomes active. */
const ACTIVATE: Partial<Record<MobileNavIconId, TargetAndTransition>> = {
  home: { rotate: [0, -12, 12, 0], scale: [0.88, 1.12, 1] },
  search: { rotate: [0, 18, -12, 0], scale: [0.9, 1.08, 1] },
  map: { rotate: [0, 22, -14, 0], scale: [0.9, 1.08, 1] },
  saved: { scale: [0.72, 1.2, 1], rotate: [0, -8, 0] },
  inbox: { rotate: [0, -8, 8, 0], y: [0, -3, 0] },
  more: { rotate: [0, 90, 180], scale: [0.85, 1.05, 1] },
  pipeline: { rotate: [0, -18, 10, 0], scale: [0.92, 1.06, 1] },
  activity: { scale: [0.88, 1.12, 0.96, 1.08, 1], y: [0, -2, 0, -1, 0] },
  notifications: { rotate: [0, 14, -14, 0], scale: [0.9, 1.08, 1] },
  profile: { scale: [0.86, 1.1, 1] },
  settings: { rotate: [0, 48, 0], scale: [0.9, 1.05, 1] },
  agencies: { y: [0, -4, 0], scale: [0.9, 1.06, 1] },
  add: { rotate: [0, 90, 0], scale: [0.8, 1.15, 1] },
};

/** Subtle loop while tab stays active (Airbnb-style delight). */
const ACTIVE_LOOP: Partial<Record<MobileNavIconId, TargetAndTransition>> = {
  home: { rotate: [0, 8, -8, 0] },
  search: { rotate: [0, 360] },
  map: { rotate: [0, 360] },
  saved: { scale: [1, 1.1, 1] },
  inbox: { rotate: [0, -4, 4, 0] },
  more: { rotate: [180, 270, 180] },
  pipeline: { rotate: [0, 10, -10, 0] },
  activity: { scale: [1, 1.08, 1, 1.05, 1] },
  notifications: { rotate: [0, 12, -12, 0] },
};

const FILLED_WHEN_ACTIVE = new Set<MobileNavIconId>([
  "search",
  "map",
  "saved",
  "inbox",
  "pipeline",
  "activity",
  "notifications",
  "profile",
  "settings",
  "agencies",
]);

const FULL_FILL = new Set<MobileNavIconId>(["saved"]);

type Props = {
  id: MobileNavIconId;
  Icon: LucideIcon;
  active: boolean;
  className?: string;
  size?: number;
  /** Override colors (e.g. white icon on sage FAB). */
  activeColor?: string;
  inactiveColor?: string;
};

function NavIconGlyph({
  id,
  Icon,
  active,
  size = 24,
  activeColor,
  inactiveColor,
}: Props) {
  const color = active ? (activeColor ?? ACTIVE) : (inactiveColor ?? INACTIVE);
  const useFill = active && FILLED_WHEN_ACTIVE.has(id);

  if (id === "home") {
    return <BahayGoNavHomeIcon size={size} active={active} color={color} />;
  }

  return (
    <Icon
      size={size}
      strokeWidth={active ? 2.25 : 1.75}
      color={color}
      fill={useFill ? color : "none"}
      fillOpacity={useFill ? (FULL_FILL.has(id) ? 1 : 0.22) : 0}
      className="shrink-0"
      aria-hidden
    />
  );
}

/** Static icon — SSR + hydration + prefers-reduced-motion (no transform/opacity animation). */
function StaticNavIcon({ className, ...props }: Props) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      <NavIconGlyph {...props} />
    </span>
  );
}

export function MobileNavAnimatedIcon(props: Props) {
  const { id, active, className } = props;
  const [isMounted, setIsMounted] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || reduceMotion) {
    return <StaticNavIcon {...props} />;
  }

  const loop = active ? ACTIVE_LOOP[id] : undefined;
  const activate = active ? ACTIVATE[id] : undefined;

  return (
    <motion.span
      key={`${id}-${active ? "on" : "off"}`}
      className={cn("inline-flex items-center justify-center", className)}
      initial={false}
      animate={loop ?? activate ?? { rotate: 0, scale: 1, y: 0 }}
      transition={
        loop
          ? { duration: id === "search" || id === "map" ? 6 : 2.8, repeat: Infinity, ease: "easeInOut" }
          : { type: "spring", stiffness: 420, damping: 24, mass: 0.65 }
      }
    >
      <NavIconGlyph {...props} />
    </motion.span>
  );
}
