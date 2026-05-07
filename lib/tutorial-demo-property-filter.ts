/**
 * PostgREST `or` fragment for public / client-visible property discovery.
 * Rows with `is_demo = true` are tutorial seed data and stay off the marketplace.
 */
export function hideTutorialDemoPropertiesOrFilter(): string {
  return "is_demo.is.null,is_demo.eq.false";
}
