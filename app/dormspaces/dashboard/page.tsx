import { redirect } from "next/navigation";

/** Landlord hub removed — sidebar covers navigation; listings is the default landing. */
export default function DormspaceLandlordDashboardPage() {
  redirect("/dormspaces/dashboard/listings");
}
