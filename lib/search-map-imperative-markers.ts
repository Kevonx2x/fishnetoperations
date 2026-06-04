import { MarkerUtils, type Marker } from "@googlemaps/markerclusterer";

import {
  SEARCH_MAP_GOLD,
  SEARCH_MAP_PIN_SVG,
  SEARCH_MAP_SAGE,
  SEARCH_MAP_SAGE_BORDER,
  SEARCH_MAP_SELECTED_PIN_SVG,
  type SearchMapProperty,
} from "@/lib/search-map-markers";

export type SearchMapGeoPin = {
  lat: number;
  lng: number;
  title: string;
};

function createAdvancedPin(selected: boolean): google.maps.marker.PinElement {
  return new google.maps.marker.PinElement({
    background: SEARCH_MAP_SAGE,
    borderColor: selected ? SEARCH_MAP_GOLD : SEARCH_MAP_SAGE_BORDER,
    glyphColor: "#ffffff",
    scale: selected ? 1.08 : 0.92,
  });
}

function createClassicIcon(selected: boolean): google.maps.Icon {
  const width = selected ? 36 : 32;
  const height = selected ? 46 : 41;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${selected ? SEARCH_MAP_SELECTED_PIN_SVG : SEARCH_MAP_PIN_SVG}`,
    scaledSize: new google.maps.Size(width, height),
    anchor: new google.maps.Point(width / 2, height),
  };
}

/** Imperative map pin for MarkerClusterer — not a React child. */
export function createSearchMapGeoMarker(
  data: SearchMapGeoPin,
  options: {
    useAdvancedMarker: boolean;
    selected: boolean;
  },
): Marker {
  const position = { lat: data.lat, lng: data.lng };

  if (options.useAdvancedMarker && google.maps.marker) {
    const pin = createAdvancedPin(options.selected);

    return new google.maps.marker.AdvancedMarkerElement({
      position,
      title: data.title,
      content: pin.element,
      gmpClickable: true,
    });
  }

  return new google.maps.Marker({
    position,
    title: data.title,
    clickable: true,
    icon: createClassicIcon(options.selected),
  });
}

/** @deprecated Alias — BahayGo /search property pins. */
export function createSearchMapPropertyMarker(
  data: SearchMapProperty,
  options: {
    useAdvancedMarker: boolean;
    selected: boolean;
  },
): Marker {
  return createSearchMapGeoMarker(
    { lat: data.lat, lng: data.lng, title: data.title },
    options,
  );
}

export function updateSearchMapPropertyMarkerAppearance(
  marker: Marker,
  options: {
    useAdvancedMarker: boolean;
    selected: boolean;
    title: string;
  },
): void {
  if (options.useAdvancedMarker && MarkerUtils.isAdvancedMarker(marker)) {
    marker.content = createAdvancedPin(options.selected).element;
    marker.title = options.title;
    return;
  }

  if (!MarkerUtils.isAdvancedMarker(marker)) {
    marker.setIcon(createClassicIcon(options.selected));
    marker.setTitle(options.title);
  }
}

export function attachSearchMapPropertyMarkerClickListener(
  marker: Marker,
  propertyId: string,
  onClick: (propertyId: string) => void,
): google.maps.MapsEventListener {
  const eventName =
    MarkerUtils.isAdvancedMarker(marker) ? "gmp-click" : "click";

  return marker.addListener(eventName, () => {
    onClick(propertyId);
  });
}
