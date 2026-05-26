import { redirect } from "next/navigation";

export default function AgentDashboardPipelineRedirectPage() {
  redirect("/dashboard/agent?tab=pipeline");
}
