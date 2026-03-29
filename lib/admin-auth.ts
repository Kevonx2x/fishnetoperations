/** Must match the password used in the admin UI (see env ADMIN_PASSWORD). */
export function verifyAdminPassword(password: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "fishnet2026";
  return typeof password === "string" && password === expected;
}
