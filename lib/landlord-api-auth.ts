import { getSessionProfile, type SessionProfile } from "@/lib/admin-api-auth";
import { isLandlordRole } from "@/lib/auth-roles";

export async function requireLandlordSession(): Promise<SessionProfile | "unauthorized"> {
  const session = await getSessionProfile();
  if (!session) return "unauthorized";
  if (!isLandlordRole(session.role)) return "unauthorized";
  return session;
}
