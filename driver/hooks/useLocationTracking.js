import { useEffect, useState, useRef, useCallback } from "react";
import { AppState, Platform } from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { debounce } from "lodash";

// Background task name
const TASK_NAME = "background-location-task";

// Storage keys
const STORAGE_KEYS = {
  LAST_LOCATION: "last_sent_location",
  LOCATION_HISTORY: "location_history",
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Check if location should be sent based on distance and time thresholds
const shouldSendLocation = async (newCoords) => {
  try {
    const lastLocationData = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
    if (!lastLocationData) {
      console.log("📍 No previous location found - sending location");
      return true;
    }

    const lastLocation = JSON.parse(lastLocationData);
    const distance = calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      newCoords.latitude,
      newCoords.longitude
    );

    console.log(`📏 Distance from last location: ${distance.toFixed(2)}m`);

    // Send if distance > 100 meters or > 2 minutes have passed
    const timeDiff = Date.now() - lastLocation.timestamp;
    const fiveMinutes = 2 * 60 * 1000;

    const shouldSend = distance > 100 || timeDiff > fiveMinutes;

    if (!shouldSend) {
      console.log(
        `⏭️ Skipping location update - distance: ${distance.toFixed(2)}m, time: ${Math.round(
          timeDiff / 1000
        )}s`
      );
    }

    return shouldSend;
  } catch (error) {
    console.error("❌ Error checking location threshold:", error);
    return true; // Send on error to be safe
  }
};

// Save location to AsyncStorage
const saveLocationToStorage = async (coords) => {
  try {
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify(locationData));

    // Save to history (keep last 10 locations)
    const historyData = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_HISTORY);
    let history = historyData ? JSON.parse(historyData) : [];

    history.push(locationData);
    if (history.length > 10) {
      history = history.slice(-10); // Keep only last 10
    }

    await AsyncStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(history));
    console.log("💾 Location saved to AsyncStorage");
  } catch (error) {
    console.error("❌ Error saving location to storage:", error);
  }
};

