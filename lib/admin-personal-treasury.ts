/** Owner personal treasury — admin-only (super admin email). */
export const PERSONAL_TREASURY_SUPER_ADMIN_EMAIL = "ron.business101@gmail.com";

/** Gross treasury balance in PHP (before monthly recurring deductions). */
export const PERSONAL_TREASURY_BALANCE_PHP = 6_803_399;

export type PersonalTreasuryExpense = {
  id: string;
  label: string;
  amount: number;
  source: "credential" | "fixed";
};

export function canAccessPersonalTreasury(
  email: string | null | undefined,
  role: string | null | undefined,
): boolean {
  return (
    role === "admin" &&
    (email ?? "").trim().toLowerCase() === PERSONAL_TREASURY_SUPER_ADMIN_EMAIL
  );
}

export function formatTreasuryPeso(amount: number, options?: { decimals?: boolean }): string {
  const decimals = options?.decimals ?? false;
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

export function computeTreasurySnapshot(expenses: PersonalTreasuryExpense[]) {
  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const availableBalance = PERSONAL_TREASURY_BALANCE_PHP - totalMonthlyExpenses;
  return {
    grossBalance: PERSONAL_TREASURY_BALANCE_PHP,
    totalMonthlyExpenses,
    availableBalance,
    expenses,
  };
}
