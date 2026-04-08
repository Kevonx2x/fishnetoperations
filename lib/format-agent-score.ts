/**
 * Display agent scores as stored: 0–100 style (>10) as whole numbers; 0–10 scale with one decimal.
 */
export function formatAgentScore(score: number | null | undefined): string {
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  if (n > 10) return String(Math.round(n));
  return n.toFixed(1);
}
