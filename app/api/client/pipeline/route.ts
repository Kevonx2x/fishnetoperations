import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { displayLabelForClientDealDocument } from "@/lib/deal-document-client-label";
import { comparePropertyPhotos } from "@/lib/marketplace-property";
import { cloudinaryPropertyPhotoDisplayUrl } from "@/lib/cloudinary-property-photo-url";

type ViewingRow = {
  id: string;
  status: string;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
};

type DealDocRow = {
  id: string;
  lead_id: number;
  document_type: string;
  document_name: string | null;
  status: string | null;
  direction: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
};

function pickHeroImage(args: {
  image_url: string | null;
  property_photos: { url: string | null; sort_order?: number | null; created_at?: string | null }[] | null;
}): string {
  const photos = (args.property_photos ?? [])
    .slice()
    .sort(comparePropertyPhotos)
    .map((p) => String(p.url || "").trim())
    .filter(Boolean)
    .map((u) => cloudinaryPropertyPhotoDisplayUrl(u));
  if (photos[0]) return photos[0];
  const main = args.image_url?.trim();
  return main ? cloudinaryPropertyPhotoDisplayUrl(main) : "";
}

function countPropertyGalleryPhotos(args: {
  image_url: string | null;
  property_photos: { url: string | null; sort_order?: number | null; created_at?: string | null }[] | null;
}): number {
  const n = (args.property_photos ?? [])
    .slice()
    .sort(comparePropertyPhotos)
    .map((p) => String(p.url || "").trim())
    .filter(Boolean).length;
  if (n > 0) return n;
  return args.image_url?.trim() ? 1 : 0;
}

function statusPillForDeal(args: {
  pipeline_stage: string;
  viewing: ViewingRow | null;
  hasPendingRequestedDocs: boolean;
}): string {
  const vr = args.viewing;
  if (vr?.status === "declined") return "Declined";
  if (args.pipeline_stage === "closed") return "Closed";
  if (args.hasPendingRequestedDocs) return "Documents requested";
  if (args.pipeline_stage === "reservation") return "Reservation confirmed";
  if (args.pipeline_stage === "offer") return "Offer in progress";
  if (vr?.status === "confirmed") return "Viewing scheduled";
  if (vr?.status === "pending" || vr?.status === "rescheduled") return "Inquiry sent";
  return "Awaiting agent response";
}

