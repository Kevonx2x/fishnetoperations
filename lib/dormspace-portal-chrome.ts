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

export type DormspacePortalNavVisibility = "full" | "minimal" | "none";

export function isDormspaceDashboardSubpage(pathname: string): boolean {
  return pathname.startsWith("/dormspaces/dashboard/");
}

export function dormspacePortalNavVisibility(pathname: string): DormspacePortalNavVisibility {
  if (isDormspaceDashboardSubpage(pathname)) return "none";
  if (pathname === "/dormspaces/dashboard" || pathname.startsWith("/dormspaces/dashboard?")) {
    return "full";
  }
  if (pathname === "/dormspaces/welcome" || pathname.startsWith("/dormspaces/welcome/")) {
    return "minimal";
  }
  if (pathname === "/dormspaces" || pathname.startsWith("/dormspaces?")) return "full";
  if (pathname.startsWith("/dormspaces/submit")) return "full";
  if (isPublicDormspaceMarketplacePath(pathname)) return "none";
  if (pathname.startsWith("/dormspaces")) return "full";
  return "full";
}
