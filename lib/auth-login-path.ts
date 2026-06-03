/** Standard logged-out auth CTA label app-wide. */
export const AUTH_SIGN_IN_CTA_LABEL = "Sign in / Create account";

/** Build `/auth/login` with a safe return path. */
export function authLoginHref(nextPath: string): string {
  const path = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `/auth/login?next=${encodeURIComponent(path)}`;
}

export function isSafeAuthNext(next: string | null | undefined): next is string {
  return Boolean(next && next.startsWith("/") && !next.startsWith("//"));
}

/** Dormspaces portal sign-in entry with return path (avoids BahayGo `/auth/login` from landlord flows). */
export function dormspacesWelcomeAuthHref(nextPath: string): string {
  const path = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `/dormspaces/welcome?next=${encodeURIComponent(path)}`;
}