// Define the background location task
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  const timestamp = new Date().toISOString();

  try {
    console.log(`🔄 [${timestamp}] Background task executing...`);

    if (error) {
      console.error(`❌ [${timestamp}] Background task error:`, error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (data) {
      const { locations } = data;
      console.log(`📍 [${timestamp}] Background task received locations:`, locations?.length);

      if (locations && locations.length > 0) {
        // Use the most recent location
        const location = locations[locations.length - 1];
        console.log(`📍 [${timestamp}] Latest location:`, JSON.stringify(location.coords, null, 2));

        // Check if we should send this location
        const shouldSend = await shouldSendLocation(location.coords);

        if (!shouldSend) {
          console.log(`⏭️ [${timestamp}] Skipping background location - within threshold`);
          return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const token = await SecureStore.getItemAsync("auth_token_cab");
        console.log(`🔑 [${timestamp}] Token exists:`, !!token);

        if (token) {
          console.log(`📤 [${timestamp}] Sending background location to server...`);
          console.log(`📤 [${timestamp}] Location data:`, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          });

          try {
            const response = await axios.post(
              "https://www.appv2.olyox.com/webhook/cab-receive-location",
              {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp,
              },
              {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000,
              }
            );

            console.log(`✅ [${timestamp}] Background location sent successfully:`, response.status);
            console.log(`✅ [${timestamp}] Server response:`, response.data);

            // Save location after successful send
            await saveLocationToStorage(location.coords);
          } catch (apiError) {
            console.error(`❌ [${timestamp}] API Error in background:`, apiError.message);
            console.error(`❌ [${timestamp}] API Error details:`, {
              status: apiError.response?.status,
              data: apiError.response?.data,
              url: apiError.config?.url,
            });
          }
        } else {
          console.log(`⚠️ [${timestamp}] Missing token`);
        }
      } else {
        console.log(`⚠️ [${timestamp}] No locations received`);
      }
    } else {
      console.log(`⚠️ [${timestamp}] No data received in background task`);
    }

    console.log(`✅ [${timestamp}] Background task completed successfully`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error(`❌ [${timestamp}] Background Location Error:`, error);
    console.error(`❌ [${timestamp}] Error stack:`, error.stack);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function useLocationTracking() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState("unknown");
  const [lastSentLocation, setLastSentLocation] = useState(null);

  const locationSubscription = useRef(null);
  const appStateSubscription = useRef(null);
  const isBackgroundTaskInitialized = useRef(false);

  // Debounced function to send location to server
  const sendLocationToServer = useCallback(
    debounce(async (coords) => {
      try {
        const shouldSend = await shouldSendLocation(coords);
        if (!shouldSend) return;

        const token = await SecureStore.getItemAsync("auth_token_cab");
        if (!token) {
          console.log("⚠️ No auth token found");
          return;
        }

        const response = await axios.post(
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

        console.log("📍 Foreground location sent successfully:", response.status);
        await saveLocationToStorage(coords);
        setLastSentLocation(coords);
      } catch (error) {
        console.error("❌ Error sending foreground location:", error.message);
      }
    }, 5000),
    []
  );

  // Load last sent location from storage
  const loadLastSentLocation = useCallback(async () => {
    try {
      const lastLocationData = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
      if (lastLocationData) {
        const lastLocation = JSON.parse(lastLocationData);
        setLastSentLocation({
          latitude: lastLocation.latitude,
          longitude: lastLocation.longitude,
        });
        console.log("📍 Loaded last sent location from storage:", lastLocation);
      }
    } catch (error) {
      console.error("❌ Error loading last location:", error);
    }
  }, []);

  // Get location history from storage
  const getLocationHistory = useCallback(async () => {
    try {
      const historyData = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_HISTORY);
      return historyData ? JSON.parse(historyData) : [];
    } catch (error) {
      console.error("❌ Error getting location history:", error);
      return [];
    }
  }, []);

  // Clear location data from storage
  const clearLocationData = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.LAST_LOCATION, STORAGE_KEYS.LOCATION_HISTORY]);
      setLastSentLocation(null);
      console.log("🗑️ Location data cleared from storage");
    } catch (error) {
      console.error("❌ Error clearing location data:", error);
    }
  }, []);

  // Check background task registration status
  const checkBackgroundTaskStatus = useCallback(async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      const taskOptions = isRegistered ? await TaskManager.getTaskOptionsAsync(TASK_NAME) : null;


      setBackgroundTaskStatus(isRegistered ? "registered" : "not-registered");
      return isRegistered;
    } catch (error) {
      console.error("❌ Error checking background task status:", error);
      setBackgroundTaskStatus("error");
      return false;
    }
  }, []);

  // Setup background location tracking
  const setupBackgroundLocationTracking = useCallback(async () => {
    if (isBackgroundTaskInitialized.current) {
      console.log("✅ Background task already initialized, skipping setup");
      return true;
    }

    try {
      console.log("🔧 Setting up background location tracking...");

      // Check current status
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) {
        const taskOptions = await TaskManager.getTaskOptionsAsync(TASK_NAME);
        const expectedOptions = {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 5,
          deferredUpdatesInterval: 15000,
          deferredUpdatesDistance: 5,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: "🚗 Cab Tracking Active",
            notificationBody: "Your location is being tracked for safety - Tap to open app",
            notificationColor: "#FF6B6B",
          },
        };

        if (JSON.stringify(taskOptions) === JSON.stringify(expectedOptions)) {
          console.log("✅ Background task already configured correctly");
          isBackgroundTaskInitialized.current = true;
          setBackgroundTaskStatus("registered");
          return true;
        }

        console.log("🛑 Stopping existing background task due to configuration mismatch...");
        try {
          await Location.stopLocationUpdatesAsync(TASK_NAME);
        } catch (error) {
          console.warn("⚠️ Error stopping existing background task:", error);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Start fresh background location updates
      console.log("🚀 Starting fresh background location updates...");
      await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 5,
        deferredUpdatesInterval: 15000,
        deferredUpdatesDistance: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "🚗 Cab Tracking Active",
          notificationBody: "Your location is being tracked for safety - Tap to open app",
          notificationColor: "#FF6B6B",
        },
      });

      isBackgroundTaskInitialized.current = true;
      const finalStatus = await checkBackgroundTaskStatus();
      console.log("✅ Background location tracking setup complete. Registered:", finalStatus);
      return finalStatus;
    } catch (error) {
      console.error("❌ Error setting up background location:", error);
      setBackgroundTaskStatus("error");
      isBackgroundTaskInitialized.current = false;
      return false;
    }
  }, [checkBackgroundTaskStatus]);

  // Test background task manually (for debugging)
  const testBackgroundTask = useCallback(async () => {
    try {
      console.log("🧪 Testing background task manually...");

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const result = await TaskManager.getRegisteredTasksAsync();
      console.log("🧪 Registered tasks:", result);

      const mockData = {
        data: { locations: [location] },
        error: null,
      };

      console.log("🧪 Simulating background task with data:", mockData);
    } catch (error) {
      console.error("❌ Error testing background task:", error);
    }
  }, []);

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    if (isTracking) {
      console.log("✅ Location tracking already active, skipping...");
      return;
    }

    try {
      console.log("🔄 Starting location tracking...");
      console.log("📱 Platform:", Platform.OS);
      setError(null);

      // Load last sent location
      await loadLastSentLocation();

      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      console.log("📍 Foreground permission status:", foregroundStatus);
      if (foregroundStatus !== "granted") {
        setError("Foreground location permission denied");
        return;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log("📦 Background permission status:", backgroundStatus);
      if (backgroundStatus !== "granted") {
        console.warn("⚠️ Background location permission denied");
        setError("Background location permission needed for continuous tracking");
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      console.log("📶 Location services enabled:", enabled);
      if (!enabled) {
        setError("Location services are disabled");
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 10000,
      });
      console.log("📍 Current location fetched:", location.coords);
      setCurrentLocation(location.coords);

      // Send initial location
      await sendLocationToServer(location.coords);

      // Start watching foreground location changes
      console.log("👀 Starting foreground location watching...");
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000,
          distanceInterval: 10,
        },
        (loc) => {
          if (loc?.coords) {
            console.log("📍 Foreground location update:", loc.coords);
            setCurrentLocation(loc.coords);
            sendLocationToServer(loc.coords);
          }
        }
      );

      // Setup background tracking if permission granted
      if (backgroundStatus === "granted") {
        await setupBackgroundLocationTracking();
      }

      setIsTracking(true);
      console.log("✅ Location tracking started successfully");
    } catch (error) {
      console.error("❌ Error starting location tracking:", error);
      setError(error.message);
    }
  }, [isTracking, sendLocationToServer, setupBackgroundLocationTracking, loadLastSentLocation]);

  // Stop location tracking
  const stopLocationTracking = useCallback(async () => {
    try {
      console.log("🛑 Stopping location tracking...");

      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) {
        try {
          await Location.stopLocationUpdatesAsync(TASK_NAME);
          console.log("🛑 Background location tracking stopped");
        } catch (bgError) {
          console.warn("⚠️ Error stopping background location:", bgError);
        }
      }

      setIsTracking(false);
      setCurrentLocation(null);
      setError(null);
      setBackgroundTaskStatus("stopped");
      isBackgroundTaskInitialized.current = false;
      console.log("✅ Location tracking stopped successfully");
    } catch (error) {
      console.error("❌ Error stopping location tracking:", error);
      setError(error.message);
    }
  }, []);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log("📱 App state changed from", appState, "to", nextAppState);

      if (appState.match(/inactive|background/) && nextAppState === "active") {
        console.log("🔄 App came to foreground - checking location tracking");
        checkBackgroundTaskStatus();
        if (!isTracking) {
          startLocationTracking();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        console.log("📱 App went to background - background tracking should continue");
        checkBackgroundTaskStatus();
      }

      setAppState(nextAppState);
    };

    appStateSubscription.current = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
    };
  }, [appState, isTracking, startLocationTracking, checkBackgroundTaskStatus]);

  // Initialize tracking on mount
  useEffect(() => {
    if (!isTracking) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }
    };
  }, [isTracking, startLocationTracking]);

  // Check task status on mount
  useEffect(() => {
    checkBackgroundTaskStatus();
  }, [checkBackgroundTaskStatus]);

  return {
    currentLocation,
    isTracking,
    error,
    appState,
    backgroundTaskStatus,
    lastSentLocation,
    startLocationTracking,
    stopLocationTracking,
    testBackgroundTask,
    checkBackgroundTaskStatus,
    getLocationHistory,
    clearLocationData,
  };
}