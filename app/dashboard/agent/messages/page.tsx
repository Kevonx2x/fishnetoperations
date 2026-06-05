import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ c?: string; channel?: string }>;
};

/** Legacy path → canonical agent in-house messenger tab. */
export default async function AgentDashboardMessagesRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const conversationId = sp.c?.trim();
  const params = new URLSearchParams({ tab: "messages" });
  if (conversationId) params.set("c", conversationId);
  redirect(`/dashboard/agent?${params.toString()}`);
}
