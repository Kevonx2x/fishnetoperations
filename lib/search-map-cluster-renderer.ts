import type { Cluster } from "@googlemaps/markerclusterer";
import { ClusterStats, MarkerUtils, type Marker } from "@googlemaps/markerclusterer";

import { SEARCH_MAP_SAGE, SEARCH_MAP_SAGE_BORDER } from "@/lib/search-map-markers";

function clusterBubbleDiameter(count: number): number {
  if (count < 10) return 44;
  if (count < 100) return 50;
  return 56;
}

function clusterBubbleFontSize(count: number): number {
  if (count < 10) return 15;
  if (count < 100) return 14;
  return 13;
}

function clusterBubbleSvg(count: number, diameter: number, fontSize: number): string {
  const shadowId = `cluster-shadow-${count}-${diameter}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 48 48">
  <defs>
    <filter id="${shadowId}" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(44,44,44,0.28)"/>
    </filter>
  </defs>
  <circle cx="24" cy="24" r="22" fill="${SEARCH_MAP_SAGE}" stroke="${SEARCH_MAP_SAGE_BORDER}" stroke-width="2" filter="url(#${shadowId})"/>
  <circle cx="24" cy="24" r="18.5" fill="none" stroke="#ffffff" stroke-width="3.5"/>
  <text x="24" y="24.5" fill="#ffffff" text-anchor="middle" dominant-baseline="central" font-family="Inter,system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="600">${count}</text>
</svg>`;
}

function createClusterBubbleElement(svg: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 120ms ease;transform-origin:center center;touch-action:manipulation;";

  const parser = new DOMParser();
  const svgEl = parser.parseFromString(svg, "image/svg+xml").documentElement;
  wrapper.appendChild(svgEl);

  const resetScale = () => {
    wrapper.style.transform = "scale(1)";
  };

  wrapper.addEventListener("pointerdown", () => {
    wrapper.style.transform = "scale(1.05)";
  });
  wrapper.addEventListener("pointerup", resetScale);
  wrapper.addEventListener("pointerleave", resetScale);
  wrapper.addEventListener("pointercancel", resetScale);

  return wrapper;
}

/** Sage cluster count badges — visually distinct from teardrop property pins. */
export function createSearchMapClusterRenderer(): {
  render: (cluster: Cluster, stats: ClusterStats, map: google.maps.Map) => Marker;
} {
  return {
    render({ count, position }, _stats, map) {
      const diameter = clusterBubbleDiameter(count);
      const fontSize = clusterBubbleFontSize(count);
      const svg = clusterBubbleSvg(count, diameter, fontSize);
      const title = `Cluster of ${count} properties`;
      const zIndex = Number(google.maps.Marker.MAX_ZINDEX) + count;

      if (MarkerUtils.isAdvancedMarkerAvailable(map)) {
        return new google.maps.marker.AdvancedMarkerElement({
          position,
          zIndex,
          title,
          content: createClusterBubbleElement(svg),
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
