import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const RideContext = createContext();

const RIDE_KEY = 'CURRENT_RIDE';
const RIDE_HISTORY_KEY = 'RIDE_HISTORY';

export const RideProvider = ({ children }) => {
  const [currentRide, setCurrentRide] = useState(null);
  const [rideStatus, setRideStatus] = useState('idle'); 
  const [rideHistory, setRideHistory] = useState([]);

  // Load ride data from secure store on mount
  useEffect(() => {
    const loadRideData = async () => {
      try {
        const savedRide = await SecureStore.getItemAsync(RIDE_KEY);
        const savedHistory = await SecureStore.getItemAsync(RIDE_HISTORY_KEY);

        if (savedRide) setCurrentRide(JSON.parse(savedRide));
        if (savedHistory) setRideHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error("Error loading ride data:", err);
      }
    };

    loadRideData();
  }, []);

  const updateRideStatus = (status) => {
    setRideStatus(status);
  };

  const saveRide = async (ride) => {
    setCurrentRide(ride);
    setRideHistory(prev => {
      const updatedHistory = [...prev, ride];
      SecureStore.setItemAsync(RIDE_HISTORY_KEY, JSON.stringify(updatedHistory));
      return updatedHistory;
    });

    try {
      await SecureStore.setItemAsync(RIDE_KEY, JSON.stringify(ride));
    } catch (err) {
      console.error("Error saving current ride:", err);
    }
  };

  const clearCurrentRide = async () => {
    setCurrentRide(null);
    setRideStatus('idle');
    console.log("Cleanin")
    await SecureStore.deleteItemAsync(RIDE_KEY);
  };
 


  return (
    <RideContext.Provider value={{
      currentRide,
      rideStatus,
      rideHistory,
      updateRideStatus,
      saveRide,
      clearCurrentRide
    }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => useContext(RideContext);
