import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { labelForClientDocType } from "@/lib/client-documents";

type LogRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
};

function formatEntry(row: LogRow): string {
  const m = row.metadata ?? {};
  const docLabel = (() => {
    const dl = m.document_label;
    if (typeof dl === "string" && dl.trim()) return dl.trim();
    const dt = m.document_type;
    if (typeof dt === "string" && dt) return labelForClientDocType(dt);
    return "a document";
  })();

  const agentName =
    typeof m.agent_name === "string" && m.agent_name.trim()
      ? m.agent_name.trim()
      : "An agent";

  switch (row.action) {
    case "document_viewed":
      return `You viewed ${docLabel}`;
    case "client_document_uploaded":
      return `You uploaded ${docLabel}`;
    case "client_document_deleted":
      return `You deleted ${docLabel}`;
    case "client_document_shared": {
      const types = m.document_types;
      if (Array.isArray(types) && types.length > 0) {
        const labels = types
          .map((t) => labelForClientDocType(String(t)))
          .filter(Boolean)
          .join(", ");
        return labels ? `Shared ${labels} with ${agentName}` : `Shared documents with ${agentName}`;
      }
      return `Shared ${docLabel} with ${agentName}`;
    }
    case "client_document_unshared":
      return `Stopped sharing ${docLabel} with ${agentName}`;
    case "agent_document_sent_to_client":
      return `${agentName} sent you a document`;
    case "client_document_sent_to_agent":
      return `You sent a document to ${agentName}`;
    default:
      return row.action.replace(/_/g, " ");
  }
}

const CLIENT_ACTIONS = [
  "document_viewed",
  "client_document_uploaded",
  "client_document_deleted",
  "client_document_shared",
  "client_document_unshared",
  "client_document_sent_to_agent",
] as const;

const AGENT_TO_CLIENT_ACTIONS = ["agent_document_sent_to_client"] as const;

export async function GET() {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Only clients can view this" }, { status: 403 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const clientId = session.userId;

  const { data: ownRows, error: e1 } = await admin
    .from("activity_log")
    .select("id, created_at, actor_id, action, entity_type, entity_id, metadata")
    .eq("actor_id", clientId)
    .in("action", [...CLIENT_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(80);

  if (e1) {
    return Response.json({ error: e1.message }, { status: 500 });
  }

  const { data: recvRows, error: e2 } = await admin
    .from("activity_log")
    .select("id, created_at, actor_id, action, entity_type, entity_id, metadata")
    .contains("metadata", { client_user_id: clientId })
    .in("action", [...AGENT_TO_CLIENT_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(40);

  if (e2) {
    return Response.json({ error: e2.message }, { status: 500 });
  }

  const merged = [...(ownRows ?? []), ...(recvRows ?? [])] as LogRow[];
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const seen = new Set<string>();
  const unique: LogRow[] = [];
  for (const r of merged) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
  }

  const entries = unique.slice(0, 100).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    message: formatEntry(row),
  }));

  return Response.json({ entries });
}
