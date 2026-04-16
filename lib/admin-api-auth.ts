import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/auth-roles";

export type SessionProfile = {
  userId: string;
  email: string | null;
  role: ProfileRole;
};

/** Current session user + profile role from DB (cookie auth). */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const raw = profile?.role;
  const role: ProfileRole =
    raw === "admin" || raw === "broker" || raw === "agent" || raw === "client" || raw === "team_member"
      ? raw
      : "client";

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
}

export async function requireAdminSession(): Promise<SessionProfile | "unauthorized"> {
  const session = await getSessionProfile();
  if (!session) return "unauthorized";
  if (session.role !== "admin") return "unauthorized";
  return session;
}
