import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ channel?: string }>;
};

/** Legacy path → canonical unified inbox at /messages */
export default async function AgentDashboardMessagesRedirectPage({
  searchParams,
}: Props) {
  const sp = await searchParams;
  const channel = sp.channel?.trim();
  const qs = channel ? `?channel=${encodeURIComponent(channel)}` : "";
  redirect(`/messages${qs}`);
}
