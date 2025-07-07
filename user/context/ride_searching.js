import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useRide } from './RideContext';
import { tokenCache } from '../Auth/cache';

const RideContextSearching = createContext(null);

const RIDE_KEY = 'CURRENT_RIDE_SEARCHING';
const POLLING_INTERVAL = 60000; // 1 minute

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const showNotification = (title, message, type = 'info') => {
    const displayMessage = `${title ? title + '\n' : ''}${message}`;
    if (Platform.OS === 'android') {
        ToastAndroid.show(displayMessage, type === 'error' || message.length > 60 ? ToastAndroid.LONG : ToastAndroid.SHORT);
    } else {
        Alert.alert(title || (type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Notification'), message);
    }
};

const sendPushNotification = async (title, body, data = {}) => {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
            },
            trigger: null, // Show immediately
        });
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

export const RideSearchingProvider = ({ children }) => {
    const [currentRideSearching, setCurrentRideSearching] = useState(null);
    const [rideStatus, setRideStatus] = useState('idle');
    const [rideHistory, setRideHistory] = useState([]);
    const [isPolling, setIsPolling] = useState(false);

    const navigation = useNavigation();
    const { saveRide, updateRideStatus } = useRide();
    const pollingIntervalRef = useRef(null);
    const lastStatusRef = useRef('idle');

    // Load saved ride data on mount
    useEffect(() => {
        const loadRideData = async () => {
            try {
                const savedRide = await SecureStore.getItemAsync(RIDE_KEY);
                if (savedRide) {
                    const parsedRide = JSON.parse(savedRide);
                    setCurrentRideSearching(parsedRide);
                    // Start polling if we have a ride that's not completed or cancelled
                    if (parsedRide && !['completed', 'cancelled'].includes(parsedRide.status)) {
                        setRideStatus(parsedRide.status || 'searching');
                        startPolling();
                    }
                }
            } catch (err) {
                console.error('Error loading ride data:', err);
            }
        };

        loadRideData();

        // Cleanup on unmount
        return () => {
            stopPolling();
        };
    }, []);

    // Start polling when ride status changes to searching
    useEffect(() => {
        if (rideStatus === 'searching' && currentRideSearching && !isPolling) {
            startPolling();
        } else if (['completed', 'cancelled', 'idle'].includes(rideStatus)) {
            stopPolling();
        }
    }, [rideStatus, currentRideSearching]);

    const saveRideSearching = async (ride) => {
        setCurrentRideSearching(ride);
        try {
            await SecureStore.setItemAsync(RIDE_KEY, JSON.stringify(ride));
        } catch (err) {
            console.error('Error saving current ride:', err);
        }
    };

    const clearCurrentRideSearching = async () => {
        setCurrentRideSearching(null);
        setRideStatus('idle');
        stopPolling();
        try {
            await SecureStore.deleteItemAsync(RIDE_KEY);
        } catch (err) {
            console.error('Error clearing ride data:', err);
        }
    };

    const startPolling = useCallback(() => {
        if (isPolling) return;

        console.log('Starting ride status polling...');
        setIsPolling(true);

        // Poll immediately, then every minute
        pollRideStatus();
        pollingIntervalRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
    }, []);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            console.log('Stopping ride status polling...');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setIsPolling(false);
    }, []);

    const pollRideStatus = useCallback(async () => {
        if (!currentRideSearching?._id) {
            console.log('No ride ID available for polling');
            return;
        }

        try {
            const token = await tokenCache.getToken('auth_token_db');
            if (!token) {
                console.log('No auth token available');
                return;
            }

            console.log(`Polling ride status for ID: ${currentRideSearching._id}`);

            const response = await axios.get(
                `https://www.appv2.olyox.com/api/v1/new/status/${currentRideSearching._id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: POLLING_INTERVAL - 1000
                }
            );

            const { status: newStatus, rideDetails, message, driver } = response.data;

            // Don't process if status hasn't changed
            if (newStatus === lastStatusRef.current) {
                return;
            }

            console.log(`Ride status changed from ${lastStatusRef.current} to ${newStatus}`);
            lastStatusRef.current = newStatus;
            setRideStatus(newStatus);

            // Update the ride with latest details
            const updatedRide = { ...currentRideSearching, ...rideDetails, status: newStatus };
            await saveRideSearching(updatedRide);

            // Handle different statuses
            switch (newStatus) {
                case 'searching':
                    // Still searching - continue polling
                    showNotification('Searching', 'Looking for a driver...', 'info');
                    break;

                case 'driver_assigned':
                    showNotification('Driver Assigned!', message || 'Your driver is on the way.', 'success');
                    await sendPushNotification('Driver Assigned', 'Your ride is confirmed and driver is on the way!');

                    // Save ride to main ride context
                    if (rideDetails) {
                        saveRide({ ...rideDetails, driver });
                        updateRideStatus('confirmed');
                    }
                    break;

                case 'driver_arrived':
                    showNotification('Driver Arrived!', message || 'Your driver has arrived.', 'success');
                    await sendPushNotification('Driver Arrived', 'Your driver is here!');

                    // Clear searching context and navigate to ride started
                    await clearCurrentRideSearching();

                    // Navigate to ride started screen
                    navigation.replace('RideStarted', {
                        driver: driver || rideDetails?.driver,
                        rideId: currentRideSearching._id,
                        ride: rideDetails
                    });
                    break;

                case 'in_progress':
                    showNotification('Ride Started', message || 'Your ride is in progress.', 'info');
                    await sendPushNotification('Ride Started', 'Your ride has started. Have a safe journey!');

                    // Clear searching context as ride is now active
                    await clearCurrentRideSearching();
                    break;

                case 'completed':
                    showNotification('Ride Completed!', message || 'Thank you for riding with us.', 'success');
                    await sendPushNotification('Ride Completed', 'Your ride has been completed successfully!');

                    // Clear everything and stop polling
                    await clearCurrentRideSearching();

                    // Navigate to ride completion screen or home
                    navigation.replace('RideCompleted', { rideId: currentRideSearching._id });
                    break;

                case 'cancelled':
                    showNotification('Ride Cancelled', message || 'Your ride has been cancelled.', 'error');
                    await sendPushNotification('Ride Cancelled', message || 'Your ride has been cancelled. Please try booking again.');

                    // Clear everything and stop polling
                    await clearCurrentRideSearching();

                    // Navigate back to home or booking screen
                    navigation.replace('Home');
                    break;

                default:
                    console.log(`Unknown ride status: ${newStatus}`);
                    break;
            }
        } catch (err) {
            console.error('Error polling ride status:', err);

            if (err.response?.status === 401) {
                showNotification('Authentication Error', 'Please log in again.', 'error');
                await clearCurrentRideSearching();
            } else if (err.response?.status === 404) {
                showNotification('Ride Not Found', 'This ride may have been cancelled.', 'error');
                await clearCurrentRideSearching();
            } else {
                // Don't show error for network issues, just log and continue polling
                console.log('Network error during polling, will retry...');
            }
        }
    }, [currentRideSearching, navigation, saveRide, updateRideStatus]);

    const updateRideStatusSearching = useCallback((status) => {
        setRideStatus(status);
        lastStatusRef.current = status;
    }, []);

    // Manual method to start a ride search
    const startRideSearch = useCallback(async (rideData) => {
        await saveRideSearching({ ...rideData, status: 'searching' });
        setRideStatus('searching');
        startPolling();
    }, [startPolling]);

    // Manual method to cancel ride search
    const cancelRideSearch = useCallback(async () => {
        try {
            if (currentRideSearching?._id) {
                const token = await tokenCache.getToken('auth_token_db');
                if (token) {
                    // Cancel ride on server
                    await axios.post(
                        `https://www.appv2.olyox.com/api/v1/new/cancel/${currentRideSearching._id}`,
                        {},
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                }
            }
        } catch (error) {
            console.error('Error cancelling ride on server:', error);
        } finally {
            await clearCurrentRideSearching();
            showNotification('Ride Cancelled', 'Your ride search has been cancelled.', 'info');
        }
    }, [currentRideSearching]);

    const contextValue = {
        currentRide: currentRideSearching,
        rideStatus,
        rideHistory,
        isPolling,
        updateRideStatusSearching,
        saveRideSearching,
        clearCurrentRideSearching,
        startRideSearch,
        cancelRideSearch,
        startPolling,
        stopPolling,
    };

    return (
        <RideContextSearching.Provider value={contextValue}>
            {children}
        </RideContextSearching.Provider>
    );
};

// Hook
export const useRideSearching = () => {
    const context = useContext(RideContextSearching);
    if (!context) {
        throw new Error('useRideSearching must be used within a RideSearchingProvider');
    }
    return context;
};