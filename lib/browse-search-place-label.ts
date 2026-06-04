/** Short place name for "~1.2 km from Makati" under school cards. */
export function browseSearchPlaceLabel(
  locationQuery: string,
  filtersCity: string,
): string | null {
  const q = locationQuery.trim();
  if (q) {
    const parts = q.split(",").map((p) => p.trim()).filter(Boolean);
    return parts[0] ?? q;
  }
  const city = filtersCity.trim();
  return city || null;
}
