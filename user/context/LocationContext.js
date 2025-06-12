import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const locationWatcher = useRef(null);

  const ACCURACY_THRESHOLD = 700;

  // Get location once and stop
  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        setIsLoading(false);
        return;
      }

      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      if (!isLocationEnabled) {
        setErrorMsg("Location services are disabled");
        setIsLoading(false);
        return;
      }

      // Get current position once
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        mayShowUserSettingsDialog: true,
      });

      const { coords } = currentLocation;
      console.log("📡 Location obtained:", coords);

      if (coords.accuracy <= ACCURACY_THRESHOLD) {
        setLocation({ coords });
        setErrorMsg(null);
        console.log("✅ Location set successfully");
      } else {
        setErrorMsg(`Location accuracy too low: ${coords.accuracy}m`);
        console.log("❌ Location accuracy too low:", coords.accuracy);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error getting location:", error);
      setErrorMsg("Error getting location");
      setIsLoading(false);
    }
  };

  // Method to manually refresh location if needed
  const refreshLocation = () => {
    getCurrentLocation();
  };

  // Stop any active location watching
  const stopWatchingLocation = () => {
    if (locationWatcher.current) {
      locationWatcher.current.remove();
      locationWatcher.current = null;
      console.log("🛑 Location watching stopped");
    }
  };

  useEffect(() => {
    getCurrentLocation();

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
        stopWatchingLocation 
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use location
export const useLocation = () => useContext(LocationContext);