/** Human-readable approximate straight-line distance (not routing). */
export function formatApproxStraightLineDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";

  if (meters < 1000) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return `~${rounded} m`;
  }

  const km = meters / 1000;
  const rounded = Math.round(km * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `~${text} km`;
}
