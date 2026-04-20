import { fail, ok } from "@/lib/api/response";
import { requireFullAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const STATUSES = new Set(["New", "Interviewed", "Hired", "Rejected"]);

export type ApplicantRow = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  age: number;
  email: string;
  notes: string | null;
  status: string;
};

export async function GET() {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("applicants")
    .select("id, created_at, first_name, last_name, age, email, notes, status")
    .order("created_at", { ascending: false });

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok((data ?? []) as ApplicantRow[]);
}

export async function POST(req: Request) {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const o = body as Record<string, unknown>;
  const first_name = typeof o.first_name === "string" ? o.first_name.trim() : "";
  const last_name = typeof o.last_name === "string" ? o.last_name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const notesRaw = o.notes;
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;
  const ageNum = typeof o.age === "number" ? o.age : Number(o.age);
  const statusRaw = typeof o.status === "string" ? o.status.trim() : "New";
  const status = STATUSES.has(statusRaw) ? statusRaw : "New";

  if (!first_name || !last_name) {
    return fail("VALIDATION_ERROR", "First and last name are required", 422);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail("VALIDATION_ERROR", "A valid email is required", 422);
  }
  if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) {
    return fail("VALIDATION_ERROR", "Age must be between 0 and 120", 422);
  }

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("applicants")
    .insert({
      first_name,
      last_name,
      age: Math.round(ageNum),
      email,
      notes,
      status,
    })
    .select("id, created_at, first_name, last_name, age, email, notes, status")
    .single();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok(data as ApplicantRow, 201);
}
