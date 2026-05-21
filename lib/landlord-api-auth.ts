import { getSessionProfile, type SessionProfile } from "@/lib/admin-api-auth";
import { isLandlordCapable } from "@/lib/auth-roles";

export async function requireLandlordSession(): Promise<SessionProfile | "unauthorized"> {
  const session = await getSessionProfile();
  if (!session) return "unauthorized";
  if (!isLandlordCapable(session)) return "unauthorized";
  return session;
}
