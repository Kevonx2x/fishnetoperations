import { redirect } from "next/navigation";

export default function DashboardClientIndexPage() {
  redirect("/dashboard/client/overview");
}
