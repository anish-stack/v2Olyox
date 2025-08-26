import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Platform } from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

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
  RETRY_DELAY: 1000,            // 1 second between retries
  // Platform-specific configurations
  IOS_BACKGROUND_INTERVAL: 15000,    // iOS background update interval
  ANDROID_BACKGROUND_INTERVAL: 10000, // Android background update interval
  IOS_DISTANCE_FILTER: 5,            // iOS distance filter
  ANDROID_DISTANCE_FILTER: 10,       // Android distance filter
};

// JavaScript debounce implementation (replacing lodash)
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
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

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
    }
  }
};

// Get platform-specific location options
const getPlatformLocationOptions = () => {
  const isIOS = Platform.OS === 'ios';
  
  return {
    backgroundOptions: {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: isIOS ? CONFIG.IOS_BACKGROUND_INTERVAL : CONFIG.ANDROID_BACKGROUND_INTERVAL,
      distanceInterval: isIOS ? CONFIG.IOS_DISTANCE_FILTER : CONFIG.ANDROID_DISTANCE_FILTER,
      deferredUpdatesInterval: isIOS ? CONFIG.IOS_BACKGROUND_INTERVAL : CONFIG.ANDROID_BACKGROUND_INTERVAL,
      deferredUpdatesDistance: isIOS ? CONFIG.IOS_DISTANCE_FILTER : CONFIG.ANDROID_DISTANCE_FILTER,
      showsBackgroundLocationIndicator: isIOS,
      foregroundService: {
        notificationTitle: "🚗 Cab Tracking Active",
        notificationBody: "Your location is being tracked for safety",
        notificationColor: "#FF6B6B",
        ...(Platform.OS === 'android' && {
          killServiceOnDestroy: false,
        })
      },
    },
    foregroundOptions: {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000,
      distanceInterval: isIOS ? 10 : 15,
      maximumAge: 60000,
      enableHighAccuracy: true,
    }
  };
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
            platform: Platform.OS,
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
  const [permissionStatus, setPermissionStatus] = useState({
    foreground: null,
    background: null
  });

  const locationSubscription = useRef(null);
  const isBackgroundTaskInitialized = useRef(false);
  const initializationInProgress = useRef(false);
  const debouncedSendLocation = useRef(null);

  // Initialize debounced function
  useEffect(() => {
    debouncedSendLocation.current = debounce(async (coords) => {
      try {
        const shouldSend = await shouldSendLocation(coords);
        console.log("shouldSend", shouldSend);

        if (!shouldSend) {
          return;
        }

        const token = await SecureStore.getItemAsync("auth_token_cab");
        if (!token) {
          console.error("No auth token found");
          return;
        }

        console.log("API call initiated");
        await retryApiCall(async () => {
          const response = await axios.post(
            "https://www.appv2.olyox.com/webhook/cab-receive-location",
            {
              latitude: coords.latitude,
              longitude: coords.longitude,
              timestamp: Date.now(),
              platform: Platform.OS,
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
        setError(`Failed to send location: ${error.message}`);
      }
    }, CONFIG.DEBOUNCE_DELAY);
  }, []);

  // Send location to server
  const sendLocationToServer = useCallback((coords) => {
    if (debouncedSendLocation.current) {
      debouncedSendLocation.current(coords);
    }
  }, []);

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

  // Check and request permissions
  const checkAndRequestPermissions = useCallback(async () => {
    try {
      // Check foreground permission
      const foregroundStatus = await Location.getForegroundPermissionsAsync();
      let foregroundGranted = foregroundStatus.granted;

      if (!foregroundGranted) {
        const foregroundRequest = await Location.requestForegroundPermissionsAsync();
        foregroundGranted = foregroundRequest.granted;
      }

      // Check background permission
      const backgroundStatus = await Location.getBackgroundPermissionsAsync();
      let backgroundGranted = backgroundStatus.granted;

      if (!backgroundGranted && foregroundGranted) {
        // Only request background if foreground is granted
        const backgroundRequest = await Location.requestBackgroundPermissionsAsync();
        backgroundGranted = backgroundRequest.granted;
      }

      setPermissionStatus({
        foreground: foregroundGranted,
        background: backgroundGranted
      });

      return { foregroundGranted, backgroundGranted };
    } catch (error) {
      console.error("Error checking permissions:", error);
      return { foregroundGranted: false, backgroundGranted: false };
    }
  }, []);

  // Setup background location tracking
  const setupBackgroundLocationTracking = useCallback(async () => {
    if (isBackgroundTaskInitialized.current) {
      return true;
    }

    try {
      const { backgroundOptions } = getPlatformLocationOptions();
      
      const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await Location.startLocationUpdatesAsync(TASK_NAME, backgroundOptions);

      isBackgroundTaskInitialized.current = true;
      console.log(`Background location tracking started for ${Platform.OS}`);
      return true;
    } catch (error) {
      console.error("Error setting up background location:", error);
      return false;
    }
  }, []);

  // Get location with fallback mechanisms
  const getCurrentLocationWithFallback = useCallback(async () => {
    try {
      const { foregroundOptions } = getPlatformLocationOptions();
      
      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        throw new Error("Location services are disabled. Please enable location services in device settings.");
      }

      // Try getting current location with varying accuracy levels
      const locationOptions = [
        { 
          accuracy: Location.Accuracy.High, 
          maximumAge: 10000,
          timeout: 15000 
        },
        { 
          accuracy: Location.Accuracy.Balanced, 
          maximumAge: 30000,
          timeout: 10000 
        },
        { 
          accuracy: Location.Accuracy.Low, 
          maximumAge: 60000,
          timeout: 5000 
        },
      ];

      for (const options of locationOptions) {
        try {
          const location = await Location.getCurrentPositionAsync(options);
          if (location?.coords) {
            console.log(`✅ Location obtained with accuracy: ${options.accuracy}`);
            return location;
          }
        } catch (error) {
          console.warn(`❌ Location attempt failed (accuracy: ${options.accuracy}):`, error.message);
        }
      }

      // Fallback to last known location
      try {
        const lastLocation = await Location.getLastKnownPositionAsync({
          maxAge: 300000, // 5 minutes
        });
        if (lastLocation?.coords) {
          console.warn('✅ Using last known location as fallback');
          return lastLocation;
        }
      } catch (error) {
        console.warn('❌ Failed to get last known location:', error.message);
      }

      throw new Error('Unable to retrieve location from any source');

    } catch (err) {
      console.error('📍 Location error:', err.message);
      throw err;
    }
  }, []);

  // Start location tracking
  const startLocationTracking = useCallback(async () => {
    console.log("Starting location tracking...", { isTracking, initializationInProgress: initializationInProgress.current });
    
    if (isTracking || initializationInProgress.current) {
      return;
    }

    initializationInProgress.current = true;
    setError(null);

    try {
      // Check and request permissions
      const { foregroundGranted, backgroundGranted } = await checkAndRequestPermissions();
      
      if (!foregroundGranted) {
        throw new Error("Foreground location permission is required");
      }

      if (!backgroundGranted) {
        console.warn("Background location permission denied - tracking will be limited");
        Alert.alert(
          "Limited Tracking", 
          "Background location permission was denied. Tracking will only work when the app is open.",
          [{ text: "OK" }]
        );
      }

      // Get current location with fallback
      const location = await getCurrentLocationWithFallback();
      setCurrentLocation(location.coords);

      // Send initial location
      sendLocationToServer(location.coords);

      // Start watching foreground location changes
      const { foregroundOptions } = getPlatformLocationOptions();
      locationSubscription.current = await Location.watchPositionAsync(
        foregroundOptions,
        (loc) => {
          if (loc?.coords) {
            setCurrentLocation(loc.coords);
            sendLocationToServer(loc.coords);
          }
        }
      );

      // Setup background tracking if permission granted
      if (backgroundGranted) {
        const backgroundSuccess = await setupBackgroundLocationTracking();
        if (!backgroundSuccess) {
          console.warn("Background location setup failed");
        }
      }

      setIsTracking(true);
      console.log(`✅ Location tracking started successfully on ${Platform.OS}`);
      
    } catch (error) {
      console.error("Error starting location tracking:", error);
      setError(error.message);
      
      // Show platform-specific error messages
      if (Platform.OS === 'ios' && error.message.includes('permission')) {
        Alert.alert(
          "Location Permission Required",
          "Please go to Settings > Privacy & Security > Location Services and enable location access for this app.",
          [{ text: "OK" }]
        );
      } else if (Platform.OS === 'android' && error.message.includes('permission')) {
        Alert.alert(
          "Location Permission Required", 
          "Please go to Settings > Apps > [App Name] > Permissions and enable location access.",
          [{ text: "OK" }]
        );
      }
    } finally {
      initializationInProgress.current = false;
    }
  }, [isTracking, sendLocationToServer, setupBackgroundLocationTracking, getCurrentLocationWithFallback, checkAndRequestPermissions]);

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
      
      console.log("✅ Location tracking stopped successfully");
    } catch (error) {
      console.error("Error stopping location tracking:", error);
      setError(error.message);
    }
  }, []);

  // Initialize tracking on mount
  useEffect(() => {
    loadLastSentLocation();
    
    // Auto-start tracking (optional - you might want to control this manually)
    if (!isTracking && !initializationInProgress.current) {
      // Uncomment the line below if you want automatic tracking on mount
      // startLocationTracking();
    }

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  return {
    currentLocation,
    isTracking,
    error,
    lastSentLocation,
    permissionStatus,
    startLocationTracking,
    stopLocationTracking,
    getLocationHistory,
    clearLocationData,
  };
}