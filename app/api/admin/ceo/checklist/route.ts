import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import {
  CEO_CHECKLIST_CADENCES,
  type CeoChecklistCadence,
} from "@/lib/ceo-checklist-due";
import { CEO_CHECKLIST_CATEGORIES } from "@/lib/ceo-admin-constants";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type ChecklistItemRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  cadence: string;
  estimated_minutes: number | null;
  sort_order: number;
  is_active: boolean;
  last_completed_at: string | null;
  last_completed_by: string | null;
  created_at: string;
  updated_at: string;
};

type CompletionRow = {
  item_id: string;
  notes: string | null;
  completed_at: string;
};

export async function GET() {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const admin = createSupabaseAdmin();
  const { data: items, error: itemsErr } = await admin
    .from("ceo_checklist_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (itemsErr) {
    return fail("DATABASE_ERROR", itemsErr.message, 500);
  }

  const list = (items ?? []) as ChecklistItemRow[];
  const ids = list.map((i) => i.id);

  let completions: CompletionRow[] = [];
  if (ids.length > 0) {
    const { data: compRows, error: compErr } = await admin
      .from("ceo_checklist_completions")
      .select("item_id, notes, completed_at")
      .in("item_id", ids)
      .order("completed_at", { ascending: false });

    if (compErr) {
      return fail("DATABASE_ERROR", compErr.message, 500);
    }
    completions = (compRows ?? []) as CompletionRow[];
  }

  const countByItem: Record<string, number> = {};
  const lastNotesByItem: Record<string, string | null> = {};
  for (const c of completions) {
    countByItem[c.item_id] = (countByItem[c.item_id] ?? 0) + 1;
    if (!(c.item_id in lastNotesByItem)) {
      lastNotesByItem[c.item_id] = c.notes;
    }
  }

  const enriched = list.map((item) => ({
    ...item,
    completion_count: countByItem[item.id] ?? 0,
    last_completion_notes: lastNotesByItem[item.id] ?? null,
  }));

  return ok({ items: enriched });
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const o = body as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const description =
    typeof o.description === "string" && o.description.trim()
      ? o.description.trim()
      : null;
  const category = typeof o.category === "string" ? o.category.trim() : "";
  const cadence = typeof o.cadence === "string" ? o.cadence.trim() : "";
  const estimatedRaw = o.estimated_minutes;
  const estimated_minutes =
    estimatedRaw === null || estimatedRaw === undefined
      ? null
      : typeof estimatedRaw === "number"
        ? Math.round(estimatedRaw)
        : Number(estimatedRaw);

  if (!title) {
    return fail("VALIDATION_ERROR", "Title is required", 422);
  }
  if (!CEO_CHECKLIST_CATEGORIES.includes(category as (typeof CEO_CHECKLIST_CATEGORIES)[number])) {
    return fail("VALIDATION_ERROR", "Invalid category", 422);
  }
  if (!CEO_CHECKLIST_CADENCES.includes(cadence as CeoChecklistCadence)) {
    return fail("VALIDATION_ERROR", "Invalid cadence", 422);
  }
  if (
    estimated_minutes != null &&
    (!Number.isFinite(estimated_minutes) || estimated_minutes < 0)
  ) {
    return fail("VALIDATION_ERROR", "Invalid estimated_minutes", 422);
  }

  const admin = createSupabaseAdmin();
  const { data: maxRow } = await admin
    .from("ceo_checklist_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? 0) + 10;

  const { data, error } = await admin
    .from("ceo_checklist_items")
    .insert({
      title,
      description,
      category,
      cadence,
      estimated_minutes,
      sort_order,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }

  return ok(
    {
      ...(data as ChecklistItemRow),
      completion_count: 0,
      last_completion_notes: null,
    },
    201,
  );
}
