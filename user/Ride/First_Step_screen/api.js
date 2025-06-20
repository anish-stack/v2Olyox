import axios from "axios"
import PolylineDecoder from "@mapbox/polyline"
import { find_me } from "../../utils/helpers"
import { tokenCache } from "../../Auth/cache"

// Fetch current location address from coordinates
export const fetchCurrentLocationAddress = async (latitude, longitude) => {
  try {
    const response = await axios.post("https://api.srtutorsbureau.com/Fetch-Current-Location", {
      lat: latitude,
      lng: longitude,
    })

    return response?.data?.data?.address?.completeAddress || ""
  } catch (error) {
    console.error("Error fetching address:", error)
    throw new Error("Failed to fetch address")
  }
}

// Fetch coordinates from location description
export const fetchLocationCoordinates = async (location) => {
  try {
    const endpoint = `https://api.srtutorsbureau.com/geocode?address=${encodeURIComponent(location)}`
    const response = await axios.get(endpoint)

    return {
      latitude: response.data.latitude,
      longitude: response.data.longitude,
    }
  } catch (error) {
    console.error("Error fetching coordinates:", error)
    throw new Error("Failed to fetch coordinates")
  }
}

// Fetch past rides data
export const fetchPastRidesData = async () => {
  try {
    await find_me()

    const gmail_token = await tokenCache.getToken("auth_token")
    const db_token = await tokenCache.getToken("auth_token_db")
    const token = db_token || gmail_token

    const response = await axios.get("http://192.168.1.6:3100/api/v1/user/find-Orders-details", {
      headers: { Authorization: `Bearer ${token}` },
    })

    return response.data?.data?.RideData || []
  } catch (error) {
    console.error("Error fetching past rides:", error)
    throw new Error("Failed to fetch past rides")
  }
}

// Fetch directions polyline
export const fetchDirectionsPolyline = async (pickup, dropoff) => {
  try {
    const response = await axios.post("http://192.168.1.6:3100/directions", {
      pickup: {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
      },
      dropoff: {
        latitude: dropoff.latitude,
        longitude: dropoff.longitude,
      },
    })

    const json = response.data

    let polylineCoordinates = []
    if (json?.polyline) {
      polylineCoordinates = PolylineDecoder.decode(json.polyline).map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }))
    }

    return {
      polylineCoordinates,
      distanceValue: json?.distance || null,
      durationValue: json?.duration || null,
    }
  } catch (error) {
    console.error("Error fetching directions:", error.response.data)
    throw new Error("Failed to fetch directions")
  }
}
