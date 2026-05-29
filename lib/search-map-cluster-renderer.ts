import type { Cluster } from "@googlemaps/markerclusterer";
import { ClusterStats, MarkerUtils, type Marker } from "@googlemaps/markerclusterer";

import { SEARCH_MAP_SAGE, SEARCH_MAP_SAGE_BORDER } from "@/lib/search-map-markers";

function clusterBubbleDiameter(count: number): number {
  if (count < 10) return 44;
  if (count < 100) return 50;
  return 56;
}

function clusterBubbleFontSize(count: number): number {
  if (count < 10) return 14;
  if (count < 100) return 13;
  return 12;
}

/** Sage cluster bubbles with white count labels — BahayGo brand. */
export function createSearchMapClusterRenderer(): {
  render: (cluster: Cluster, stats: ClusterStats, map: google.maps.Map) => Marker;
} {
  return {
    render({ count, position }, _stats, map) {
      const diameter = clusterBubbleDiameter(count);
      const fontSize = clusterBubbleFontSize(count);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="22" fill="${SEARCH_MAP_SAGE}" stroke="${SEARCH_MAP_SAGE_BORDER}" stroke-width="2"/>
  <text x="24" y="24" fill="#ffffff" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="600">${count}</text>
</svg>`;
      const title = `Cluster of ${count} properties`;
      const zIndex = Number(google.maps.Marker.MAX_ZINDEX) + count;

      if (MarkerUtils.isAdvancedMarkerAvailable(map)) {
        const parser = new DOMParser();
        const svgEl = parser.parseFromString(svg, "image/svg+xml").documentElement;
        return new google.maps.marker.AdvancedMarkerElement({
          position,
          zIndex,
          title,
          content: svgEl,
        });
      }

      return new google.maps.Marker({
        position,
        zIndex,
        title,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
          scaledSize: new google.maps.Size(diameter, diameter),
          anchor: new google.maps.Point(diameter / 2, diameter / 2),
        },
      });
    },
  };
}
