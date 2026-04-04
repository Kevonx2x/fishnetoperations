import type { SupabaseClient } from "@supabase/supabase-js";
import { mapRowToMarketplaceAgent, type MarketplaceAgent } from "@/lib/marketplace-types";

const AGENT_SELECT =
  "id, user_id, name, image_url, score, closings, response_time, availability, brokers (id, company_name, logo_url)";

type AgentRow = Parameters<typeof mapRowToMarketplaceAgent>[0];

/**
 * Up to 3 agents: same broker first (closest score), then fill with approved agents
 * whose score is within 0.5 of the current agent. Always excludes the current agent id.
 */
export async function fetchSimilarAgents(
  supabase: SupabaseClient,
  current: { id: string; broker_id: string | null; score: number },
): Promise<MarketplaceAgent[]> {
  const currentScore = Number(current.score);
  const minS = currentScore - 0.5;
  const maxS = currentScore + 0.5;
  const chosen: MarketplaceAgent[] = [];
  const seen = new Set<string>([current.id]);

  const pushUnique = (a: MarketplaceAgent) => {
    if (seen.has(a.id) || chosen.length >= 3) return;
    seen.add(a.id);
    chosen.push(a);
  };

  const byScoreDistance = (a: MarketplaceAgent, b: MarketplaceAgent) =>
    Math.abs(a.score - currentScore) - Math.abs(b.score - currentScore);

  if (current.broker_id) {
    const { data, error } = await supabase
      .from("agents")
      .select(AGENT_SELECT)
      .eq("broker_id", current.broker_id)
      .neq("id", current.id)
      .eq("status", "approved")
      .eq("verified", true)
      .limit(50);
    if (!error && data) {
      const rows = data.map((row) => mapRowToMarketplaceAgent(row as AgentRow)).sort(byScoreDistance);
      for (const a of rows) {
        pushUnique(a);
        if (chosen.length >= 3) return chosen.slice(0, 3);
      }
    }
  }

  if (chosen.length < 3) {
    const { data, error } = await supabase
      .from("agents")
      .select(AGENT_SELECT)
      .neq("id", current.id)
      .eq("status", "approved")
      .eq("verified", true)
      .gte("score", minS)
      .lte("score", maxS)
      .limit(50);
    if (!error && data) {
      const rows = data
        .map((row) => mapRowToMarketplaceAgent(row as AgentRow))
        .filter((a) => !seen.has(a.id))
        .sort(byScoreDistance);
      for (const a of rows) {
        pushUnique(a);
        if (chosen.length >= 3) break;
      }
    }
  }

  return chosen.slice(0, 3);
}
