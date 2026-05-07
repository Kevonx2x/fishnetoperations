import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCity } from "@/lib/normalize-city";
import { manilaCalendarAddDays, manilaDateStringFromInstant, manilaLocalDateTimeToOffsetIso } from "@/lib/manila-datetime";

const DEMO_IMAGES = [
  "https://res.cloudinary.com/demo/image/upload/docs/house.jpg",
  "https://res.cloudinary.com/demo/image/upload/docs/greek-island-architecture.jpg",
  "https://res.cloudinary.com/demo/image/upload/docs/home-office.jpg",
];

function expiresAtIso(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

export async function POST() {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const sb = await createSupabaseServerClient();

  const [{ data: profileRow }, { data: agentRow }] = await Promise.all([
    sb.from("profiles").select("tutorial_completed").eq("id", session.userId).maybeSingle(),
    sb
      .from("agents")
      .select("id, verification_status")
      .eq("user_id", session.userId)
      .maybeSingle(),
  ]);

  if (!agentRow || (agentRow as { verification_status?: string }).verification_status !== "verified") {
    return Response.json({ ok: true });
  }

  const tutorialDone = (profileRow as { tutorial_completed?: boolean | null } | null)?.tutorial_completed === true;
  if (tutorialDone) {
    return Response.json({ ok: true });
  }

  const { count: propCount, error: countErr } = await sb
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("listed_by", session.userId);

  if (countErr) {
    return Response.json({ error: countErr.message }, { status: 500 });
  }
  if ((propCount ?? 0) > 0) {
    return Response.json({ ok: true });
  }

  const expires_at = expiresAtIso(60);

  const samples = [
    {
      name: "Sample 2BR Condo in BGC",
      location: "BGC, Taguig, Metro Manila",
      city: normalizeCity("Taguig"),
      region: "Metro Manila",
      neighborhood: "BGC",
      price: "35000",
      listing_type: "rent" as const,
      rent_price: "35000",
      status: "for_rent" as const,
      property_type: "Condo",
      sales_status: "RFO",
      beds: 2,
      baths: 2,
      sqft: "65",
      image_url: DEMO_IMAGES[0],
    },
    {
      name: "Sample Studio in Makati",
      location: "Makati CBD, Makati, Metro Manila",
      city: normalizeCity("Makati"),
      region: "Metro Manila",
      neighborhood: "Makati CBD",
      price: "22000",
      listing_type: "rent" as const,
      rent_price: "22000",
      status: "for_rent" as const,
      property_type: "Condo",
      sales_status: "RFO",
      beds: 0,
      baths: 1,
      sqft: "28",
      image_url: DEMO_IMAGES[1],
    },
    {
      name: "Sample 1BR in Ortigas",
      location: "Ortigas Center, Pasig, Metro Manila",
      city: normalizeCity("Pasig"),
      region: "Metro Manila",
      neighborhood: "Ortigas Center",
      price: "8500000",
      listing_type: "sale" as const,
      rent_price: null as string | null,
      status: "for_sale" as const,
      property_type: "Condo",
      sales_status: "RFO",
      beds: 1,
      baths: 1,
      sqft: "42",
      image_url: DEMO_IMAGES[2],
    },
  ];

  const insertedIds: string[] = [];
  for (const s of samples) {
    const { data: ins, error: insErr } = await sb
      .from("properties")
      .insert({
        name: s.name,
        location: s.location,
        city: s.city,
        region: s.region,
        neighborhood: s.neighborhood,
        price: s.price,
        listing_type: s.listing_type,
        rent_price: s.rent_price,
        sqft: s.sqft,
        beds: s.beds,
        baths: s.baths,
        image_url: s.image_url,
        status: s.status,
        listed_by: session.userId,
        property_type: s.property_type,
        sales_status: s.sales_status,
        description: null,
        is_presale: false,
        developer_name: null,
        turnover_date: null,
        unit_types: [],
        expires_at,
        expiry_notified_at: null,
        source_url: null,
        source_hash: null,
        availability_state: "available",
        lat: null,
        lng: null,
        formatted_address: null,
        place_id: null,
        listing_status: "active",
        is_demo: true,
      })
      .select("id")
      .single();

    if (insErr || !ins) {
      return Response.json({ error: insErr?.message ?? "Property insert failed" }, { status: 500 });
    }
    insertedIds.push((ins as { id: string }).id);
  }

  const [idBgc, idMakati, idOrtigas] = insertedIds;

  const tomorrowYmd = manilaCalendarAddDays(manilaDateStringFromInstant(new Date()), 1);
  const viewingIso = manilaLocalDateTimeToOffsetIso(tomorrowYmd, "17:00");

  const { data: vrRow, error: vrErr } = await sb
    .from("viewing_requests")
    .insert({
      agent_user_id: session.userId,
      property_id: idMakati,
      client_user_id: null,
      client_name: "Sample Client B",
      client_email: "sample-b@example.invalid",
      client_phone: null,
      scheduled_at: viewingIso,
      status: "confirmed",
      notes: "Sample viewing (tutorial)",
    })
    .select("id")
    .single();

  if (vrErr || !vrRow) {
    return Response.json({ error: vrErr?.message ?? "Viewing insert failed" }, { status: 500 });
  }
  const viewingId = (vrRow as { id: string }).id;

  const leadRows = [
    {
      name: "Sample Client A",
      email: "sample-a@example.invalid",
      phone: null as string | null,
      property_interest: samples[0].name,
      message: "Sample pipeline lead for your tutorial.",
      agent_id: session.userId,
      client_id: null as string | null,
      property_id: idBgc,
      source: "tutorial_seed",
      stage: "new",
      pipeline_stage: "lead",
      viewing_request_id: null as string | null,
      is_demo: true,
    },
    {
      name: "Sample Client B",
      email: "sample-b@example.invalid",
      phone: null as string | null,
      property_interest: samples[1].name,
      message: "Sample viewing-stage deal.",
      agent_id: session.userId,
      client_id: null,
      property_id: idMakati,
      source: "tutorial_seed",
      stage: "viewing",
      pipeline_stage: "viewing",
      viewing_request_id: viewingId,
      is_demo: true,
    },
    {
      name: "Sample Client C",
      email: "sample-c@example.invalid",
      phone: null as string | null,
      property_interest: samples[2].name,
      message: "Sample offer-stage deal.",
      agent_id: session.userId,
      client_id: null,
      property_id: idOrtigas,
      source: "tutorial_seed",
      stage: "negotiation",
      pipeline_stage: "offer",
      viewing_request_id: null as string | null,
      is_demo: true,
    },
  ];

  for (const row of leadRows) {
    const { error: leadErr } = await sb.from("leads").insert(row);
    if (leadErr) {
      return Response.json({ error: leadErr.message }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
