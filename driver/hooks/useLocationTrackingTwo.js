
"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import * as Location from "expo-location"

const LATITUDE_DELTA = 0.0922
const LONGITUDE_DELTA = 0.0421

export function useLocationTrackingTwo(socket, rideId, rideStarted) {
  const [currentLocation, setCurrentLocation] = useState(null)
  const locationWatchId = useRef(null)
  const locationTrackingStarted = useRef(false)

  const startLocationTracking = useCallback(async () => {
    if (locationTrackingStarted.current) return

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        console.error("Location permission denied")
        return
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      })

      const initialLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }

      setCurrentLocation(initialLocation)

      // Start watching position
      const watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 10, // update every 10 meters
          timeInterval: 5000, // or every 5 seconds
        },
        (newLocation) => {
          const updatedLocation = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          }

          setCurrentLocation(updatedLocation)

          // If ride started, emit location to socket
          if (rideStarted && socket && socket.connected) {
            socket.emit("driver_location_update", {
              rideId: rideId,
              location: updatedLocation,
            })
          }
        },
      )

      locationWatchId.current = watchId
      locationTrackingStarted.current = true
    } catch (error) {
      console.error("Error starting location tracking", error)
    }
  }, [socket, rideId, rideStarted])

  const stopLocationTracking = useCallback(() => {
    if (locationWatchId.current) {
      locationWatchId.current.remove()
      locationWatchId.current = null
      locationTrackingStarted.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      stopLocationTracking()
    }
  }, [stopLocationTracking])

  return {
    currentLocation,
    startLocationTracking,
    stopLocationTracking,
  }
}

