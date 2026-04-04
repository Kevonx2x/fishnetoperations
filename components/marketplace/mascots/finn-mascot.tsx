"use client";

import { motion } from "framer-motion";

export type FinnMood = "happy" | "sad" | "still" | "celebrate";

const EASE: [number, number, number, number] = [0.42, 0, 0.58, 1];

export function FinnMascot({
  mood,
  size,
  className,
}: {
  mood: FinnMood;
  size: number;
  className?: string;
}) {
  const animate =
    mood === "happy"
      ? { y: [0, -8, 0] }
      : mood === "sad"
        ? { y: [0, 2, 0], rotate: [0, -2, 2, 0] }
        : mood === "celebrate"
          ? { y: [0, -14, 0], rotate: [0, 360] }
          : { y: [0, -3, 0] };

  const transition =
    mood === "happy"
      ? { duration: 1.25, repeat: Infinity, ease: EASE }
      : mood === "sad"
        ? { duration: 2.2, repeat: Infinity, ease: EASE }
        : mood === "celebrate"
          ? { duration: 0.9, repeat: 1, ease: EASE }
          : { duration: 2.6, repeat: Infinity, ease: EASE };

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={animate}
      transition={transition}
    >
      <svg viewBox="0 0 128 128" role="img" aria-label="Finn mascot">
        <defs>
          <linearGradient id="finnRoof2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4A843" />
            <stop offset="100%" stopColor="#B99333" />
          </linearGradient>
        </defs>

        <path
          d="M18 56 L64 22 L110 56 V108 C110 112.4 106.4 116 102 116 H26 C21.6 116 18 112.4 18 108 Z"
          fill="#FFFFFF"
          stroke="rgba(44,44,44,0.18)"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <path
          d="M12 58 L64 18 L116 58"
          fill="none"
          stroke="url(#finnRoof2)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M54 116 V82 C54 77.6 57.6 74 62 74 H66 C70.4 74 74 77.6 74 82 V116"
          fill="#FAF8F4"
          stroke="rgba(44,44,44,0.14)"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <circle cx="48" cy="70" r="6" fill="#2C2C2C" opacity="0.9" />
        <circle cx="80" cy="70" r="6" fill="#2C2C2C" opacity="0.9" />
        <circle cx="46" cy="68" r="2" fill="#FFFFFF" opacity="0.9" />
        <circle cx="78" cy="68" r="2" fill="#FFFFFF" opacity="0.9" />

        {mood === "sad" ? (
          <path
            d="M52 92 C58 84, 70 84, 76 92"
            fill="none"
            stroke="#2C2C2C"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.65"
          />
        ) : (
          <path
            d="M52 86 C58 94, 70 94, 76 86"
            fill="none"
            stroke="#2C2C2C"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.75"
          />
        )}

        <circle cx="38" cy="86" r="6" fill="#6B9E6E" opacity="0.18" />
        <circle cx="90" cy="86" r="6" fill="#6B9E6E" opacity="0.18" />
      </svg>
    </motion.div>
  );
}

