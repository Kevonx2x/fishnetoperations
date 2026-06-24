export const ADMIN_TEAM_PRINT_PLAN_STORAGE_PREFIX = "adminTeamPrintPlan:";

export function adminTeamPrintPlanStorageKey(printId: string): string {
  return `${ADMIN_TEAM_PRINT_PLAN_STORAGE_PREFIX}${printId}`;
}
