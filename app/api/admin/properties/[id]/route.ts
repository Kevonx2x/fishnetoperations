import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCity } from "@/lib/normalize-city";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = await req.json();
    const rest = body as Record<string, unknown>;

    if (rest.featured === true) {
      const supabase = createSupabaseAdmin();
      const { error: clearErr } = await supabase.from("properties").update({ featured: false });
      if (clearErr) {
        return NextResponse.json({ error: clearErr.message }, { status: 500 });
      }
      const { data, error } = await supabase
        .from("properties")
        .update({ featured: true })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ property: data });
    }

    const update: Record<string, string | number | null> = {};
    if (typeof rest.availability_state === "string") {
      const av = rest.availability_state.trim();
      if (["available", "reserved", "closed", "removed"].includes(av)) {
        update.availability_state = av;
      }
    }
    if (typeof rest.location === "string") {
      const loc = rest.location.trim();
      update.location = loc;
      update.city = normalizeCity(loc);
    }
    if (typeof rest.price === "string") update.price = rest.price;
    if (typeof rest.sqft === "string") update.sqft = rest.sqft;
    if (typeof rest.image_url === "string") update.image_url = rest.image_url;
    if (typeof rest.beds === "number") update.beds = Math.round(rest.beds);
    if (typeof rest.baths === "number") update.baths = Math.round(rest.baths);
    if (rest.listed_by === null) update.listed_by = null;
    if (typeof rest.listed_by === "string") {
      update.listed_by = rest.listed_by.length ? rest.listed_by : null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("properties")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ property: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        {
          error:
            "Server is not configured with SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("properties")
      .update({ deleted_at: new Date().toISOString(), availability_state: "removed" })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        {
          error:
            "Server is not configured with SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
