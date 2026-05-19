/** Pipeline deal card badge — priority: Hot > Follow up > New (only one shown). */

export type PipelineDealBadge = "hot" | "follow_up" | "new";

export type PipelineBadgeLead = {
  created_at: string;
  updated_at?: string | null;
  /** Requires `leads.follow_up_at` column — see pending migration. */
  follow_up_at?: string | null;
  /** Requires `leads.stage_changed_at` column — see pending migration. */
  stage_changed_at?: string | null;
};

function ts(raw: string | null | undefined): number {
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

function stageUnchangedSinceCreate(lead: PipelineBadgeLead): boolean {
  const created = ts(lead.created_at);
  const changed = lead.stage_changed_at ? ts(lead.stage_changed_at) : null;
  if (changed == null || changed === 0) return true;
  return Math.abs(changed - created) < 2000;
}

/** Returns at most one badge for a deal card. */
export function getPipelineDealBadge(lead: PipelineBadgeLead, now = Date.now()): PipelineDealBadge | null {
  const created = ts(lead.created_at);
  if (!created) return null;

  const ageMs = now - created;
  const h48 = 48 * 3600 * 1000;
  const h24 = 24 * 3600 * 1000;

  if (ageMs > h48 && stageUnchangedSinceCreate(lead)) {
    return "hot";
  }

  // Follow up badge requires leads.follow_up_at column — see pending migration
  if (lead.follow_up_at && ts(lead.follow_up_at) > now) {
    return "follow_up";
  }

  if (ageMs < h24) {
    return "new";
  }

  return null;
}

export function pipelineBadgeLabel(badge: PipelineDealBadge): string {
  switch (badge) {
    case "hot":
      return "Hot";
    case "follow_up":
      return "Follow up";
    case "new":
      return "New";
  }
}

/** Subtitle under stage chip when no follow-up date is set (mockup copy). */
export function pipelineDealStatusHint(
  badge: PipelineDealBadge | null,
  hasFollowUpLine: boolean,
): string | null {
  if (hasFollowUpLine || !badge) return null;
  if (badge === "hot") return "Waiting for client response";
  if (badge === "new") return "Follow up with client";
  return null;
}
