"use client";

import { useEffect, useRef } from "react";

import type { AuthStatus } from "@/contexts/auth-context";
import type { Profile } from "@/contexts/auth-context";
import {
  BROWSE_GPS_MANILA_LABEL,
  fetchReverseGeocodeLabel,
  getCurrentPositionWithTimeout,
  hasAttemptedBrowseGps,
  isBrowseClientGpsAudience,
  markBrowseGpsAttempted,
} from "@/lib/browse-client-gps";

type Options = {
  /** Mobile browse surfaces only. */
  enabled: boolean;
  /** Skip when URL/deep-link already defines location (e.g. ?q=, initial filters). */
  skip: boolean;
  status: AuthStatus;
  profile: Profile | null | undefined;
  onApply: (label: string) => void;
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
    onApplyRef.current(BROWSE_GPS_MANILA_LABEL);

    let cancelled = false;

    void (async () => {
      const position = await getCurrentPositionWithTimeout();
      if (cancelled || !position) return;

      const label = await fetchReverseGeocodeLabel(
        position.coords.latitude,
        position.coords.longitude,
      );
      if (cancelled || !label) return;

      onApplyRef.current(label);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, skip, status, profile]);
}
