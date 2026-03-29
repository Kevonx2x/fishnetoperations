import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdminPassword } from "@/lib/admin-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { password, ...rest } = body as Record<string, unknown>;

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const update: Record<string, string | number> = {};
    if (typeof rest.location === "string") update.location = rest.location;
    if (typeof rest.price === "string") update.price = rest.price;
    if (typeof rest.sqft === "string") update.sqft = rest.sqft;
    if (typeof rest.image_url === "string") update.image_url = rest.image_url;
    if (typeof rest.beds === "number") update.beds = Math.round(rest.beds);
    if (typeof rest.baths === "number") update.baths = Math.round(rest.baths);

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
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const password = (body as { password?: string }).password;

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("properties").delete().eq("id", id);

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
