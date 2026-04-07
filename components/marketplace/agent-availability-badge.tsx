"use client";

/** Dashboard sets this when the agent turns availability ON. */
export const AGENT_AVAILABILITY_NOW = "Available Now";
export const AGENT_AVAILABILITY_OFFLINE = "Offline";

export function isAgentAvailableNow(availability: string | null | undefined): boolean {
  return availability?.trim() === AGENT_AVAILABILITY_NOW;
}

/** Relative time from agents.updated_at (or any ISO timestamp). Returns phrases like "5 minutes ago", "3 hours ago", "2 days ago". */
export function formatLastSeenHours(iso: string | null | undefined): string {
  if (!iso?.trim()) return "unknown";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const ms = Date.now() - t;
  if (ms < 0) return "just now";
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) {
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "just now";
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(ms / 86400000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

type Props = {
  /** Only the exact string "Available Now" counts as online; null, empty, or anything else is Offline. */
  availability: string | null | undefined;
  /** Agent row `updated_at` — used for offline “last seen”. */
  updatedAt?: string | null;
};

/**
 * Two states only: Available Now (green) or Offline (grey) + last seen.
 * “Available Now” only when the value is exactly that string (trimmed).
 */
export function AgentAvailabilityBadge({ availability, updatedAt }: Props) {
  const online = isAgentAvailableNow(availability);
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6B9E6E]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E]" aria-hidden />
        Available Now
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-0.5 text-[11px] font-semibold text-[#2C2C2C]/50">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#2C2C2C]/35" aria-hidden />
        Offline
      </span>
      <span className="pl-3.5 text-[10px] font-medium text-[#2C2C2C]/45">
        Last seen {formatLastSeenHours(updatedAt)}
      </span>
    </span>
  );
}
