export function calculateAgentScore({
  closings,
  avgResponseHours,
  profileCompleteness,
  isVerified,
}: {
  closings: number;
  avgResponseHours: number;
  profileCompleteness: number;
  isVerified: boolean;
}): number {
  const closingScore = (Math.log(closings + 1) / Math.log(50)) * 10 * 0.5;

  const responseScore = (1 - Math.min(avgResponseHours / 24, 1)) * 10 * 0.2;

  const profileScore = profileCompleteness * 10 * 0.15;

  const verifiedScore = (isVerified ? 10 : 0) * 0.15;

  const total = closingScore + responseScore + profileScore + verifiedScore;

  return Math.round(total * 10) / 10;
}

/** Per lead: hours between created_at and updated_at, capped at 24. Average across leads; empty → 24 (worst). */
export function averageLeadResponseHours(
  leads: { created_at: string; updated_at?: string | null }[],
): number {
  if (leads.length === 0) return 24;
  let sum = 0;
  for (const l of leads) {
    const c = new Date(l.created_at).getTime();
    const u = new Date(l.updated_at ?? l.created_at).getTime();
    const hours = Math.max(0, (u - c) / 3600000);
    sum += Math.min(hours, 24);
  }
  return sum / leads.length;
}

export function profileCompletenessFromFlags(flags: {
  hasAvatar: boolean;
  hasBio: boolean;
  hasPhone: boolean;
  hasListing: boolean;
}): number {
  return (
    (flags.hasAvatar ? 0.25 : 0) +
    (flags.hasBio ? 0.25 : 0) +
    (flags.hasPhone ? 0.25 : 0) +
    (flags.hasListing ? 0.25 : 0)
  );
}
