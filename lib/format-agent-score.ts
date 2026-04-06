/** Star-scale (≤10) shows one decimal; legacy 0–100 scores round to integer. */
export function formatAgentScore(score: number): string {
  if (score <= 10) return score.toFixed(1);
  return String(Math.round(score));
}
