/** Server-side homepage listings + LCP strip — off in dev by default for fast local compiles. */
export function isHomepageSsrListingsEnabled(): boolean {
  if (process.env.HOMEPAGE_SSR_LISTINGS === "false") return false;
  if (process.env.HOMEPAGE_SSR_LISTINGS === "true") return true;
  return process.env.NODE_ENV === "production";
}
