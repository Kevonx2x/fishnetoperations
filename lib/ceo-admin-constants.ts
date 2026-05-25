export const CEO_CHECKLIST_CATEGORIES = [
  "operating",
  "financial",
  "product",
  "compliance",
  "strategic",
  "other",
] as const;

export type CeoChecklistCategory = (typeof CEO_CHECKLIST_CATEGORIES)[number];

export const CEO_DECISION_CATEGORIES = [
  "operating",
  "financial",
  "product",
  "compliance",
  "strategic",
  "other",
] as const;

export const CEO_DECISION_STATUSES = ["active", "reversed", "superseded"] as const;

export type CeoDecisionStatus = (typeof CEO_DECISION_STATUSES)[number];
