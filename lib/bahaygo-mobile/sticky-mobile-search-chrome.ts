/** Mobile top bar height: `py-4` + logo row on BahayGo / Dormspace portal nav. */
export const MOBILE_PORTAL_TOP_NAV_OFFSET = "top-[61px]" as const;

/** Fixed search strip below portal nav — avoids broken `sticky` inside overflow ancestors. */
export const MOBILE_FIXED_SEARCH_CHROME =
  "fixed left-0 right-0 z-30 border-b border-black/[0.06] bg-[#FAF8F4]/95 shadow-[0_4px_12px_rgba(44,44,44,0.06)] backdrop-blur-sm supports-[backdrop-filter]:bg-[#FAF8F4]/90";
