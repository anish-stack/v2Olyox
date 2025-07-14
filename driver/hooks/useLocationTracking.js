import { useEffect, useState, useRef, useCallback } from "react";
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

// Configuration constants
const CONFIG = {
  DISTANCE_THRESHOLD: 20,       // meters - triggers updates with minimal movement
  TIME_THRESHOLD: 10 * 1000,    // 10 seconds - checks more frequently
  DEBOUNCE_DELAY: 1000,         // 1 second - quicker response to changes
  API_TIMEOUT: 10000,           // 10 seconds - faster failover if API hangs
  MAX_RETRY_ATTEMPTS: 2,        // Retry less to fail faster
  RETRY_DELAY: 1000             // 1 second between retries
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

  return R * c;
};

// Check if location should be sent based on distance and time thresholds
const shouldSendLocation = async (newCoords) => {
  try {
    const lastLocationData = await AsyncStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
    if (!lastLocationData) return true;

    const lastLocation = JSON.parse(lastLocationData);
    const distance = calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      newCoords.latitude,
      newCoords.longitude
    );

    const timeDiff = Date.now() - lastLocation.timestamp;
    return distance > CONFIG.DISTANCE_THRESHOLD || timeDiff > CONFIG.TIME_THRESHOLD;
  } catch (error) {
    console.error("Error checking location threshold:", error);
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
      history = history.slice(-10);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.LOCATION_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving location to storage:", error);
  }
};

