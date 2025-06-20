import { useEffect, useState, useRef } from "react";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import axios from "axios";

// Background task name
const TASK_NAME = "background-location-task";

// Define the background location task
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const { coords } = await Location.getCurrentPositionAsync({});
    const token = await SecureStore.getItemAsync("auth_token_cab");

    if (token && coords) {
      await axios.post(
        "http://192.168.1.6:3100/webhook/cab-receive-location",
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("📍 Background location sent:", coords);
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("❌ Background Location Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function useLocationTracking() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const locationSubscription = useRef(null);

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      console.error("❌ Permission to access location was denied");
      return;
    }

    // Get immediate current location once
    const location = await Location.getCurrentPositionAsync({});
    setCurrentLocation(location.coords);

    // Start watching live location
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 40000, // 10 seconds
        distanceInterval: 5, // 5 meters
      },
      (loc) => {
        if (loc?.coords) {
          setCurrentLocation(loc.coords);
        }
      }
    );

    // Start background updates
    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 20000,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Cab Tracking Active",
        notificationBody: "Your location is being tracked",
      },
    });

    console.log("✅ Location tracking started");
  };

  const stopLocationTracking = async () => {
    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      await Location.stopLocationUpdatesAsync(TASK_NAME);
      console.log("🛑 Location tracking stopped");
    } catch (error) {
      console.error("❌ Error stopping location tracking:", error);
    }
  };

  return {
    currentLocation, // live coords (can be used in UI)
    startLocationTracking,
    stopLocationTracking,
  };
}
