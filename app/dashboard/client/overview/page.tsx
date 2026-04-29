import { redirect } from "next/navigation";

export default function ClientDashboardOverviewRedirectPage() {
  redirect("/dashboard/client");
}
