import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  AppState,
  Alert,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { Text, ActivityIndicator } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { MaterialIcons } from '@expo/vector-icons';
import { useSocket } from "../context/SocketContext";

// Import components
import OtpModal from "./OtpModal";
import CancelReasonsModal from "./CancelReasonsModal";
import RideMap from "./RideMap";
import RideBottomSheet from "./RideBottomSheet";
import { useRideActions } from "../hooks/useRideActions";
import { useLocationTrackingTwo } from "../hooks/useLocationTrackingTwo";

// Constants
const { height } = Dimensions.get('window');
const API_BASE_URL = "https://appapi.olyox.com";
const BOTTOM_SHEET_MIN_HEIGHT = 200;
const BOTTOM_SHEET_MAX_HEIGHT = height * 1;

export default function RideDetailsScreen() {
  // ===== REFS =====
  const mapRef = useRef(null);
  const carIconAnimation = useRef(new Animated.Value(0)).current;
  const soundRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const socketConnectionAttempts = useRef(0);
  const isInitialMount = useRef(true);
  const socketListenersSet = useRef(false);
  const rideDataRef = useRef(null);
  const appStateSubscription = useRef(null);
  const lastAppStateChange = useRef(Date.now());
  const isComponentMounted = useRef(true);

  // Bottom sheet animation
  const bottomSheetTranslateY = useRef(new Animated.Value(BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT)).current;

  // ===== NAVIGATION & ROUTE =====
  const route = useRoute();
  const navigation = useNavigation();
  const { params } = route || {};

  // ===== SOCKET CONTEXT =====
  const { socket } = useSocket();

  // ===== STATE =====
  const [state, setState] = useState({
    loading: true,
    showOtpModal: false,
    otp: "",
    rideStarted: false,
    rideCompleted: false,
    currentLocation: null,
    mapReady: false,
    distanceToPickup: null,
    timeToPickup: null,
    showDirectionsType: "driver_to_pickup",
    errorMsg: null,
    cancelReasons: [],
    showCancelModal: false,
    selectedReason: null,
    sound: null,
    socketConnected: socket?.connected || false,
    bottomSheetHeight: BOTTOM_SHEET_MIN_HEIGHT,
  });

  const [driverCoordinates, setDriverCoordinates] = useState(null);
  const [pickupCoordinates, setPickupCoordinates] = useState(null);
  const [dropCoordinates, setDropCoordinates] = useState(null);
  const [rideDetails, setRideDetails] = useState({});

  // ===== HELPER FUNCTIONS =====
  const updateState = useCallback((newState) => {
    if (!isComponentMounted.current) return;
    setState(prevState => ({ ...prevState, ...newState }));
  }, []);



  console.log("otp", state.showOtpModal);
  const logDebug = useCallback((message, data = null) => {
    if (__DEV__) {
      if (data) {
        console.log(`✔️ ${message}`, data);
      } else {
        console.log(`✔️ ${message}`);
      }
    }
  }, []);

  const logError = useCallback((message, error = null) => {
    if (error) {
      console.error(`❌ ${message}`, error);
    } else {
      console.error(`❌ ${message}`);
    }
  }, []);

  // ===== BOTTOM SHEET GESTURE HANDLER =====
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10; // Increased threshold for better touch handling
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: () => {
        // Stop any ongoing animations when user starts gesture
        bottomSheetTranslateY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        const currentTranslateY = bottomSheetTranslateY._value;
        const newTranslateY = Math.max(
          0, // Max expanded position
          Math.min(
            BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT, // Max collapsed position
            currentTranslateY + gestureState.dy
          )
        );

        bottomSheetTranslateY.setValue(newTranslateY);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentTranslateY = bottomSheetTranslateY._value;
        const velocity = gestureState.vy;
        const midPoint = (BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT) / 2;

        // Determine target position based on current position and velocity
        let targetY;
        if (velocity > 0.5) {
          // Fast downward swipe - collapse
          targetY = BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT;
        } else if (velocity < -0.5) {
          // Fast upward swipe - expand
          targetY = 0;
        } else {
          // Slow movement - snap to nearest position
          targetY = currentTranslateY > midPoint
            ? BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT
            : 0;
        }

        // Animate to target position
        Animated.spring(bottomSheetTranslateY, {
          toValue: targetY,
          useNativeDriver: true,
          tension: 120,
          friction: 8,
        }).start();

        // Update state
        const newHeight = targetY === 0 ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT;
        updateState({ bottomSheetHeight: newHeight });
      },
    });
  }, [updateState, bottomSheetTranslateY]);

  // ===== RIDE DETAILS =====
  const checkAuthToken = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');

      if (!token) {
        logError('No auth token found');
        return null;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/rider/user-details`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const partner = response.data.partner;

      if (partner?.on_ride_id) {
        logDebug('Found active ride ID from user details', partner.on_ride_id);
        return partner.on_ride_id;
      }

      return null;
    } catch (error) {
      logError('Auth token check failed', error);
      return null;
    }
  }, [logDebug, logError]);

  // Get ride ID from params or auth check
  const getRideId = useCallback(async () => {
    // First check if we have an ID from params
    if (params?.temp_ride_id) {
      logDebug('Using ride ID from params', params.temp_ride_id);
      return params.temp_ride_id;
    }

    // If not, check from auth token
    const authRideId = await checkAuthToken();
    if (authRideId) {
      logDebug('Using ride ID from auth check', authRideId);
      return authRideId;
    }

    return null;
  }, [params, checkAuthToken, logDebug]);

  // Fetch ride details from API
  const foundRideDetails = useCallback(async (rideId) => {
    if (!rideId) {
      logError('Cannot fetch ride details: No ride ID provided');
      updateState({ loading: false, errorMsg: 'No ride ID found' });
      return;
    }

    try {

      const response = await axios.get(`${API_BASE_URL}/rider/${rideId}`);
      // const response = await axios.get(`http://192.168.1.22:3100/rider/${rideId}`);

      if (!response.data) {
        throw new Error('No ride data returned from API');
      }

      logDebug('Ride details fetched successfully');

      // Save the complete ride data for use throughout component
      setRideDetails(response.data);

      // Update component state
      updateState({
        loading: false,
        rideStarted: !!response?.data?.ride?.rideDetails?.otp_verify_time,
        showDirectionsType: !!response?.data?.ride?.rideDetails?.otp_verify_time
          ? "pickup_to_drop"
          : "driver_to_pickup",
      });

      return response.data;
    } catch (error) {
      logError('Failed to fetch ride details', error);
      updateState({
        loading: false,
        errorMsg: 'Failed to load ride details. Please try again.'
      });
      return null;
    }
  }, [logDebug, logError, updateState]);

  // Initialize ride data
  useEffect(() => {
    const initializeRideData = async () => {
      try {
        // Get ride ID from any available source
        const rideId = await getRideId();

        if (rideId) {
          // Fetch full ride details using the ID
          const rideData = await foundRideDetails(rideId);
          rideDataRef.current = rideData;
        } else {
          updateState({
            loading: false,
            errorMsg: 'No active ride found'
          });
        }
      } catch (error) {
        logError('Error initializing ride data', error);
        updateState({
          loading: false,
          errorMsg: 'Failed to initialize ride. Please try again.'
        });
      }
    };

    initializeRideData();
  }, [getRideId, foundRideDetails, updateState, logError]);

  // Get location tracking
  const {
    currentLocation,
    startLocationTracking,
    stopLocationTracking
  } = useLocationTrackingTwo(socket, rideDetails?._id, state.rideStarted);

  // Get ride actions
  const {
    handleOtpSubmit,
    handleCancelRide,
    handleCompleteRide,
    openGoogleMapsDirections,
    openGoogleMapsDirectionsPickup,
    startSound,
    stopSound,
    fetchCancelReasons
  } = useRideActions({
    state,
    setState,
    rideDetails,
    socket,
    navigation,
    mapRef,
    soundRef
  });

  // ===== COORDINATES =====
  useEffect(() => {
    if (!rideDetails?.ride) return;

    try {
      const getCoordinates = () => {
        // Driver/Rider coordinates
        if (currentLocation) {
          setDriverCoordinates(currentLocation);
        } else if (rideDetails?.rider?.location?.coordinates) {
          setDriverCoordinates({
            latitude: rideDetails.rider.location.coordinates[1],
            longitude: rideDetails.rider.location.coordinates[0],
          });
        } else {
          // Default coordinates
          setDriverCoordinates({ latitude: 28.7041, longitude: 77.1025 });
        }

        // Pickup coordinates
        if (rideDetails?.ride?.rideDetails?.pickupLocation?.coordinates) {
          setPickupCoordinates({
            latitude: rideDetails.ride.rideDetails.pickupLocation.coordinates[1],
            longitude: rideDetails.ride.rideDetails.pickupLocation.coordinates[0],
          });
        } else {
          // Default coordinates
          setPickupCoordinates({ latitude: 28.7041, longitude: 77.1025 });
        }

        // Drop coordinates
        if (rideDetails?.ride?.rideDetails?.dropLocation?.coordinates) {
          setDropCoordinates({
            latitude: rideDetails.ride.rideDetails.dropLocation.coordinates[1],
            longitude: rideDetails.ride.rideDetails.dropLocation.coordinates[0],
          });
        } else {
          // Default coordinates
          setDropCoordinates({ latitude: 28.6139, longitude: 77.2090 });
        }
      };

      getCoordinates();
    } catch (error) {
      logError('Error setting coordinates', error);
    }
  }, [rideDetails, currentLocation, logError]);

  // ===== SOCKET MANAGEMENT =====
  const connectSocket = useCallback(() => {
    if (!socket) {
      logError('Socket instance not available');
      return false;
    }

    if (!socket.connected) {
      logDebug('Connecting socket...');
      socketConnectionAttempts.current += 1;

      try {
        socket.connect();

        // Check connection after a delay
        setTimeout(() => {
          if (socket.connected) {
            logDebug('Socket connected successfully');
            updateState({ socketConnected: true });
            setupSocketListeners();
          } else {
            logError(`Socket connection failed (attempt ${socketConnectionAttempts.current})`);
            if (socketConnectionAttempts.current < 3) {
              connectSocket(); // Retry
            } else {
              Alert.alert(
                "Connection Error",
                "Unable to establish a connection. Please check your internet connection.",
                [{ text: "OK" }]
              );
            }
          }
        }, 2000);
      } catch (error) {
        logError('Error connecting socket', error);
      }
    } else {
      logDebug('Socket already connected');
      updateState({ socketConnected: true });
      return true;
    }
  }, [socket, logDebug, logError, updateState]);

  // Setup socket listeners
  const setupSocketListeners = useCallback(() => {
    if (!socket || socketListenersSet.current) return;

    try {
      logDebug('Setting up socket listeners');

      // ✅ Always remove existing listeners first
      socket.off('ride_end');
      socket.off('ride_cancelled');
      socket.off('your_ride_is_mark_complete_by_user');

      socket.on('ride_end', (data) => {
        logDebug('Ride completed event received', data);
        updateState({ rideCompleted: true });
        navigation.navigate('collect_money', { data: data?.rideDetails });
        showLocalNotification("Ride Completed", "The ride has been completed successfully!");
      });

      socket.on('ride_cancelled', (data) => {
        logDebug('Ride cancelled event received', data);
        startSound();
        navigation.navigate('Home');
        showLocalNotification("🚨 Ride Cancelled", "The ride has been cancelled by the customer.");
      });

      socket.on('your_ride_is_mark_complete_by_user', (data) => {
        logDebug('Ride completed by user event received', data);
        startSound();
        Alert.alert(
          'Ride Complete Confirmation',
          data?.message || 'User marked your ride as complete. Is that correct?',
          [
            {
              text: 'No',
              onPress: async () => {
                try {
                  logDebug('Driver denied ride completion');
                  const rideId = await getRideId();
                  if (rideId) {
                    const rideData = await foundRideDetails(rideId);
                    stopSound();
                    setTimeout(() => {
                      socket.emit('ride_incorrect_mark_done_user', { rideDetails: rideData });
                    }, 1500);
                  }
                } catch (error) {
                  stopSound();
                  logError('Error while denying ride completion', error);
                }
              },
              style: 'cancel',
            },
            {
              text: 'Yes',
              onPress: () => {
                logDebug('Driver confirmed ride completion');
                handleCompleteRide();
              },
            },
          ],
          { cancelable: false }
        );
      });

      socketListenersSet.current = true;
      logDebug('Socket listeners setup complete');
    } catch (error) {
      logError('Error setting up socket listeners', error);
    }
  }, [
    socket, logDebug, logError, updateState, navigation,
    startSound, stopSound, getRideId, foundRideDetails,
    handleCompleteRide
  ]);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    try {
      logDebug('Map is ready');
      updateState({ mapReady: true });

      // Fit map to show current location and pickup/drop
      if (mapRef.current && currentLocation) {
        setTimeout(() => {
          const coordinates = [
            currentLocation,
            state.rideStarted ? dropCoordinates : pickupCoordinates
          ].filter(coord => coord); // Filter out any null coordinates

          if (coordinates.length >= 2) {
            logDebug('Fitting map to coordinates');
            mapRef.current.fitToCoordinates(
              coordinates,
              {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              }
            );
          }
        }, 1000);
      }
    } catch (error) {
      logError('Error in map ready handler', error);
    }
  }, [
    logDebug, logError, updateState, currentLocation,
    state.rideStarted, dropCoordinates, pickupCoordinates
  ]);

  // ===== IMPROVED APP STATE HANDLER =====
  const handleAppStateChange = useCallback((nextAppState) => {
    const now = Date.now();
    const timeSinceLastChange = now - lastAppStateChange.current;

    // Throttle app state changes to prevent excessive logging
    if (timeSinceLastChange < 1000) { // Ignore changes within 1 second
      return;
    }

    lastAppStateChange.current = now;

    try {
      // Only log significant state changes
      const isSignificantChange =
        (appStateRef.current === 'active' && nextAppState !== 'active') ||
        (appStateRef.current !== 'active' && nextAppState === 'active');

      if (isSignificantChange && __DEV__) {
        console.log(`📱 App: ${appStateRef.current} → ${nextAppState}`);
      }

      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        // App became active - only perform necessary actions
        if (socket && !socket.connected) {
          connectSocket();
        } else if (socket && socket.connected && !socketListenersSet.current) {
          setupSocketListeners();
        }

        // Restart location tracking if needed
        startLocationTracking();
      }

      appStateRef.current = nextAppState;
    } catch (error) {
      logError('Error handling app state change', error);
    }
  }, [
    socket, connectSocket, setupSocketListeners, startLocationTracking, logError
  ]);

  // Show local notification (replacement for Expo notifications)
  const showLocalNotification = useCallback((title, body) => {
    // This is a simple Alert-based notification since we're removing Expo notifications
    // In a production app, you would use a proper notification library compatible with production builds
    if (AppState.currentState !== 'active') {
      // Only show alert if app is in foreground
      return;
    }

    setTimeout(() => {
      Alert.alert(title, body);
    }, 500);
  }, []);

  // ===== EFFECTS =====
  // Initialize component - runs only once
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    try {
      logDebug('Initializing component');

      // Connect socket
      connectSocket();

      // Start location tracking
      startLocationTracking();

      // Fetch cancel reasons
      fetchCancelReasons();

      // Start car animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(carIconAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(carIconAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true
          })
        ])
      ).start();

      // ===== FIXED APP STATE LISTENER SETUP =====
      // Remove existing subscription if any
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
      }

      // Create new subscription
      appStateSubscription.current = AppState.addEventListener('change', handleAppStateChange);

      // Initialize bottom sheet position
      bottomSheetTranslateY.setValue(BOTTOM_SHEET_MAX_HEIGHT - BOTTOM_SHEET_MIN_HEIGHT);

    } catch (error) {
      logError('Error in component initialization', error);
      updateState({
        loading: false,
        errorMsg: 'Failed to initialize. Please restart the app.'
      });
    }
  }, []); // Empty dependency array - runs only once

  // Cleanup effect
  useEffect(() => {
    return () => {
      logDebug('Component unmounting, cleaning up resources');
      isComponentMounted.current = false;

      // Remove app state listener
      if (appStateSubscription.current) {
        appStateSubscription.current.remove();
        appStateSubscription.current = null;
      }

      // Stop location tracking
      stopLocationTracking();

      // Stop sound
      stopSound();

      // Remove socket listeners
      if (socket) {
        socket.off('ride_end');
        socket.off('ride_cancelled');
        socket.off('your_ride_is_mark_complete_by_user');
        socketListenersSet.current = false;
      }

      // Stop animations
      carIconAnimation.stopAnimation();
      bottomSheetTranslateY.stopAnimation();
    };
  }, []); // Empty dependency array - cleanup only on unmount

  // Setup socket listeners when socket changes
  useEffect(() => {
    if (socket && socket.connected && !socketListenersSet.current) {
      setupSocketListeners();
    }
  }, [socket, setupSocketListeners]);

  // ===== RENDER COMPONENTS =====
  // Loading screen
  if (state.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={styles.loadingText}>Loading ride details...</Text>
      </View>
    );
  }

  // Error screen
  if (state.errorMsg) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={60} color="#FF3B30" />
        <Text style={styles.errorText}>{state.errorMsg}</Text>
        <View style={styles.errorButtonContainer}>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Extract needed properties from ride details
  const {
    drop_desc = rideDetails?.ride?.driver?.drop_desc || rideDetails?.ride?.driver?.rideDetails?.ride?.driver?.drop_desc || "",
    pickup_desc = rideDetails?.ride?.driver?.pickup_desc || rideDetails?.ride?.driver?.rideDetails?.ride?.driver?.pickup_desc || "",
    kmOfRide = rideDetails?.ride?.driver?.kmOfRide || rideDetails?.ride?.driver?.rideDetails?.ride?.driver?.kmOfRide || "0",
  } = rideDetails;

  // Main screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Map */}
      <RideMap
        mapRef={mapRef}
        driverCoordinates={driverCoordinates}
        pickupCoordinates={pickupCoordinates}
        dropCoordinates={dropCoordinates}
        currentLocation={currentLocation}
        rideStarted={state.rideStarted}
        mapReady={state.mapReady}
        socketConnected={state.socketConnected}
        carIconAnimation={carIconAnimation}
        handleMapReady={handleMapReady}
        openGoogleMapsDirectionsPickup={openGoogleMapsDirectionsPickup}
        openGoogleMapsDirections={openGoogleMapsDirections}
        pickup_desc={pickup_desc}
        drop_desc={drop_desc}
        updateState={updateState}
      />

      {/* Bottom Sheet */}
      <RideBottomSheet
        state={state}
        updateState={updateState}
        rideStarted={state.rideStarted}
        kmOfRide={kmOfRide}
        distanceToPickup={state.distanceToPickup}
        timeToPickup={state.timeToPickup}
        pickup_desc={pickup_desc}
        rideDetails={rideDetails}
        showOtpModel={() =>
          setState(prev => ({ ...prev, showOtpModal: true }))
        }

        drop_desc={drop_desc}
        showCancelModal={()=>{
          setState(prev => ({ ...prev, showCancelModal: true }))
        }}
        handleCompleteRide={handleCompleteRide}
        openGoogleMapsDirectionsPickup={openGoogleMapsDirectionsPickup}
        openGoogleMapsDirections={openGoogleMapsDirections}
        translateY={bottomSheetTranslateY}
        onGestureEvent={panResponder.panHandlers}
        maxHeight={BOTTOM_SHEET_MAX_HEIGHT}
        minHeight={BOTTOM_SHEET_MIN_HEIGHT}
      />

      {/* Modals */}
      <OtpModal
        appState={state}
        updateState={updateState}
        riderDetails={rideDetails}
        update={foundRideDetails}
        handleOtpSubmit={handleOtpSubmit}
      />

      <CancelReasonsModal
        appState={state}
        updateState={updateState}
        handleClose={()=>{
          setState(prev => ({ ...prev, showCancelModal: false }))
        }}
        
        handleCancelRide={handleCancelRide}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
    color: '#333',
  },
  errorButtonContainer: {
    marginTop: 30,
  },
  errorButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});