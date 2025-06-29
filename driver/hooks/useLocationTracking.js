import { useEffect, useState, useRef } from "react";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import axios from "axios";

// Background task name
const TASK_NAME = "background-location-task";

// Define the background location task
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  try {
    if (error) {
      console.error("❌ Background task error:", error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (data) {
      const { locations } = data;
      const token = await SecureStore.getItemAsync("auth_token_cab");

      if (token && locations && locations.length > 0) {
        // Use the most recent location
        const location = locations[locations.length - 1];
        
        await axios.post(
          "https://www.appv2.olyox.com/webhook/cab-receive-location",
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000, // 10 second timeout
          }
        );
        
        console.log("📍 Background location sent:", location.coords);
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("❌ Background Location Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function useLocationTracking() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const locationSubscription = useRef(null);
  const sendLocationInterval = useRef(null);

  // Function to send location to server (for foreground)
  const sendLocationToServer = async (coords) => {
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab");
      
      if (token && coords) {
        await axios.post(
          "https://www.appv2.olyox.com/webhook/cab-receive-location",
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            timestamp: Date.now(),
          },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          }
        );
        console.log("📍 Foreground location sent:", coords);
      }
    } catch (error) {
      console.error("❌ Error sending location:", error);
    }
  };

  const startLocationTracking = async () => {
    try {
      setError(null);
      
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        setError("Foreground location permission denied");
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.warn("⚠️ Background location permission denied - background tracking won't work");
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setError("Location services are disabled");
        return;
      }

      // Get immediate current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location.coords);
      
      // Send initial location
      await sendLocationToServer(location.coords);

      // Start watching live location for foreground updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 10, // 10 meters
        },
        async (loc) => {
          if (loc?.coords) {
            setCurrentLocation(loc.coords);
            // Send location to server in foreground
            await sendLocationToServer(loc.coords);
          }
        }
      );

      // Start background location updates (only if background permission granted)
      if (backgroundStatus === "granted") {
        // Check if task is already registered
        const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000, // 1 minute for background
            distanceInterval: 20, // 20 meters
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: "Cab Tracking Active",
              notificationBody: "Your location is being tracked for safety",
              notificationColor: "#FF6B6B",
            },
          });
          console.log("✅ Background location tracking started");
        }
      }

      setIsTracking(true);
      console.log("✅ Location tracking started");
    } catch (error) {
      console.error("❌ Error starting location tracking:", error);
      setError(error.message);
    }
  };

  const stopLocationTracking = async () => {
    try {
      // Stop foreground location watching
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      // Clear any intervals
      if (sendLocationInterval.current) {
        clearInterval(sendLocationInterval.current);
        sendLocationInterval.current = null;
      }

      // Stop background location updates
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(TASK_NAME);
          console.log("🛑 Background location tracking stopped");
        }
      } catch (bgError) {
        console.warn("⚠️ Error stopping background location:", bgError);
      }

      setIsTracking(false);
      setCurrentLocation(null);
      setError(null);
      console.log("🛑 Location tracking stopped");
    } catch (error) {
      console.error("❌ Error stopping location tracking:", error);
      setError(error.message);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (sendLocationInterval.current) {
        clearInterval(sendLocationInterval.current);
      }
    };
  }, []);

  // Check if background task is registered on mount
  useEffect(() => {
    const checkTaskStatus = async () => {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) {
        setIsTracking(true);
      }
    };
    checkTaskStatus();
  }, []);

  return {
    currentLocation, // live coords (can be used in UI)
    isTracking, // boolean to show if tracking is active
    error, // any error that occurred
    startLocationTracking,
    stopLocationTracking,
  };
}