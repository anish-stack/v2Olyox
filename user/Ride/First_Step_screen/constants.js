import { Dimensions } from "react-native"

const { width, height } = Dimensions.get("window")
const ASPECT_RATIO = width / height
export const LATITUDE_DELTA = 0.0092
export const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO
export const CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes
export const GOOGLE_MAPS_APIKEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8"

// India region boundaries
export const INDIA_REGION = {
  minLat: 6.7559, // Southern tip
  maxLat: 35.6745, // Northern tip
  minLng: 68.1629, // Western edge
  maxLng: 97.3953, // Eastern edge
  center: {
    latitude: 22.9734,
    longitude: 78.6569,
  },
}

// Custom map style to emphasize roads
export const mapStyle = [
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [
      {
        color: "#ffffff",
      },
    ],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [
      {
        color: "#000000",
      },
    ],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [
      {
        color: "#fdfcf8",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [
      {
        color: "#f8c967",
      },
    ],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [
      {
        color: "#e9bc62",
      },
    ],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [
      {
        color: "#b9d3e6",
      },
    ],
  },
]
