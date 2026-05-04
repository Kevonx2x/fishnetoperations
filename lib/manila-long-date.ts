const MANILA = "Asia/Manila";

/** e.g. "May 8, 2026" in Asia/Manila. */
export function manilaLongDateLabelFromInstant(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}