// Retry mechanism for API calls
const retryApiCall = async (apiCall, maxRetries = CONFIG.MAX_RETRY_ATTEMPTS) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      console.error(`API call attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
    }
  }
};

// Define the background location task
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  try {
    if (error) {
      console.error("Background task error:", error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (data?.locations?.length > 0) {
      const location = data.locations[data.locations.length - 1];

      const shouldSend = await shouldSendLocation(location.coords);
      if (!shouldSend) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const token = await SecureStore.getItemAsync("auth_token_cab");
      if (!token) {
        console.error("No auth token found");
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }

      await retryApiCall(async () => {
        const response = await axios.post(
          "https://www.appv2.olyox.com/webhook/cab-receive-location",
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: CONFIG.API_TIMEOUT,
          }
        );

        if (response.status === 200) {
          await saveLocationToStorage(location.coords);
        }

        return response;
      });

      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("Background Location Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function useLocationTracking() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [lastSentLocation, setLastSentLocation] = useState(null);

  const locationSubscription = useRef(null);
  const isBackgroundTaskInitialized = useRef(false);
  const initializationInProgress = useRef(false);

  // Debounced function to send location to server
  const sendLocationToServer = useCallback(
    debounce(async (coords) => {
      try {
        const shouldSend = await shouldSendLocation(coords);
        console.log("shouldSend",shouldSend)

        const token = await SecureStore.getItemAsync("auth_token_cab");
        if (!token) {
          console.error("No auth token found");
          return;
        }
        console.log(" api hits")
        await retryApiCall(async () => {
          const response = await axios.post(
            "https://www.appv2.olyox.com/webhook/cab-receive-location",
            {
              latitude: coords.latitude,
              longitude: coords.longitude,
              timestamp: Date.now(),
            },
            {
              headers: { Authorization: `Bearer ${token}` },
              timeout: CONFIG.API_TIMEOUT,
            }
          );

          if (response.status === 200) {
            await saveLocationToStorage(coords);
            setLastSentLocation(coords);
          }

          return response;
        });
      } catch (error) {
        console.error("Error sending foreground location:", error.message);
      }
    }, CONFIG.DEBOUNCE_DELAY),
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
      }
    } catch (error) {
      console.error("Error loading last location:", error);
    }
  }, []);

  // Get location history from storage
  const getLocationHistory = useCallback(async () => {
    try {
      const historyData = await AsyncStorage.getItem(STORAGE_KEYS.LOCATION_HISTORY);
      return historyData ? JSON.parse(historyData) : [];
    } catch (error) {
      console.error("Error getting location history:", error);
      return [];
    }
  }, []);

  // Clear location data from storage
  const clearLocationData = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEYS.LAST_LOCATION, STORAGE_KEYS.LOCATION_HISTORY]);
      setLastSentLocation(null);
    } catch (error) {
      console.error("Error clearing location data:", error);
    }
  }, []);

  // Setup background location tracking
  const setupBackgroundLocationTracking = useCallback(async () => {
    if (isBackgroundTaskInitialized.current) {
      return true;
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000,
        distanceInterval: 5,
        deferredUpdatesInterval: 15000,
        deferredUpdatesDistance: 5,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "🚗 Cab Tracking Active",
          notificationBody: "Your location is being tracked for safety",
          notificationColor: "#FF6B6B",
        },
      });

      isBackgroundTaskInitialized.current = true;
      return true;
    } catch (error) {
      console.error("Error setting up background location:", error);
      return false;
    }
  }, []);

  // Get location with fallback mechanisms
  const getCurrentLocationWithFallback = useCallback(async () => {
    try {
      // 1. Request foreground permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        throw new Error('Location permission not granted');
      }

      // 2. Try getting current location with varying accuracy
      const locationOptions = [
        { accuracy: Location.Accuracy.High, maximumAge: 10000 },
        { accuracy: Location.Accuracy.Balanced, maximumAge: 30000 },
        { accuracy: Location.Accuracy.Low, maximumAge: 60000 },
      ];

      for (const options of locationOptions) {
        try {
          const location = await Location.getCurrentPositionAsync(options);
          if (location?.coords) {
            return location;
          }
        } catch (error) {
          console.warn(`❌ Location attempt failed (accuracy: ${options.accuracy}):`, error.message);
        }
      }

      // 3. Last known location fallback
      try {
        const lastLocation = await Location.getLastKnownPositionAsync({
          maxAge: 300000, // 5 minutes
        });
        if (lastLocation?.coords) {
          console.warn('✅ Using last known location as fallback', lastLocation);
          return lastLocation;
        }
      } catch (error) {
        console.warn('❌ Failed to get last known location:', error.message);
      }

      // 4. If all fails
      throw new Error('Unable to retrieve location');

    } catch (err) {
      console.error('📍 Location error:', err.message);
      throw err;
    }
  }, []);

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    console.log("I am Start Tracking",isTracking,initializationInProgress.current)
    if (isTracking || initializationInProgress.current) {
      return;
    }

    initializationInProgress.current = true;
    setError(null);

    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        throw new Error("Foreground location permission denied");
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.warn("Background location permission denied");
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        throw new Error("Location services are disabled. Please enable location services in device settings.");
      }

      // Get current location with fallback
      const location = await getCurrentLocationWithFallback();
      setCurrentLocation(location.coords);

      // Send initial location
      await sendLocationToServer(location.coords);

      // Start watching foreground location changes
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 10,
        },
        (loc) => {
          if (loc?.coords) {
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
    } catch (error) {
      console.error("Error starting location tracking:", error);
      setError(error.message);
    } finally {
      initializationInProgress.current = false;
    }
  }, [isTracking, sendLocationToServer, setupBackgroundLocationTracking, getCurrentLocationWithFallback]);

  // Stop location tracking
  const stopLocationTracking = useCallback(async () => {
    try {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
      }

      setIsTracking(false);
      setCurrentLocation(null);
      setError(null);
      isBackgroundTaskInitialized.current = false;
    } catch (error) {
      console.error("Error stopping location tracking:", error);
      setError(error.message);
    }
  }, []);

  // Initialize tracking on mount
  useEffect(() => {
    loadLastSentLocation();

    if (!isTracking && !initializationInProgress.current) {
      startLocationTracking();
    }

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []); // Empty dependency array to prevent re-renders

  return {
    currentLocation,
    isTracking,
    error,
    lastSentLocation,
    startLocationTracking,
    stopLocationTracking,
    getLocationHistory,
    clearLocationData,
  };
}