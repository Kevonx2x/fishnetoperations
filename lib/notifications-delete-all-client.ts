export type DeleteAllNotificationsResult =
  | { ok: true; deletedCount: number }
  | { ok: false; error: string };

export async function requestDeleteAllNotifications(): Promise<DeleteAllNotificationsResult> {
  const res = await fetch("/api/notifications/delete-all", {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    deletedCount?: number;
  } | null;
  if (!res.ok) {
    return { ok: false, error: typeof json?.error === "string" ? json.error : "Could not delete notifications." };
  }
  if (!json?.ok) {
    return { ok: false, error: typeof json?.error === "string" ? json.error : "Could not delete notifications." };
  }
  return { ok: true, deletedCount: typeof json.deletedCount === "number" ? json.deletedCount : 0 };
}
