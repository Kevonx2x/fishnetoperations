/**
 * Audit leads with NULL agent_id (all clients).
 *
 * Usage (from fishnetoperations/):
 *   node scripts/audit-null-agent-leads.mjs
 *
 * Requires: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data, error, count } = await admin
    .from("leads")
    .select("id, created_at, client_id, property_id, source, pipeline_stage", { count: "exact" })
    .is("agent_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  const bySource = new Map();
  for (const r of rows) {
    const src = r.source?.trim() || "(null source)";
    bySource.set(src, (bySource.get(src) ?? 0) + 1);
  }

  console.log(`\n=== NULL agent_id leads (showing up to 50, total count: ${count ?? rows.length}) ===\n`);
  for (const r of rows) {
    console.log(
      `#${r.id} | created ${r.created_at} | client_id ${r.client_id ?? "null"} | property_id ${r.property_id ?? "null"} | source ${r.source ?? "—"} | stage ${r.pipeline_stage}`,
    );
  }

  console.log("\nBy source (in sample):");
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${n}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
