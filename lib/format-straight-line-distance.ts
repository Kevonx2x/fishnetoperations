type FormatStraightLineDistanceOptions = {
  /** Prefix with ~ (default false for clean UI copy). */
  approximate?: boolean;
};

/** Human-readable straight-line distance (not routing). */
export function formatApproxStraightLineDistance(
  meters: number,
  options?: FormatStraightLineDistanceOptions,
): string {
  if (!Number.isFinite(meters) || meters < 0) return "";

  const prefix = options?.approximate ? "~" : "";

  if (meters < 1000) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return `${prefix}${rounded} m`;
  }

  const km = meters / 1000;
  const rounded = Math.round(km * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${prefix}${text} km`;
}
