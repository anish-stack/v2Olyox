import React, { createContext, useContext, useState } from 'react';

const RideContext = createContext();

export const RideProvider = ({ children }) => {
  const [currentRide, setCurrentRide] = useState(null);
  const [rideStatus, setRideStatus] = useState('idle'); 
  const [rideHistory, setRideHistory] = useState([]);

  const updateRideStatus = (status) => {
    setRideStatus(status);
  };

  const saveRide = (ride) => {
    setCurrentRide(ride);
    setRideHistory(prev => [...prev, ride]);
  };

  const clearCurrentRide = () => {
    setCurrentRide(null);
    setRideStatus('idle');
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