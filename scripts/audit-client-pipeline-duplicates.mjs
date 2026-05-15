/**
 * Audit duplicate active pipeline leads for a client (same property appearing multiple times).
 *
 * Usage (from fishnetoperations/):
 *   node scripts/audit-client-pipeline-duplicates.mjs --email tj@example.com
 *   node scripts/audit-client-pipeline-duplicates.mjs --client-id <uuid>
 *
 * Requires: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";

function parseArgs() {
  const args = process.argv.slice(2);
  let email = null;
  let clientId = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    else if (args[i] === "--client-id" && args[i + 1]) clientId = args[++i];
  }
  return { email, clientId };
}

function groupKey(lead) {
  const pid = lead.property_id?.trim() || "";
  const aid = lead.agent_id?.trim() || "";
  return `${pid}::${aid}`;
}

async function main() {
  const { email, clientId: clientIdArg } = parseArgs();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!email && !clientIdArg) {
    console.error("Provide --email or --client-id");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  let clientId = clientIdArg;
  if (!clientId && email) {
    const { data: prof, error } = await admin.from("profiles").select("id, email, full_name").eq("email", email).maybeSingle();
    if (error || !prof) {
      console.error("Profile not found for email:", email, error?.message);
      process.exit(1);
    }
    clientId = prof.id;
    console.log(`Client: ${prof.full_name ?? "—"} <${prof.email}> (${clientId})\n`);
  }

  const { data: leads, error: leadsErr } = await admin
    .from("leads")
    .select(
      "id, created_at, updated_at, property_id, agent_id, client_id, pipeline_stage, property_interest, archived_by_client, viewing_request_id, source",
    )
    .eq("client_id", clientId)
    .eq("archived_by_client", false)
    .order("created_at", { ascending: false });

  if (leadsErr) {
    console.error(leadsErr.message);
    process.exit(1);
  }

  const rows = leads ?? [];
  console.log(`Active (non-archived) leads: ${rows.length}\n`);

  const propertyIds = [...new Set(rows.map((l) => l.property_id).filter(Boolean))];
  const agentIds = [...new Set(rows.map((l) => l.agent_id).filter(Boolean))];

  const [{ data: props }, { data: agents }] = await Promise.all([
    propertyIds.length
      ? admin.from("properties").select("id, name, location").in("id", propertyIds)
      : Promise.resolve({ data: [] }),
    agentIds.length
      ? admin.from("agents").select("user_id, name").in("user_id", agentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const propById = new Map((props ?? []).map((p) => [p.id, p]));
  const agentById = new Map((agents ?? []).map((a) => [a.user_id, a]));

  const byProperty = new Map();
  for (const lead of rows) {
    const pid = lead.property_id ?? "(null property_id)";
    if (!byProperty.has(pid)) byProperty.set(pid, []);
    byProperty.get(pid).push(lead);
  }

  console.log("=== By property_id (active leads) ===\n");
  for (const [pid, list] of byProperty) {
    const prop = pid !== "(null property_id)" ? propById.get(pid) : null;
    const title = prop?.name || prop?.location || list[0]?.property_interest || pid;
    console.log(`${title}`);
    console.log(`  property_id: ${pid}`);
    console.log(`  lead count: ${list.length}`);
    if (list.length > 1) console.log("  ⚠ DUPLICATE CARDS IN PIPELINE UI");
    for (const l of list) {
      const agent = l.agent_id ? agentById.get(l.agent_id) : null;
      const agentLabel = agent?.name?.trim() || (l.agent_id ? `agent_id=${l.agent_id}` : "NO AGENT (shows as Your agent)");
      console.log(
        `    - lead #${l.id} | agent: ${agentLabel} | stage: ${l.pipeline_stage} | source: ${l.source ?? "—"} | created: ${l.created_at}`,
      );
    }
    console.log("");
  }

  const dupGroups = new Map();
  for (const lead of rows) {
    if (!lead.property_id || !lead.agent_id) continue;
    const k = groupKey(lead);
    if (!dupGroups.has(k)) dupGroups.set(k, []);
    dupGroups.get(k).push(lead);
  }

  const trueDupes = [...dupGroups.entries()].filter(([, list]) => list.length > 1);
  console.log("=== Same client + property_id + agent_id (should be unique per DB index) ===\n");
  if (trueDupes.length === 0) {
    console.log("None — duplicates are likely different agents and/or null property_id rows.\n");
  } else {
    for (const [k, list] of trueDupes) {
      console.log(`⚠ ${k} → ${list.length} leads: ${list.map((l) => l.id).join(", ")}`);
      console.log("  (Legacy data from before dedupe index, or index not applied in this environment.)\n");
    }
  }

  const nullPid = rows.filter((l) => !l.property_id);
  if (nullPid.length) {
    console.log(`=== Leads with NULL property_id (${nullPid.length}) ===`);
    console.log("These can look like the same listing in the UI but are separate dedupe keys.\n");
    for (const l of nullPid) {
      console.log(`  #${l.id} | interest: ${l.property_interest ?? "—"} | agent: ${l.agent_id ?? "null"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
