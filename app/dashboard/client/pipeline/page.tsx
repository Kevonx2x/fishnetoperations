import { redirect } from "next/navigation";

type Search = Record<string, string | string[] | undefined>;

export default async function ClientDashboardPipelineRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const leadRaw = sp.lead;
  const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw;
  const qs = new URLSearchParams();
  qs.set("tab", "pipeline");
  if (lead && typeof lead === "string" && lead.trim()) qs.set("lead", lead.trim());
  redirect(`/dashboard/client?${qs}`);
}
