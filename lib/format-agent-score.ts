/**
 * Display agent scores on a 0.0–10.0 scale. Stored values may be 0–100 (legacy) or already 0–10.
 */
export function formatAgentScore(score: number | null | undefined): string {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  const onTenScale = n > 10 ? n / 10 : n;
  return onTenScale.toFixed(1);
}
