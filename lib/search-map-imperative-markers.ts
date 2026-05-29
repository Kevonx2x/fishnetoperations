import type { Marker } from "@googlemaps/markerclusterer";

import {
  SEARCH_MAP_PIN_SVG,
  SEARCH_MAP_SAGE,
  SEARCH_MAP_SAGE_BORDER,
  type SearchMapMarker,
} from "@/lib/search-map-markers";

/** Imperative property pin for MarkerClusterer — not a React child. */
export function createSearchMapPropertyMarker(
  data: SearchMapMarker,
  useAdvancedMarker: boolean,
): Marker {
  const position = { lat: data.lat, lng: data.lng };

  if (useAdvancedMarker && google.maps.marker) {
    const pin = new google.maps.marker.PinElement({
      background: SEARCH_MAP_SAGE,
      borderColor: SEARCH_MAP_SAGE_BORDER,
      glyphColor: "#ffffff",
      scale: 0.92,
    });

    return new google.maps.marker.AdvancedMarkerElement({
      position,
      title: data.title,
      content: pin.element,
      gmpClickable: false,
    });
  }

  return new google.maps.Marker({
    position,
    title: data.title,
    clickable: false,
    icon: {
      url: `data:image/svg+xml;charset=UTF-8,${SEARCH_MAP_PIN_SVG}`,
      scaledSize: new google.maps.Size(32, 41),
      anchor: new google.maps.Point(16, 41),
    },
  });
}
