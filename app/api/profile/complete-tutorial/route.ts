import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Marks the signed-in user's onboarding spotlight tour as completed. */
export async function POST() {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ tutorial_completed: true, updated_at: new Date().toISOString() })
    .eq("id", session.userId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
