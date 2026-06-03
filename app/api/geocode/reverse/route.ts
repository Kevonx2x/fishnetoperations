import { NextResponse } from "next/server";

import { reverseGeocodeLatLng } from "@/lib/google-geocoding";

/** Public reverse geocode for client browse GPS (coordinates → place label). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, reason: "Invalid lat/lng" }, { status: 400 });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ ok: false, reason: "Coordinates out of range" }, { status: 400 });
  }

  const result = await reverseGeocodeLatLng(lat, lng);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    label: result.label,
    city: result.city,
    neighborhood: result.neighborhood,
  });
}
