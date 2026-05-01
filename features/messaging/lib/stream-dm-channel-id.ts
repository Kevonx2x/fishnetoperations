/** Deterministic Stream `messaging` channel id for agent–client DM (matches `postStreamChannel`). */
export function streamDmChannelId(agentUserId: string, clientUserId: string): string {
  const sorted = [agentUserId, clientUserId].sort((a, b) => a.localeCompare(b));
  return `${sorted[0].slice(0, 8)}-${sorted[1].slice(0, 8)}`;
}
