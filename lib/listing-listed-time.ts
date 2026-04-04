/** Human-readable relative time for property listing badges. */

export function listingListedLabel(createdAtIso: string): string {
  const ms = Date.now() - new Date(createdAtIso).getTime();
  if (!Number.isFinite(ms)) return "Listed";
  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  if (totalHours < 1) return "Listed just now";
  if (totalHours < 24) return `Listed ${totalHours} hours ago`;
  const totalDays = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (totalDays <= 6) return `Listed ${totalDays} days ago`;
  if (totalDays < 30) {
    const weeks = Math.floor(totalDays / 7);
    return `Listed ${weeks} weeks ago`;
  }
  const months = Math.floor(totalDays / 30);
  return `Listed ${months} months ago`;
}
