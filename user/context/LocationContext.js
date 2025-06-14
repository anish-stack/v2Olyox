import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Platform, Alert } from "react-native";

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const locationWatcher = useRef(null);
  const retryCount = useRef(0);

  const ACCURACY_THRESHOLD = 700;
  const MAX_RETRY_COUNT = 3;
  const TIMEOUT_DURATION = 15000; // 15 seconds

  // Fallback locations for different areas (you can customize these)
  const FALLBACK_LOCATIONS = {
    delhi: { latitude: 28.6139, longitude: 77.2090 },
    mumbai: { latitude: 19.0760, longitude: 72.8777 },
    bangalore: { latitude: 12.9716, longitude: 77.5946 },
    default: { latitude: 28.6139, longitude: 77.2090 } // Delhi as default
  };

  const setFallbackLocation = (reason = "Unable to get precise location") => {
    console.log("🔄 Setting fallback location:", reason);
    const fallbackCoords = FALLBACK_LOCATIONS.default;
    
    setLocation({
      coords: {
        ...fallbackCoords,
        accuracy: 1000, // Mark as low accuracy
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
      isFallback: true
    });
    
    setErrorMsg(`Using approximate location: ${reason}`);
    setIsLoading(false);
  };

  // Check if location services are properly enabled
  const checkLocationServices = async () => {
    try {
      const isEnabled = await Location.hasServicesEnabledAsync();
      console.log("📍 Location services enabled:", isEnabled);
      
      if (!isEnabled) {
        // Try to prompt user to enable location services
        if (Platform.OS === 'android') {
          Alert.alert(
            "Location Services Disabled",
            "Please enable location services in your device settings to get accurate location.",
            [
              { text: "Use Approximate Location", onPress: () => setFallbackLocation("Location services disabled") },
              { 
                text: "Retry", 
                onPress: () => {
                  retryCount.current = 0;
                  getCurrentLocation();
                }
              }
            ]
          );
        } else {
          setFallbackLocation("Location services disabled");
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error checking location services:", error);
      setFallbackLocation("Error checking location services");
      return false;
    }
  };

  // Get location with multiple fallback strategies
  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      
      console.log(`📡 Attempting to get location (attempt ${retryCount.current + 1}/${MAX_RETRY_COUNT})`);

      // Check permissions first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("❌ Location permission denied");
        setFallbackLocation("Location permission denied");
        return;
      }

      // Check if location services are enabled
      const servicesEnabled = await checkLocationServices();
      if (!servicesEnabled) {
        return; // checkLocationServices handles the fallback
      }

      // Try different accuracy levels based on retry count
      const accuracyLevels = [
        Location.Accuracy.BestForNavigation,
        Location.Accuracy.High,
        Location.Accuracy.Balanced,
        Location.Accuracy.Low
      ];

      const currentAccuracy = accuracyLevels[Math.min(retryCount.current, accuracyLevels.length - 1)];
      console.log("🎯 Using accuracy level:", Object.keys(Location.Accuracy)[Object.values(Location.Accuracy).indexOf(currentAccuracy)]);

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), TIMEOUT_DURATION);
      });

      // Get location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: currentAccuracy,
        mayShowUserSettingsDialog: true,
        timeout: TIMEOUT_DURATION,
      });

      const currentLocation = await Promise.race([locationPromise, timeoutPromise]);
      const { coords } = currentLocation;
      
      console.log("📡 Location obtained:", {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      });

      if (coords.accuracy <= ACCURACY_THRESHOLD) {
        setLocation({ coords });
        setErrorMsg(null);
        retryCount.current = 0; // Reset retry count on success
        console.log("✅ Location set successfully with accuracy:", coords.accuracy);
      } else {
        console.log("⚠️ Location accuracy too low:", coords.accuracy);
        
        if (retryCount.current < MAX_RETRY_COUNT - 1) {
          retryCount.current++;
          console.log(`🔄 Retrying with lower accuracy (${retryCount.current}/${MAX_RETRY_COUNT})`);
          setTimeout(() => getCurrentLocation(), 2000); // Wait 2 seconds before retry
          return;
        } else {
          // Use the location even if accuracy is low after max retries
          setLocation({ coords });
          setErrorMsg(`Using location with low accuracy: ${Math.round(coords.accuracy)}m`);
          console.log("⚠️ Using low accuracy location after max retries");
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error getting location:", error.message);
      
      // Handle specific error cases
      if (error.message.includes('timed out')) {
        console.log("⏰ Location request timed out");
        
        if (retryCount.current < MAX_RETRY_COUNT - 1) {
          retryCount.current++;
          console.log(`🔄 Retrying after timeout (${retryCount.current}/${MAX_RETRY_COUNT})`);
          setTimeout(() => getCurrentLocation(), 3000);
          return;
        } else {
          setFallbackLocation("Location request timed out");
        }
      } else if (error.message.includes('unavailable')) {
        console.log("📍 Location currently unavailable");
        
        if (retryCount.current < MAX_RETRY_COUNT - 1) {
          retryCount.current++;
          console.log(`🔄 Retrying location request (${retryCount.current}/${MAX_RETRY_COUNT})`);
          setTimeout(() => getCurrentLocation(), 5000);
          return;
        } else {
          setFallbackLocation("Location currently unavailable");
        }
      } else {
        setFallbackLocation(`Error: ${error.message}`);
      }
      
      setIsLoading(false);
    }
  };

  // Try to get last known location as a faster alternative
  const getLastKnownLocation = async () => {
    try {
      console.log("🔍 Trying to get last known location...");
      const lastLocation = await Location.getLastKnownPositionAsync({
        maxAge: 300000, // 5 minutes
        requiredAccuracy: ACCURACY_THRESHOLD,
      });

      if (lastLocation) {
        console.log("📍 Last known location found:", lastLocation.coords);
        setLocation(lastLocation);
        setErrorMsg("Using last known location");
        setIsLoading(false);
        return true;
      }
      return false;
    } catch (error) {
      console.log("❌ Could not get last known location:", error.message);
      return false;
    }
  };

  // Method to manually refresh location
  const refreshLocation = async () => {
    console.log("🔄 Manually refreshing location...");
    retryCount.current = 0;
    setIsLoading(true);
    setErrorMsg(null);
    
    // Try last known location first for faster response
    const hasLastKnown = await getLastKnownLocation();
    if (!hasLastKnown) {
      getCurrentLocation();
    }
  };

  // Stop any active location watching
  const stopWatchingLocation = () => {
    if (locationWatcher.current) {
      locationWatcher.current.remove();
      locationWatcher.current = null;
      console.log("🛑 Location watching stopped");
    }
  };

  // Enhanced initialization
  useEffect(() => {
    const initializeLocation = async () => {
      console.log("🚀 Initializing location services...");
      
      // Try last known location first for faster startup
      const hasLastKnown = await getLastKnownLocation();
      
      // If no last known location, get current location
      if (!hasLastKnown) {
        getCurrentLocation();
      } else {
        // Still try to get current location in background for better accuracy
        setTimeout(() => {
          console.log("🔄 Getting fresh location in background...");
          getCurrentLocation();
        }, 2000);
      }
    };

    initializeLocation();

    // Cleanup function
    return () => {
      stopWatchingLocation();
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        errorMsg,
        isLoading,
        refreshLocation,
        stopWatchingLocation,
        isUsingFallback: location?.isFallback || false
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use location
export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};