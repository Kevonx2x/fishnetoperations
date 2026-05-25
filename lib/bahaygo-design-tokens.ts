/**
 * BahayGo mobile-first design tokens (green / gold / cream).
 * Use for feed, cards, search hero, and bottom nav — keeps UI aligned with product mocks.
 */

export const BAHAYGO_COLORS = {
  sage: "#6B9E6E",
  sageDark: "#5d8a60",
  sageLight: "#8faf91",
  gold: "#D4A843",
  goldHover: "#c49a38",
  cream: "#FAF8F4",
  creamMuted: "#EBE6DC",
  charcoal: "#2C2C2C",
  charcoalMuted: "#484848",
  meta: "#888888",
  white: "#FFFFFF",
} as const;

export const BAHAYGO_RADIUS = {
  card: "1rem", // 16px — listing cards, search card
  button: "0.75rem", // 12px — pills, CTAs
  pill: "9999px",
} as const;

export const BAHAYGO_SHADOW = {
  card: "0 4px 20px rgba(44, 44, 44, 0.1)",
  cardSoft: "0 1px 2px rgba(0, 0, 0, 0.06), 0 6px 16px rgba(0, 0, 0, 0.08)",
  nav: "0 -2px 8px rgba(0, 0, 0, 0.04)",
} as const;

/** Calm vertical rhythm for scrollable mobile feed sections (Trulia-style pacing). */
export const BAHAYGO_FEED_SPACING = {
  sectionGapMobile: "2rem", // 32px between modules
  sectionGapDesktop: "2.5rem",
  sectionTitleToCards: "0.75rem", // 12px
  cardBodyGap: "0.375rem",
} as const;

export const BAHAYGO_TYPOGRAPHY = {
  sectionTitle: "font-serif text-lg font-bold tracking-tight text-[#2C2C2C]",
  cardPrice: "text-base font-semibold tracking-tight text-[#D4A843] md:text-lg",
  cardTitle: "text-sm font-semibold leading-snug text-[#2C2C2C]",
  cardSpecs: "text-xs text-[#717171]",
  cardLocation: "text-xs text-[#888888]",
  trustBadge: "text-xs font-normal text-[#888888]",
} as const;
