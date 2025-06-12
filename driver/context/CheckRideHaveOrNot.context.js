import React, { createContext, useState, useContext } from 'react';

// Create the context
const RideStatusContext = createContext();

// Create a provider component
export const RideStatusProvider = ({ children }) => {
    const [onRide, setOnRide] = useState(false);

    // Function to update ride status
    const updateRideStatus = (status) => {
        setOnRide(status);
    };

    return (
        <RideStatusContext.Provider value={{ onRide, updateRideStatus }}>
            {children}
        </RideStatusContext.Provider>
    );
};

// Custom hook to use the RideStatusContext
export const useRideStatus = () => {
    const context = useContext(RideStatusContext);
    if (!context) {
        throw new Error('useRideStatus must be used within a RideStatusProvider');
    }
    return context;
};