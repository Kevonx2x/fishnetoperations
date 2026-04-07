import { redirect } from "next/navigation";

/** Account fields (name, phone, avatar, password) live under `/settings`. */
export default function ProfilePage() {
  redirect("/settings");
}
