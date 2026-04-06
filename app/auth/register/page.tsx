import { redirect } from "next/navigation";

/** Alias for signup — links use /auth/register for marketing copy. */
export default function RegisterPage() {
  redirect("/auth/signup");
}
