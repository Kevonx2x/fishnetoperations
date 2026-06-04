"use client";

import { useEffect, useRef } from "react";

import type { AuthStatus } from "@/contexts/auth-context";
import type { Profile } from "@/contexts/auth-context";
import {
  BROWSE_GPS_MANILA_COORDS,
  BROWSE_GPS_MANILA_LABEL,
  fetchReverseGeocodeLabel,
  getCurrentPositionWithTimeout,
  hasAttemptedBrowseGps,
  isBrowseClientGpsAudience,
  markBrowseGpsAttempted,
} from "@/lib/browse-client-gps";
import type { GeoPoint } from "@/lib/geo-point";

export type BrowseLocationApplyPayload = {
  label: string;
  latitude?: number;
  longitude?: number;
};

type Options = {
  /** Mobile browse surfaces only. */
  enabled: boolean;
  /** Skip when URL/deep-link already defines location (e.g. ?q=, initial filters). */
  skip: boolean;
  status: AuthStatus;
  profile: Profile | null | undefined;
  onApply: (payload: BrowseLocationApplyPayload) => void;
};

/**
 * Client browse GPS: Manila immediately, then optional geolocation + reverse geocode.
 * One attempt per session; does not block the page on GPS.
 */
export function useBrowseClientGpsLocation({
  enabled,
  skip,
  status,
  profile,
  onApply,
}: Options) {
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    if (!enabled || skip) return;
    if (!isBrowseClientGpsAudience(status, profile)) return;
    if (hasAttemptedBrowseGps()) return;

    markBrowseGpsAttempted();
    onApplyRef.current({
      label: BROWSE_GPS_MANILA_LABEL,
      latitude: BROWSE_GPS_MANILA_COORDS.latitude,
      longitude: BROWSE_GPS_MANILA_COORDS.longitude,
    });

    let cancelled = false;

    void (async () => {
      const position = await getCurrentPositionWithTimeout();
      if (cancelled || !position) return;

      const { latitude, longitude } = position.coords;
      const label = await fetchReverseGeocodeLabel(latitude, longitude);
      if (cancelled || !label) return;

      onApplyRef.current({ label, latitude, longitude });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, skip, status, profile]);
}
