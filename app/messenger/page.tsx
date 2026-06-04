import { redirect } from "next/navigation";

/** Legacy preview route — messenger lives in the client dashboard shell. */
export default function MessengerPage() {
  redirect("/dashboard/client/messages");
}
