/** Public dormspaces marketplace (unified bottom nav, no portal footer). */
export function isPublicDormspaceMarketplacePath(pathname: string): boolean {
  if (!pathname.startsWith("/dormspaces")) return false;
  if (pathname.startsWith("/dormspaces/dashboard")) return false;
  if (pathname === "/dormspaces/submit" || pathname.startsWith("/dormspaces/submit/")) return false;
  return true;
}

export function isDormspaceDashboardPath(pathname: string): boolean {
  return pathname.startsWith("/dormspaces/dashboard");
}

export type DormspacePortalNavVisibility = "full" | "minimal" | "desktop-only";

export function isDormspaceDashboardSubpage(pathname: string): boolean {
  return pathname.startsWith("/dormspaces/dashboard/");
}

export function isDormspaceMarketplaceHomePath(pathname: string): boolean {
  return pathname === "/dormspaces";
}

/** Welcome keeps a slim header; all other dormspacer routes show portal nav on desktop. */
export function dormspacePortalNavVisibility(pathname: string): DormspacePortalNavVisibility {
  if (pathname === "/dormspaces/welcome" || pathname.startsWith("/dormspaces/welcome/")) {
    return "minimal";
  }
  if (pathname === "/dormspaces" || pathname.startsWith("/dormspaces?")) return "full";
  if (pathname.startsWith("/dormspaces/submit")) return "full";
  if (pathname.startsWith("/dormspaces")) return "desktop-only";
  return "full";
}
