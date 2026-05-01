import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeCity } from "@/lib/normalize-city";
import { duplicateExistingFromRpcRow } from "@/lib/duplicate-listing";

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
      skip_duplicate_check,
      force_publish_duplicate,
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
    const skipDup =
      skip_duplicate_check === true ||
      skip_duplicate_check === "true" ||
      skip_duplicate_check === 1 ||
      force_publish_duplicate === true ||
      force_publish_duplicate === "true" ||
      force_publish_duplicate === 1;

    if (!skipDup) {
      const { data: dupRows, error: dupErr } = await supabase.rpc("find_duplicate_active_property", {
        p_location: loc,
        p_lat: null,
        p_lng: null,
        p_exclude_id: null,
      });
      if (dupErr) {
        return NextResponse.json({ error: dupErr.message }, { status: 500 });
      }
      const dup = (Array.isArray(dupRows) ? dupRows[0] : null) as {
        id: string;
        prop_name: string;
        prop_location: string;
        listed_by: string | null;
      } | null;
      if (dup?.id) {
        const existing = await duplicateExistingFromRpcRow(supabase, dup);
        return NextResponse.json({ duplicate: true, existing }, { status: 409 });
      }
    }

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
        availability_state: "available",
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
