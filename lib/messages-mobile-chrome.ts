/** True when a specific conversation is open on the unified `/messages` inbox. */
export function isMessagesThreadOpen(
  pathname: string,
  channelParam: string | null | undefined,
): boolean {
  const path = pathname.trim() || "/";
  if (path.startsWith("/messages/")) return true;
  if (path !== "/messages") return false;
  return Boolean((channelParam ?? "").trim());
}
