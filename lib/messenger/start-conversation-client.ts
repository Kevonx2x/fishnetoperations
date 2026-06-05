export type StartConversationResponse = {
  success?: boolean;
  data?: { conversationId?: string; created?: boolean };
  error?: { message?: string; code?: string };
};

export async function startMessengerConversation(payload: {
  otherUserId: string;
  propertyId?: string;
  dormspaceId?: string;
}): Promise<{ conversationId: string } | { error: string }> {
  const res = await fetch("/api/messenger/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => ({}))) as StartConversationResponse;
  const conversationId = json.data?.conversationId;

  if (!res.ok || !conversationId) {
    const message =
      json.error?.message ??
      (json as { error?: string }).error ??
      "Could not start conversation.";
    return { error: typeof message === "string" ? message : "Could not start conversation." };
  }

  return { conversationId };
}
