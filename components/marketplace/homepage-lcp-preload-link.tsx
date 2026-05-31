/** Head preload for mobile homepage LCP image — hoisted by Next.js App Router. */
export function HomepageLcpPreloadLink({ href }: { href: string }) {
  return <link rel="preload" as="image" href={href} fetchPriority="high" />;
}
