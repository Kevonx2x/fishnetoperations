import { isAdminPanelRole, isLandlordCapable } from "@/lib/auth-roles";

type BrowseGpsAuthStatus = "loading" | "authenticated" | "unauthenticated";

type BrowseGpsProfile = {
  role?: string | null;
  is_landlord?: boolean | null;
};

/** Session flag — one geolocation attempt per browser tab session. */
export const BROWSE_GPS_SESSION_KEY = "fishnet:browse-client-gps-v1";

/** Default browse location when GPS is pending, denied, or unavailable. */
export const BROWSE_GPS_MANILA_LABEL = "Manila";

export const BROWSE_GPS_TIMEOUT_MS = 8_000;

const STAFF_ROLES = new Set(["broker", "agent", "team_member", "landlord"]);

export function hasAttemptedBrowseGps(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(BROWSE_GPS_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function markBrowseGpsAttempted(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BROWSE_GPS_SESSION_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** Guests and signed-in clients only (not agent, landlord, admin, broker, team). */
export function isBrowseClientGpsAudience(
  status: BrowseGpsAuthStatus,
  profile: BrowseGpsProfile | null | undefined,
): boolean {
  if (status === "loading") return false;
  if (!profile) return true;
  const role = profile.role ?? "";
  if (isAdminPanelRole(role)) return false;
  if (STAFF_ROLES.has(role)) return false;
  if (isLandlordCapable(profile)) return false;
  return role === "client";
}

export function getCurrentPositionWithTimeout(
  timeoutMs: number = BROWSE_GPS_TIMEOUT_MS,
): Promise<GeolocationPosition | null> {
  if (typeof window === "undefined" || !navigator.geolocation?.getCurrentPosition) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: GeolocationPosition | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => finish(position),
      () => finish(null),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: timeoutMs },
    );
  });
}

export async function fetchReverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
    });
    const res = await fetch(`/api/geocode/reverse?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; label?: string };
    const label = typeof data.label === "string" ? data.label.trim() : "";
    return label || null;
  } catch {
    return null;
  }
}
