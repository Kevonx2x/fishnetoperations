/** Deterministic Stream channel id (type `messaging`) per end user. */
export function supportChannelIdForUser(userId: string): string {
  return `support_${userId.trim()}`;
}

export function supportAvatarUrlFromEnv(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://bahaygo.com";
  return `${base}/apple-touch-icon.png`;
}
