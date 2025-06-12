import { createContext, useContext, useState, useEffect } from "react";
import * as Location from "expo-location";

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [driverLocation, setDriverLocation] = useState(null);
  const [hasPermission, setHasPermission] = useState(null); // To track permission status
  const [locationSubscription, setLocationSubscription] = useState(null);

  // Function to request location permissions
  const requestLocationPermissions = async () => {
    try {
      // Request foreground location permission
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        console.error("Foreground location permission was denied");
        setHasPermission(false);
        return;
      }

      // Request background location permission if needed
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.error("Background location permission was denied");
        setHasPermission(false);
        return;
      }

      setHasPermission(true);
    } catch (error) {
      console.error("Error requesting location permissions:", error);
      setHasPermission(false);
    }
  };

  // Function to start watching location
  const startLocationUpdates = async () => {
    if (!hasPermission) {
      console.error("No permission to access location");
      return;
    }


    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High, // Set the accuracy level for location updates
        timeInterval: 60000, // 1 Minute interval for updates
        distanceInterval: 0, // Only update when the location changes
      },
      (location) => {
       
        setDriverLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    );

    // Save the subscription so we can remove it later
    setLocationSubscription(subscription);
  };

  // Request permissions and start location updates
  useEffect(() => {
    requestLocationPermissions();
  }, []);

  useEffect(() => {
    if (hasPermission) {
      startLocationUpdates();
    }

    // Clean up function
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [hasPermission]);

  return (
    <LocationContext.Provider value={{ driverLocation, updateLocation: setDriverLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};