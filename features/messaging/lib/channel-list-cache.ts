export type CachedChannelPreview = {
  id: string;
  title: string;
  preview: string;
  time: string;
  unread: number;
  avatarUrl?: string;
  support?: boolean;
};

const CACHE_PREFIX = "bhg:stream:channel-list:";

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
}

export function readChannelListCache(userId: string): CachedChannelPreview[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedChannelPreview[];
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function writeChannelListCache(userId: string, rows: CachedChannelPreview[]): void {
  if (typeof window === "undefined" || !userId || rows.length === 0) return;
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(rows.slice(0, 30)));
  } catch {
    // ignore quota / private mode
  }
}
