import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type AdminUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  /** Agent registration verified flag, if any */
  agent_verified: boolean | null;
  /** Broker registration verified flag, if any */
  broker_verified: boolean | null;
  agent_id: string | null;
  broker_id: string | null;
  agent_status: string | null;
  broker_status: string | null;
};

/** List all profiles with auth email + agent/broker flags (service role). */
export async function GET() {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const sb = createSupabaseAdmin();

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (pErr) {
    return fail("DATABASE_ERROR", pErr.message, 500);
  }

  const { data: authList, error: aErr } = await sb.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });

  if (aErr) {
    return fail("AUTH_ERROR", aErr.message, 500);
  }

  const emailById = new Map<string, string>();
  for (const u of authList.users) {
    emailById.set(u.id, u.email ?? "");
  }

  const ids = (profiles ?? []).map((p) => p.id as string);
  const { data: agents } = ids.length
    ? await sb.from("agents").select("id, user_id, status, verified").in("user_id", ids)
    : { data: [] as { id: string; user_id: string; status: string; verified: boolean }[] };

  const { data: brokers } = ids.length
    ? await sb.from("brokers").select("id, user_id, status, verified").in("user_id", ids)
    : { data: [] as { id: string; user_id: string; status: string; verified: boolean }[] };

  const agentByUser = new Map<string, { id: string; status: string; verified: boolean }>();
  for (const a of agents ?? []) {
    agentByUser.set(a.user_id as string, {
      id: a.id as string,
      status: a.status as string,
      verified: Boolean(a.verified),
    });
  }
  const brokerByUser = new Map<string, { id: string; status: string; verified: boolean }>();
  for (const b of brokers ?? []) {
    brokerByUser.set(b.user_id as string, {
      id: b.id as string,
      status: b.status as string,
      verified: Boolean(b.verified),
    });
  }

  const rows: AdminUserRow[] = (profiles ?? []).map((p) => {
    const id = p.id as string;
    const ag = agentByUser.get(id);
    const br = brokerByUser.get(id);
    return {
      id,
      email: emailById.get(id) ?? null,
      full_name: (p.full_name as string | null) ?? null,
      role: p.role as string,
      created_at: p.created_at as string,
      agent_verified: ag ? ag.verified : null,
      broker_verified: br ? br.verified : null,
      agent_id: ag?.id ?? null,
      broker_id: br?.id ?? null,
      agent_status: ag?.status ?? null,
      broker_status: br?.status ?? null,
    };
  });

  return ok(rows);
}
