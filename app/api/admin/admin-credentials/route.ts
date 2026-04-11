import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SUPER_ADMIN_EMAIL = "ron.business101@gmail.com";

function requireCredentialsAccess(denied: Awaited<ReturnType<typeof requireAdminSession>>) {
  if (denied === "unauthorized") return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  if ((denied.email ?? "").toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return fail("FORBIDDEN", "Credentials vault is restricted", 403);
  }
  return null;
}

export async function GET() {
  const denied = await requireAdminSession();
  const block = requireCredentialsAccess(denied);
  if (block) return block;

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("admin_credentials")
    .select("*")
    .order("service_name", { ascending: true });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  const totalMonthly = (data ?? []).reduce(
    (sum, r: { monthly_cost: string | number | null }) => sum + Number(r.monthly_cost ?? 0),
    0,
  );

  return ok({ rows: data ?? [], totalMonthly });
}

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  const block = requireCredentialsAccess(denied);
  if (block) return block;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }
  const o = body as Record<string, unknown>;
  const service_name = typeof o.service_name === "string" ? o.service_name.trim() : "";
  if (!service_name) return fail("VALIDATION_ERROR", "Service name is required", 422);

  const sb = createSupabaseAdmin();
  const monthly =
    typeof o.monthly_cost === "number"
      ? o.monthly_cost
      : parseFloat(String(o.monthly_cost ?? "0"));
  const monthly_cost = Number.isFinite(monthly) ? monthly : 0;

  const { data, error } = await sb
    .from("admin_credentials")
    .insert({
      service_name,
      username: typeof o.username === "string" ? o.username : "",
      password_plain: typeof o.password_plain === "string" ? o.password_plain : "",
      monthly_cost,
      notes: typeof o.notes === "string" ? o.notes.trim() || null : null,
    })
    .select("*")
    .single();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  return ok(data, 201);
}
