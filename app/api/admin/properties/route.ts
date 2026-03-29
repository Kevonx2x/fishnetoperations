import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyAdminPassword } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      password,
      location,
      price,
      sqft,
      beds,
      baths,
      image_url,
    } = body as Record<string, unknown>;

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("properties")
      .insert({
        location,
        price,
        sqft,
        beds: Math.round(beds),
        baths: Math.round(baths),
        image_url,
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
