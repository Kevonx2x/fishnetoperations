/** True when a specific conversation thread is open (hides mobile chrome). */
export function isMessagesThreadOpen(
  pathname: string,
  threadParam: string | null | undefined,
): boolean {
  const path = pathname.trim() || "/";
  const open = Boolean((threadParam ?? "").trim());

  if (path.startsWith("/messages/")) return true;
  if (path === "/messages" && open) return true;

  if (path.startsWith("/dashboard/client/messages") && open) return true;
  if (path === "/dashboard/agent" && open) return true;

  return false;
}
