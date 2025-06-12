import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

// Create context
const BookingContext = createContext();

// Custom hook
export const useBookingParcel = () => useContext(BookingContext);

// Default booking state
const defaultState = {
    locations: {
        pickup: {
            address: '',
            coordinates: { lat: 0, lng: 0 }
        },
        dropoff: {
            address: '',
            coordinates: { lat: 0, lng: 0 }
        },
        stops: []
    },
    apartment: '',
    name: '',
    phone: '',
    vehicle_id: '',
    goodType: '',
    goodId: '',
    useMyNumber: false,
    savedAs: null,
    fares: {
        baseFare: 0,
        netFare: 0,
        couponApplied: false,
        discount: 0,
        payableAmount: 0
    },
    is_rider_assigned: false,
    ride_id: '',
    is_booking_completed: false,
    is_booking_cancelled: false,
    is_pickup_complete: false,
    is_dropoff_complete: false,
};

// Provider
export const BookingParcelProvider = ({ children }) => {
    const [bookingState, setBookingState] = useState(defaultState);
    const [isLoading, setIsLoading] = useState(false);

    // Save to SecureStore with improved error handling
    const saveStateToStorage = async () => {
        try {
            await SecureStore.setItemAsync("bookingState", JSON.stringify(bookingState));
            return true;
        } catch (error) {
            console.error("Failed to save booking state:", error);
            return false;
        }
    };

    // Load from SecureStore with improved error handling
    const loadStateFromStorage = async () => {
        setIsLoading(true);
        try {
            const stored = await SecureStore.getItemAsync("bookingState");
            if (stored) {
                const parsedState = JSON.parse(stored);
                setBookingState(parsedState);
            }
        } catch (error) {
            console.error("Failed to load booking state:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Clear/reset booking state with improved feedback
    const clearBooking = async () => {
        try {
            await SecureStore.deleteItemAsync("bookingState");
            setBookingState(defaultState);
            return true;
        } catch (error) {
            console.error("Failed to clear booking state:", error);
            return false;
        }
    };

    // Improved updateBooking with better state management
    const updateBooking = (updates) => {
        return new Promise((resolve) => {
            setBookingState((prev) => {
                // Create a deep merged object
                const updated = deepMerge(prev, updates);
                
                // Schedule storage update
                setTimeout(() => {
                    saveStateToStorage();
                }, 0);
                
                resolve(updated);
                return updated;
            });
        });
    };

    // Helper function for deep merging objects
    const deepMerge = (target, source) => {
        const output = { ...target };
        
        if (isObject(target) && isObject(source)) {
            Object.keys(source).forEach(key => {
                if (isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    };

    // Helper to check if value is an object
    const isObject = (item) => {
        return (item && typeof item === 'object' && !Array.isArray(item));
    };

    useEffect(() => {
        loadStateFromStorage();
    }, []);

    return (
        <BookingContext.Provider
            value={{
                bookingState,
                setBookingState,
                updateBooking,
                clearBooking,
                saveStateToStorage,
                isLoading
            }}
        >
            {children}
        </BookingContext.Provider>
    );
};
