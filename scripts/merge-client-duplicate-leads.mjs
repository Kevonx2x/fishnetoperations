/**
 * One-time admin script: archive duplicate active leads for a client (same property_id + agent_id).
 *
 * Usage (from fishnetoperations/):
 *   node scripts/merge-client-duplicate-leads.mjs --email "tj@example.com"          # dry run, reports only
 *   node scripts/merge-client-duplicate-leads.mjs --email "tj@example.com" --commit # actually archives
 *   node scripts/merge-client-duplicate-leads.mjs --client-id <uuid> --commit
 *
 * Requires: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";

const STAGE_RANK = {
  lead: 0,
  viewing: 1,
  offer: 2,
  reservation: 3,
  closed: 4,
  declined: -1,
};

function parseArgs() {
  const args = process.argv.slice(2);
  let email = null;
  let clientId = null;
  let commit = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    else if (args[i] === "--client-id" && args[i + 1]) clientId = args[++i];
    else if (args[i] === "--commit") commit = true;
  }
  return { email, clientId, commit };
}

function stageRank(stage) {
  const s = String(stage ?? "")
    .trim()
    .toLowerCase();
  return STAGE_RANK[s] ?? 0;
}

function pickKeeper(rows) {
  return [...rows].sort((a, b) => {
    const ua = new Date(a.updated_at || a.created_at).getTime();
    const ub = new Date(b.updated_at || b.created_at).getTime();
    if (ub !== ua) return ub - ua;
    const sr = stageRank(b.pipeline_stage) - stageRank(a.pipeline_stage);
    if (sr !== 0) return sr;
    return Number(b.id) - Number(a.id);
  })[0];
}

function groupKey(lead) {
  const pid = lead.property_id ?? "";
  const aid = lead.agent_id ?? "";
  return `${pid}\0${aid}`;
}

async function resolveClientId(admin, { email, clientId: clientIdArg }) {
  if (clientIdArg) return { clientId: clientIdArg, label: clientIdArg };

  const normalized = email.trim().toLowerCase();
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (authErr) {
    throw new Error(`auth.users lookup failed: ${authErr.message}`);
  }
  const match = (authData?.users ?? []).find((u) => u.email?.toLowerCase() === normalized);
  if (!match?.id) {
    throw new Error(`No auth user found for email: ${email}`);
  }

  const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", match.id).maybeSingle();
  const label = prof?.full_name?.trim()
    ? `${prof.full_name} <${prof.email ?? email}>`
    : `${prof?.email ?? email}`;
  return { clientId: match.id, label };
}

async function loadAgentNames(admin, agentUserIds) {
  const map = new Map();
  if (agentUserIds.length === 0) return map;
  const { data } = await admin.from("agents").select("user_id, name").in("user_id", agentUserIds);
  for (const row of data ?? []) {
    map.set(row.user_id, row.name?.trim() || row.user_id);
  }
  return map;
}

async function main() {
  const { email, clientId: clientIdArg, commit } = parseArgs();
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
  const mode = commit ? "COMMIT" : "DRY RUN";
  console.log(`\n=== merge-client-duplicate-leads (${mode}) ===\n`);

  const { clientId, label } = await resolveClientId(admin, { email, clientId: clientIdArg });
  console.log(`Client: ${label}`);
  console.log(`client_id: ${clientId}\n`);

  const { data: leads, error: leadsErr } = await admin
    .from("leads")
    .select("id, created_at, updated_at, pipeline_stage, agent_id, property_id, source, archived_by_client")
    .eq("client_id", clientId)
    .eq("archived_by_client", false)
    .order("property_id", { ascending: true })
    .order("agent_id", { ascending: true })
    .order("updated_at", { ascending: false });

  if (leadsErr) {
    console.error(leadsErr.message);
    process.exit(1);
  }

  const rows = leads ?? [];
  console.log(`Total active leads scanned: ${rows.length}`);

  if (rows.length < 2) {
    console.log("\nNothing to do (fewer than 2 active leads).\n");
    return;
  }

  const orphans = rows.filter((l) => !l.agent_id?.trim());
  const withAgent = rows.filter((l) => l.agent_id?.trim() && l.property_id?.trim());

  const groups = new Map();
  for (const lead of withAgent) {
    const k = groupKey(lead);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(lead);
  }

  const duplicateGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  const actions = [];

  for (const [, list] of duplicateGroups) {
    const keeper = pickKeeper(list);
    const losers = list.filter((l) => l.id !== keeper.id);
    for (const loser of losers) {
      actions.push({ keeper, loser });
    }
  }

  const agentIds = [...new Set(rows.map((l) => l.agent_id).filter(Boolean))];
  const agentNames = await loadAgentNames(admin, agentIds);

  if (orphans.length) {
    console.log("\n--- Orphan leads (agent_id IS NULL) — manual review only, NOT auto-archived ---");
    for (const o of orphans) {
      console.log(
        `  lead #${o.id} | property_id: ${o.property_id ?? "null"} | stage: ${o.pipeline_stage} | source: ${o.source ?? "—"} | created: ${o.created_at}`,
      );
    }
  }

  if (duplicateGroups.length === 0) {
    console.log("\nNo duplicate groups (same property_id + agent_id) among leads with both ids set.");
    if (orphans.length) {
      console.log("Resolve orphan leads manually or via backfill SQL before merging property duplicates.\n");
    } else {
      console.log("Nothing to merge.\n");
    }
    return;
  }

  console.log(`\nDuplicate groups found: ${duplicateGroups.length}`);
  console.log(`Leads to archive: ${actions.length}\n`);

  for (const [key, list] of duplicateGroups) {
    const [propertyId, agentId] = key.split("\0");
    const keeper = pickKeeper(list);
    const loserCount = list.length - 1;
    const agentLabel = agentNames.get(agentId) ?? agentId;
    console.log(
      `Property ${propertyId} / Agent ${agentLabel}: kept lead ${keeper.id} (${keeper.pipeline_stage}), ${commit ? "archiving" : "would archive"} ${loserCount} duplicate(s)`,
    );
    for (const l of list) {
      if (l.id === keeper.id) continue;
      console.log(`    - loser #${l.id} (${l.pipeline_stage}, updated ${l.updated_at})`);
    }
  }

  if (!commit) {
    console.log("\nDry run complete. Re-run with --commit to archive losers.\n");
    return;
  }

  const now = new Date().toISOString();
  let archived = 0;
  for (const { keeper, loser } of actions) {
    const note = `Merged with lead ${keeper.id} by admin script`;
    const { error } = await admin
      .from("leads")
      .update({
        archived_by_client: true,
        archived_at: now,
        archive_reason: "merged_duplicate",
        archive_note: note,
      })
      .eq("id", loser.id)
      .eq("client_id", clientId)
      .eq("archived_by_client", false);

    if (error) {
      console.error(`Failed to archive lead #${loser.id}:`, error.message);
      process.exit(1);
    }
    console.log(`ARCHIVED lead #${loser.id} → merged into #${keeper.id}`);
    archived += 1;
  }

  console.log(`\nDone. Archived ${archived} duplicate lead(s).\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
