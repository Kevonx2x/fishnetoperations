import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ c?: string }>;
};

/** Legacy path → canonical agent messages tab (`?tab=messages`). */
export default async function AgentInhouseMessengerRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const conversationId = sp.c?.trim();
  const params = new URLSearchParams({ tab: "messages" });
  if (conversationId) params.set("c", conversationId);
  redirect(`/dashboard/agent?${params.toString()}`);
}
