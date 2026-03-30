import type { NextRequest } from "next/server";

/** Password-based admin gate for server routes (matches admin UI default). */
export function verifyAdminApiRequest(request: NextRequest): boolean {
  const pwd = request.headers.get("x-admin-password");
  const expected = process.env.ADMIN_PASSWORD ?? "fishnet2026";
  return typeof pwd === "string" && pwd === expected;
}
