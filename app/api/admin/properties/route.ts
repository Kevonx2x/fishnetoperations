import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCity } from "@/lib/normalize-city";

export async function POST(req: Request) {
  try {
    const denied = await requireAdminSession();
    if (denied === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      location,
      price,
      sqft,
      beds,
      baths,
      image_url,
      listed_by,
    } = body as Record<string, unknown>;

    if (
      typeof location !== "string" ||
      typeof price !== "string" ||
      typeof sqft !== "string" ||
      typeof image_url !== "string" ||
      typeof beds !== "number" ||
      typeof baths !== "number"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const listedBy =
      typeof listed_by === "string" && listed_by.length > 0 ? listed_by : null;

    const supabase = createSupabaseAdmin();
    const loc = typeof location === "string" ? location.trim() : "";
    const { data, error } = await supabase
      .from("properties")
      .insert({
        location: loc,
        city: normalizeCity(loc),
        price,
        sqft,
        beds: Math.round(beds),
        baths: Math.round(baths),
        image_url,
        listed_by: listedBy,
      })
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
