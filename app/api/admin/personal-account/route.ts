import { fail, ok } from "@/lib/api/response";
import { requireFullAdminSession } from "@/lib/admin-api-auth";
import {
  canAccessPersonalTreasury,
  computeTreasurySnapshot,
  type PersonalTreasuryExpense,
} from "@/lib/admin-personal-treasury";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const session = await requireFullAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  if (!canAccessPersonalTreasury(session.email, session.role)) {
    return fail("FORBIDDEN", "Personal account is restricted", 403);
  }

  const sb = createSupabaseAdmin();
  const [{ data: credentials, error }, { data: profileRow }] = await Promise.all([
    sb.from("admin_credentials").select("id, service_name, monthly_cost").order("service_name", { ascending: true }),
    sb.from("profiles").select("full_name").eq("id", session.userId).maybeSingle(),
  ]);

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  const holderName =
    (typeof profileRow?.full_name === "string" && profileRow.full_name.trim()) || "Personal";

  const expenses: PersonalTreasuryExpense[] = [];
  for (const row of credentials ?? []) {
    const amount = Number(row.monthly_cost ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    expenses.push({
      id: String(row.id),
      label: String(row.service_name ?? "Service").trim() || "Service",
      amount,
      source: "credential",
    });
  }

  const snapshot = computeTreasurySnapshot(expenses);

  return ok({
    accountLabel: "Personal account",
    accountNumberMasked: "•••• 9031",
    holderName,
    currency: "PHP",
    ...snapshot,
  });
}
