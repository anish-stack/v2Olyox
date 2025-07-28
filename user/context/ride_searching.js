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
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

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

// Utility function to wait/delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const RideSearchingProvider = ({ children }) => {
    const [currentRideSearching, setCurrentRideSearching] = useState(null);
    const [rideStatus, setRideStatus] = useState('idle');
    const [rideHistory, setRideHistory] = useState([]);
    const [isPolling, setIsPolling] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const navigation = useNavigation();
    const { saveRide, updateRideStatus } = useRide();
    const pollingIntervalRef = useRef(null);
    const lastStatusRef = useRef('idle');
    const isMountedRef = useRef(true);

    // Load saved ride data on mount
    useEffect(() => {
        const loadRideData = async () => {
            try {
                const savedRide = await SecureStore.getItemAsync(RIDE_KEY);
                if (savedRide && isMountedRef.current) {
                    const parsedRide = JSON.parse(savedRide);
                    console.log('Loaded saved ride:', parsedRide);
                    setCurrentRideSearching(parsedRide);
                    // Start polling if we have a ride that's not completed or cancelled
                    if (parsedRide && parsedRide._id && !['completed', 'cancelled'].includes(parsedRide.status)) {
                        setRideStatus(parsedRide.status || 'searching');
                        // Small delay to ensure state is set before starting polling
                        setTimeout(() => {
                            if (isMountedRef.current) {
                                startPolling();
                            }
                        }, 100);
                    }
                }
            } catch (err) {
                console.error('Error loading ride data:', err);
            }
        };

        loadRideData();

        // Cleanup on unmount
        return () => {
            isMountedRef.current = false;
            stopPolling();
        };
    }, []);

    // Start polling when ride status changes to searching
    useEffect(() => {
        if (rideStatus === 'searching' && currentRideSearching && currentRideSearching._id && !isPolling) {
            startPolling();
        } else if (['completed', 'cancelled', 'idle'].includes(rideStatus)) {
            stopPolling();
        }
    }, [rideStatus, currentRideSearching]);

    const saveRideSearching = async (ride) => {
        if (!isMountedRef.current) return;

        console.log('Saving ride:', ride);
        setCurrentRideSearching(ride);
        try {
            await SecureStore.setItemAsync(RIDE_KEY, JSON.stringify(ride));
        } catch (err) {
            console.error('Error saving current ride:', err);
        }
    };

    const clearCurrentRideSearching = async () => {
        if (!isMountedRef.current) return;

        console.log('Clearing current ride searching');
        setCurrentRideSearching(null);
        setRideStatus('idle');
        setRetryCount(0);
        stopPolling();
        try {
            await SecureStore.deleteItemAsync(RIDE_KEY);
        } catch (err) {
            console.error('Error clearing ride data:', err);
        }
    };

    const startPolling = useCallback(() => {
        if (isPolling || !isMountedRef.current) return;

        console.log('Starting ride status polling...');
        setIsPolling(true);
        setRetryCount(0);

        // Poll immediately, then every interval
        pollRideStatus();
        pollingIntervalRef.current = setInterval(() => {
            if (isMountedRef.current) {
                pollRideStatus();
            }
        }, POLLING_INTERVAL);
    }, []);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            console.log('Stopping ride status polling...');
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setIsPolling(false);
        setRetryCount(0);
    }, []);

    const pollRideStatus = useCallback(async () => {
        if (!isMountedRef.current) return;

        // Get the current ride from state at the time of polling
        const rideToCheck = currentRideSearching;
                        const savedRide = await SecureStore.getItemAsync(RIDE_KEY);

        const parsedRide = JSON.parse(savedRide);
        console.log('Loaded saved ride:', parsedRide);
        if (!parsedRide || !parsedRide._id) {
            console.log('No ride ID available for polling');
            return;
        }

        try {
            const token = await tokenCache.getToken('auth_token_db');
            if (!token) {
                console.log('No auth token available');
                return;
            }

            console.log(`Polling ride status for ID: ${parsedRide._id}`);

            const response = await axios.post(
                `https://www.appv2.olyox.com/api/v1/rider/ride-status/${parsedRide._id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000, // Increased timeout to 10 seconds
                    // Add retry configuration
                    retry: 3,
                    retryDelay: 1000
                }
            );

            if (!isMountedRef.current) return;

            const { status: newStatus, rideDetails, message, driver } = response.data;

            // Reset retry count on successful response
            setRetryCount(0);

            // Don't process if status hasn't changed
            if (newStatus === lastStatusRef.current) {
                return;
            }

            console.log(`Ride status changed from ${lastStatusRef.current} to ${newStatus}`);
            lastStatusRef.current = newStatus;
            setRideStatus(newStatus);

            // Update the ride with latest details
            const updatedRide = { ...rideToCheck, ...rideDetails, status: newStatus };
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
                    if (navigation && isMountedRef.current) {
                        navigation.replace('RideStarted', {
                            driver: driver || rideDetails?.driver,
                            rideId: rideToCheck._id,
                            ride: rideDetails
                        });
                    }
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
                    if (navigation && isMountedRef.current) {
                        navigation.replace('RideCompleted', { rideId: rideToCheck._id });
                    }
                    break;

                case 'cancelled':
                    showNotification('Ride Cancelled', message || 'Your ride has been cancelled.', 'error');
                    await sendPushNotification('Ride Cancelled', message || 'Your ride has been cancelled. Please try booking again.');

                    // Clear everything and stop polling
                    await clearCurrentRideSearching();

                    // Navigate back to home or booking screen
                    if (navigation && isMountedRef.current) {
                        navigation.replace('Home');
                    }
                    break;

                default:
                    console.log(`Unknown ride status: ${newStatus}`);
                    break;
            }
        } catch (err) {
            console.error('Error polling ride status:', err);

            if (!isMountedRef.current) return;

            // Increment retry count
            const currentRetryCount = retryCount + 1;
            setRetryCount(currentRetryCount);

            if (err.response?.status === 401) {
                showNotification('Authentication Error', 'Please log in again.', 'error');
                await clearCurrentRideSearching();
            } else if (err.response?.status === 404) {
                // showNotification('Ride Not Found', 'This ride may have been cancelled.', 'error');
                await clearCurrentRideSearching();
            } else if (err.response?.status >= 500) {
                // Server error - retry with exponential backoff
                console.log(`Server error, retrying in ${RETRY_DELAY * currentRetryCount}ms...`);
                if (currentRetryCount < MAX_RETRY_ATTEMPTS) {
                    setTimeout(() => {
                        if (isMountedRef.current) {
                            pollRideStatus();
                        }
                    }, RETRY_DELAY * currentRetryCount);
                }
            } else {
                // Network error or other issues
                console.log('Network error during polling, will retry on next interval...');

                // If we've failed too many times, show a notification
                if (currentRetryCount >= MAX_RETRY_ATTEMPTS) {
                    showNotification('Connection Issue', 'Having trouble connecting. Please check your internet connection.', 'error');
                    setRetryCount(0); // Reset for next cycle
                }
            }
        }
    }, [currentRideSearching, retryCount, navigation, saveRide, updateRideStatus]);

    const updateRideStatusSearching = useCallback((status) => {
        if (!isMountedRef.current) return;

        console.log('Updating ride status to:', status);
        setRideStatus(status);
        lastStatusRef.current = status;
    }, []);

    // Manual method to start a ride search
    const startRideSearch = useCallback(async (rideData) => {
        if (!isMountedRef.current) return;

        console.log('Starting ride search with data:', rideData);
        const rideWithStatus = { ...rideData, status: 'searching' };
        await saveRideSearching(rideWithStatus);
        setRideStatus('searching');

        // Small delay to ensure state is updated
        setTimeout(() => {
            if (isMountedRef.current) {
                startPolling();
            }
        }, 100);
    }, [startPolling]);

    // Manual method to cancel ride search
    const cancelRideSearch = useCallback(async () => {
        if (!isMountedRef.current) return;

        try {
            if (currentRideSearching?._id) {
                const token = await tokenCache.getToken('auth_token_db');
                if (token) {
                    // Cancel ride on server
                    await axios.post(
                        `https://www.appv2.olyox.com/api/v1/new/cancel/${currentRideSearching._id}`,
                        {},
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 5000
                        }
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
        retryCount,
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