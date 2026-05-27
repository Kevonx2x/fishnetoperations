import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { UniversityRow } from "@/lib/universities";

export type WalkTimeResult = {
  universityId: string;
  walkSeconds: number;
  walkMeters: number;
};

type DistanceMatrixResponse = {
  status?: string;
  error_message?: string;
  rows?: {
    elements?: {
      status?: string;
      duration?: { value?: number };
      distance?: { value?: number };
    }[];
  }[];
};

function googleMapsServerKey(): string | null {
  const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (serverKey) return serverKey;
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API?.trim();
  return publicKey || null;
}

async function fetchActiveUniversities(): Promise<UniversityRow[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("universities")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[google-distance-matrix] universities fetch failed", error);
    return [];
  }

  return (data ?? []) as UniversityRow[];
}

/**
 * Calculate walking times from one origin to all active universities in a single
 * Distance Matrix API request (1 origin × N destinations = one billing event).
 */
export async function calculateWalkTimes(
  originLat: number,
  originLng: number,
): Promise<WalkTimeResult[]> {
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
    return [];
  }

  const apiKey = googleMapsServerKey();
  if (!apiKey) {
    console.error("[google-distance-matrix] missing GOOGLE_MAPS_SERVER_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API");
    return [];
  }

  const universities = await fetchActiveUniversities();
  if (universities.length === 0) return [];

  const destinations = universities
    .map((u) => `${u.latitude},${u.longitude}`)
    .join("|");

  const params = new URLSearchParams({
    origins: `${originLat},${originLng}`,
    destinations,
    mode: "walking",
    key: apiKey,
  });

  let payload: DistanceMatrixResponse;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
      { cache: "no-store" },
    );
    payload = (await res.json()) as DistanceMatrixResponse;
  } catch (error) {
    console.error("[google-distance-matrix] request failed", error);
    return [];
  }

  if (payload.status !== "OK") {
    console.error("[google-distance-matrix] API error", payload.status, payload.error_message);
    return [];
  }

  const elements = payload.rows?.[0]?.elements ?? [];
  const results: WalkTimeResult[] = [];

  universities.forEach((university, index) => {
    const element = elements[index];
    if (!element || element.status !== "OK") return;

    const walkSeconds = element.duration?.value;
    const walkMeters = element.distance?.value;
    if (
      walkSeconds == null ||
      walkMeters == null ||
      !Number.isFinite(walkSeconds) ||
      !Number.isFinite(walkMeters)
    ) {
      return;
    }

    results.push({
      universityId: university.id,
      walkSeconds: Math.round(walkSeconds),
      walkMeters: Math.round(walkMeters),
    });
  });

  return results;
}
