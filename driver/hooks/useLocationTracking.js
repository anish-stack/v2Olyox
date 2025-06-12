import * as Location from "expo-location"
import * as SecureStore from "expo-secure-store"
import axios from "axios"

export default function useLocationTracking() {
  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== "granted") {
      console.error("Permission to access location was denied")
      return
    }

    Location.startLocationUpdatesAsync("background-location-task", {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 20000,
      distanceInterval: 0,
    })
  }

  const stopLocationTracking = () => {
    Location.stopLocationUpdatesAsync("background-location-task")
  }

  return { startLocationTracking, stopLocationTracking }
}

// Define the background task
import * as TaskManager from "expo-task-manager"
import * as BackgroundFetch from "expo-background-fetch"

TaskManager.defineTask("background-location-task", async () => {
  try {
    const { coords } = await Location.getCurrentPositionAsync({})
    const token = await SecureStore.getItemAsync("auth_token_cab")

    if (token) {
      await axios.post(
        "https://appapi.olyox.com/webhook/cab-receive-location",
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      console.log("Location sent in background:", coords)
    }

    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch (error) {
    console.error("Background Location Error:", error)
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