export async function GET(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Clients only" }, { status: 403 });
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const clientId = session.userId;
  const url = new URL(req.url);
  const archivedParam = url.searchParams.get("archived");
  const archivedOnly = archivedParam === "1" || archivedParam === "true";

  const { data: leadRows, error: leadsErr } = await admin
    .from("leads")
    .select(
      "id, created_at, updated_at, property_id, agent_id, client_id, pipeline_stage, property_interest, viewing_request_id, archived_by_client, archived_at, archive_reason, archive_note, stage_at_archive",
    )
    .eq("client_id", clientId)
    .eq("archived_by_client", archivedOnly)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (leadsErr) {
    return Response.json({ error: leadsErr.message }, { status: 500 });
  }

  const leads = (leadRows ?? []) as {
    id: number;
    created_at: string;
    updated_at: string;
    property_id: string | null;
    agent_id: string | null;
    client_id: string | null;
    pipeline_stage: string;
    property_interest: string | null;
    viewing_request_id: string | null;
    archived_by_client: boolean;
    archived_at: string | null;
    archive_reason: string | null;
    archive_note: string | null;
    stage_at_archive: string | null;
  }[];

  const propertyIds = [...new Set(leads.map((l) => l.property_id).filter((x): x is string => Boolean(x)))];
  const agentUserIds = [...new Set(leads.map((l) => l.agent_id).filter((x): x is string => Boolean(x)))];
  const viewingIds = [...new Set(leads.map((l) => l.viewing_request_id).filter((x): x is string => Boolean(x)))];

  const [{ data: propsData }, { data: agentsData }, { data: viewingsData }, { data: docsData }] =
    await Promise.all([
      propertyIds.length
        ? admin
            .from("properties")
            .select("id, name, location, price, image_url, deleted_at, property_photos(url, sort_order, created_at)")
            .in("id", propertyIds)
        : Promise.resolve({ data: [] as unknown[] }),
      agentUserIds.length
        ? admin.from("agents").select("user_id, name, verified, image_url").in("user_id", agentUserIds)
        : Promise.resolve({ data: [] as unknown[] }),
      viewingIds.length
        ? admin.from("viewing_requests").select("id, status, scheduled_at, created_at, updated_at").in("id", viewingIds)
        : Promise.resolve({ data: [] as unknown[] }),
      leads.length
        ? admin
            .from("deal_documents")
            .select(
              "id, lead_id, document_type, document_name, status, direction, file_url, file_name, created_at",
            )
            .in(
              "lead_id",
              leads.map((l) => l.id),
            )
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  const propById = new Map(
    (propsData ?? []).map((r) => {
      const row = r as {
        id: string;
        name: string | null;
        location: string;
        price: string;
        image_url: string | null;
        deleted_at: string | null;
        property_photos: { url: string | null; sort_order?: number | null; created_at?: string | null }[] | null;
      };
      return [row.id, row] as const;
    }),
  );

  const agentByUserId = new Map(
    (agentsData ?? []).map((r) => {
      const row = r as {
        user_id: string;
        name: string | null;
        verified: boolean | null;
        image_url: string | null;
      };
      return [row.user_id, row] as const;
    }),
  );

  const viewingById = new Map(
    (viewingsData ?? []).map((r) => {
      const row = r as ViewingRow;
      return [row.id, row] as const;
    }),
  );

  const docsByLeadId = new Map<number, DealDocRow[]>();
  for (const d of (docsData ?? []) as DealDocRow[]) {
    const lid = d.lead_id;
    if (!docsByLeadId.has(lid)) docsByLeadId.set(lid, []);
    docsByLeadId.get(lid)!.push(d);
  }

  const deals = leads.map((lead) => {
    const prop = lead.property_id ? propById.get(lead.property_id) : undefined;
    const agentUserId = lead.agent_id ?? "";
    const agent = agentUserId ? agentByUserId.get(agentUserId) : undefined;
    const viewing = lead.viewing_request_id ? viewingById.get(lead.viewing_request_id) ?? null : null;
    const docs = docsByLeadId.get(lead.id) ?? [];
    const hasPendingRequestedDocs = docs.some(
      (d) => d.direction === "requested" && d.status === "pending" && !d.file_url?.trim(),
    );

    const title =
      (prop?.name && String(prop.name).trim()) ||
      (prop?.location && String(prop.location).trim()) ||
      (lead.property_interest && String(lead.property_interest).trim()) ||
      "Property interest";

    const priceDisplay = prop?.price?.trim() || "—";

    const hero = prop
      ? pickHeroImage({
          image_url: prop.image_url,
          property_photos: prop.property_photos ?? null,
        })
      : "";

    const photoCount = prop
      ? countPropertyGalleryPhotos({
          image_url: prop.image_url,
          property_photos: prop.property_photos ?? null,
        })
      : 0;

    return {
      lead_id: lead.id,
      pipeline_stage: lead.pipeline_stage,
      archived_by_client: lead.archived_by_client,
      archived_at: lead.archived_at,
      archive_reason: lead.archive_reason,
      archive_note: lead.archive_note,
      stage_at_archive: lead.stage_at_archive,
      status_label: archivedOnly
        ? "Archived"
        : statusPillForDeal({
            pipeline_stage: lead.pipeline_stage,
            viewing,
            hasPendingRequestedDocs,
          }),
      property: prop
        ? {
            id: prop.id,
            title,
            price: priceDisplay,
            hero_image: hero,
            photo_count: photoCount,
            listing_removed: prop.deleted_at != null && String(prop.deleted_at).trim() !== "",
          }
        : {
            id: null as string | null,
            title,
            price: priceDisplay,
            hero_image: "",
            photo_count: photoCount,
            listing_removed: false,
          },
      agent: {
        user_id: agentUserId,
        name: (agent?.name && String(agent.name).trim()) || "Your agent",
        verified: Boolean(agent?.verified),
        image_url: agent?.image_url?.trim() || null,
      },
      viewing,
      lead_created_at: lead.created_at,
      documents: docs.map((d) => ({
        id: d.id,
        document_type: d.document_type,
        display_label: displayLabelForClientDealDocument(d.document_type, d.document_name),
        status: d.status,
        direction: d.direction,
        file_url: d.file_url,
        file_name: d.file_name,
        created_at: d.created_at,
        pending_upload: d.direction === "requested" && d.status === "pending" && !d.file_url?.trim(),
      })),
    };
  });

  return Response.json({ deals });
}
