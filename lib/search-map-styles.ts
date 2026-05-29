/** Custom map styling for /search only — de-emphasizes competing POIs, keeps useful context. */
export const SEARCH_MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }, { saturation: -15 }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi.school",
    elementType: "all",
    stylers: [{ visibility: "on" }, { saturation: -10 }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.medical",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.attraction",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ saturation: -18 }, { lightness: 4 }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ saturation: -25 }, { lightness: 8 }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ saturation: -12 }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ visibility: "on" }, { lightness: 100 }],
  },
];
