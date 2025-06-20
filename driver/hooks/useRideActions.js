import { useCallback, useEffect, useState } from "react"
import { Alert, Linking, Platform } from "react-native"
import * as IntentLauncher from "expo-intent-launcher"
import axios from "axios"
import { Audio } from "expo-av"
import { CommonActions, useNavigation } from '@react-navigation/native'
import * as SecureStore from 'expo-secure-store'
import { useRideStatus } from "../context/CheckRideHaveOrNot.context"
import { fetchUserData } from "../context/socketService"
const API_BASE_URL = "http://192.168.1.6:3100/api/v1"

export function useRideActions({ state, setState, rideDetails, socket, mapRef, soundRef }) {
  console.log("setState",setState)
  const navigation = useNavigation()
  const { onRide, updateRideStatus } = useRideStatus();

  const updateState = (newState) => {
    console.log("updateState",newState)
    setState((prevState) => ({ ...prevState, ...newState }))
  }

  // console.log("onRide",onRide)

  // Logging helper - only logs in development
  const logDebug = (message, data = null) => {
    if (__DEV__) {
      if (data) {
        console.log(`✔️ ${message}`, data)
      } else {
        console.log(`✔️ ${message}`)
      }
    }
  }

  const logError = (message, error = null) => {
    if (__DEV__) {
      if (error) {
        console.error(`❌ ${message}`, error)
      } else {
        console.error(`❌ ${message}`)
      }
    }
  }

  // ===== RIDE DETAILS =====
  const checkAuthToken = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');

      if (!token) {
        logError('No auth token found');
        return null;
      }

      const response = await axios.get(
        `${API_BASE_URL}/rider/user-details`,
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
  }, []);

  // Get ride ID from params or auth check
  const getRideId = useCallback(async () => {


    // If not, check from auth token
    const authRideId = await checkAuthToken();
    console.log(authRideId)
    if (authRideId) {
      logDebug('Using ride ID from auth check', authRideId);
      return authRideId;
    }

    return null;
  }, [checkAuthToken]);

  // Fetch ride details from API
  const fetchRideDetails = useCallback(async (rideId) => {
    if (!rideId) {
      logError('Cannot fetch ride details: No ride ID provided');
      updateState({ loading: false });
      Alert.alert("Error", "No ride ID found. Please try again.");
      return null;
    }

    try {
      logDebug('Fetching ride details', { rideId });
      const response = await axios.get(`http://192.168.1.6:3100/rider/${rideId}`);

      if (!response.data) {
        throw new Error('No ride data returned from API');
      }

      logDebug('Ride details fetched successfully');
      updateRideStatus(true)
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
        errorMsg: "Could not load ride details. Please try again."
      });
      Alert.alert("Error", "Failed to load ride details. Please check your connection and try again.");
      return null;
    }
  }, []);

  // Function to validate and get current ride details
  const getCurrentRideDetails = useCallback(async () => {
    // If ride details already exist, validate them
    if (rideDetails && rideDetails.ride) {
      logDebug("Using existing ride details");
      return rideDetails;
    }

    // Otherwise try to fetch them
    const rideId = await getRideId();
    if (!rideId) {
      logError("No ride ID available");
      Alert.alert("Error", "No active ride found. Please return to home screen.");
      resetToHome();
      return null;
    }

    const details = await fetchRideDetails(rideId);
    return details;
  }, [rideDetails, getRideId, fetchRideDetails]);

  // Start notification sound
  const startSound = useCallback(async () => {
    logDebug("Starting notification sound")

    try {
      // Stop previous sound if it exists
      if (soundRef.current) {
        await soundRef.current.stopAsync()
        await soundRef.current.unloadAsync() // Unload to prevent memory leak
        soundRef.current = null
      }

      // Load and play new sound
      const { sound } = await Audio.Sound.createAsync(
        require("./cancel.mp3"),
        {
          shouldPlay: true,
          isLooping: true,
        }
      )

      soundRef.current = sound
      updateState({ sound })

      // Wait a little and show alert
     

      logDebug("Sound started successfully")
    } catch (error) {
      logError("Error playing sound", error)
      Alert.alert("Notification Error", "Could not play notification sound.")
    }
  }, [])

  // Stop sound
  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      logDebug("Stopping sound")
      try {
        await soundRef.current.stopAsync()
        soundRef.current = null
        logDebug("Sound stopped successfully")
      } catch (error) {
        logError("Error stopping sound", error)
      }
    }
  }, [])

  // Reset navigation to home
  const resetToHome = useCallback(() => {
    logDebug("Resetting navigation to Home")
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      })
    );
  }, [navigation])

  // Fetch cancel reasons
  const fetchCancelReasons = useCallback(async () => {
    logDebug("Fetching cancel reasons")
    try {
      const { data } = await axios.get(`${API_BASE_URL}/admin/cancel-reasons?active=active`)

      if (data.data) {
        logDebug("Cancel reasons fetched successfully",data.data)
        updateState({ cancelReasons: data.data })
      } else {
        logDebug("No cancel reasons found")
        updateState({ cancelReasons: [] })
        Alert.alert("Warning", "No cancellation reasons available. Please try again later.")
      }
    } catch (error) {
      logError("Error fetching cancel reasons", error)
      updateState({ cancelReasons: [] })
      Alert.alert("Error", "Could not fetch cancellation reasons. Please check your connection.")
    }
  }, [])

  // Handle OTP submission
  const handleOtpSubmit = useCallback(async () => {
    const currentRideDetails = await getCurrentRideDetails();
    if (!currentRideDetails) {
      Alert.alert("Error", "Ride details not found. Please try again.");
      return;
    }

    // Safely get OTP from rideDetails
    const expectedOtp = currentRideDetails?.ride?.driver?.otp ||
      currentRideDetails?.rideDetails?.RideOtp || "";

    if (!expectedOtp) {
      Alert.alert("Error", "OTP information not available. Please contact support.");
      return;
    }
        logDebug("Submitting OTP", { state })


    if (!state.otp) {
      Alert.alert("Error", "Please enter the OTP to continue the.");
      return;
    }

    logDebug("Submitting OTP", { entered: state.otp, expected: expectedOtp })

    if (state.otp === expectedOtp) {
      logDebug("OTP verified successfully")
      const newState = {
        showOtpModal: false,
        rideStarted: true,
        showDirectionsType: "pickup_to_drop",
      }

      updateState(newState)

      // Emit ride started event
      if (socket && socket.connected) {
        logDebug("Emitting ride_started event")
        socket.emit("ride_started", currentRideDetails)
        setTimeout(() => {
          openGoogleMapsDirections()
        }, 2000)
      } else {
        Alert.alert("Warning", "Connection issue. The ride has started but notifications may be delayed.");
      }

      // Fit map to show pickup and drop locations
      try {
        if (mapRef.current) {
          const pickupCoords = getPickupCoordinates(currentRideDetails)
          const dropCoords = getDropCoordinates(currentRideDetails)

          if (pickupCoords && dropCoords) {
            setTimeout(() => {
              mapRef.current.fitToCoordinates(
                [
                  {
                    latitude: pickupCoords.latitude,
                    longitude: pickupCoords.longitude,
                  },
                  {
                    latitude: dropCoords.latitude,
                    longitude: dropCoords.longitude,
                  },
                ],
                {
                  edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                  animated: true,
                }
              )
            }, 1000)
          } else {
            logError("Missing coordinates for map fitting");
          }
        }
      } catch (error) {
        logError("Error fitting map to coordinates", error)
      }

      // Show local notification
      Alert.alert("Ride Started", "You have started the ride. Drive safely!")
    } else {
      logError("Incorrect OTP entered")
      Alert.alert("Incorrect OTP", "Please try again with the correct OTP.")
    }
  }, [state.otp, getCurrentRideDetails, socket, mapRef])

  // Handle cancel ride
  const handleCancelRide = useCallback(async () => {
    logDebug("Cancelling ride")

    try {
      const currentRideDetails = await getCurrentRideDetails();
      if (!currentRideDetails) {
        Alert.alert("Error", "Could not find ride details for cancellation.");
        return;
      }

      if (!state.selectedReason) {
        Alert.alert("Cancel Ride", "Please select a reason to cancel.");
        return;
      }

      const data = {
        cancelBy: "driver",
        rideData: currentRideDetails,
        reason: state.selectedReason,
      }

      if (!socket || !socket.connected) {
        logError("Socket not connected for ride cancellation")
        Alert.alert("Error", "Unable to cancel ride due to connection issues. Please try again.");
        return;
      }

      socket.emit("ride-cancel-by-user", data, (response) => {
        logDebug("Ride cancel response received", response)
        if (response && response.error) {
          Alert.alert("Error", response.error || "Failed to cancel ride. Please try again.");
          return;
        }
      })

      Alert.alert("Cancel", "Your pickup has been canceled. Thank you for your time.", [
        { text: "OK", onPress: () => resetToHome() },
      ])
      updateRideStatus(false)
   navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        })
      );


      updateState({ showCancelModal: false })
    } catch (error) {
      logError("Error in handleCancelRide", error)
      Alert.alert("Error", "Something went wrong while canceling the ride. Please try again.")
    }
  }, [state.selectedReason, getCurrentRideDetails, socket, resetToHome])

  // Complete ride
const handleCompleteRide = useCallback(async () => {
  try {
    // Get current ride details
    const currentRideDetails = await getCurrentRideDetails();
    if (!currentRideDetails) {
      Alert.alert("Error", "Could not find ride details to complete.");
      return;
    }

    // Get user data
    const user = await fetchUserData();
    if (!user || !user._id) {
      throw new Error("❌ Invalid user");
    }

    // Socket reconnection logic
    let activeSocket = socket;

    if (!activeSocket || !activeSocket.connected) {
      try {
        console.log("Socket not connected, attempting to reconnect...");
        activeSocket = await initializeSocket({
          userType: "driver",
          userId: user._id,
        });
      } catch (socketError) {
        console.error("Failed to initialize socket:", socketError);
      }
    }

    Alert.alert(
      "Complete Ride",
      "Are you sure you want to complete this ride?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            if (activeSocket && activeSocket.connected) {
              activeSocket.emit(
                "ride_end_by_rider",
                { rideDetails: currentRideDetails },
                (response) => {
                  if (response && response.error) {
                    Alert.alert("Error", response.error || "Failed to complete ride. Please try again.");
                    return;
                  }

                  Alert.alert("Success", "Ride completed successfully.", [
                    {
                      text: "OK",
                      onPress: () => {
                        updateRideStatus(false);
                        resetToHome();
                      },
                    },
                  ]);
                }
              );
            } else {
              // Fallback to API using axios
              try {
                const rideId = currentRideDetails.id || currentRideDetails._id;
                const response = await axios.post(
                  `${API_BASE_URL}/rider/rider-end-fallback/${rideId}`,
                  {
                    rideId,
                    userId: user._id,
                  }
                );

                const result = response.data;

                Alert.alert("Success", "Ride completed successfully.", [
                  {
                    text: "OK",
                    onPress: () => {
                      updateRideStatus(false);
                      resetToHome();
                    },
                  },
                ]);
              } catch (apiError) {
                console.error("API fallback failed:", apiError);
                const errorMsg =
                  apiError.response?.data?.message || "Could not complete ride. Please try again.";
                Alert.alert("Connection Error", errorMsg);
              }
            }
          },
        },
      ]
    );
  } catch (error) {
    console.error("Error in handleCompleteRide:", error);
    Alert.alert("Error", "An unexpected error occurred. Please try again.");
  }
}, [getCurrentRideDetails, socket, navigation, updateRideStatus, resetToHome]);


  // Socket event listeners
  useEffect(() => {
    if (socket && socket.connected) {
      socket.off('mark_as_done_rejected')
      socket.on('mark_as_done_rejected', (data) => {
        Alert.alert("Report Completed", data?.message || "Request rejected")
      })
    }

    return () => {
      if (socket) {
        socket.off('mark_as_done_rejected')
      }
    }
  }, [socket])

  // Helper functions to safely extract coordinates
  const getPickupCoordinates = useCallback((rideData = null) => {
    try {
      // Use passed ride data or fall back to the component's rideDetails
      const dataToUse = rideData || rideDetails;

      if (!dataToUse) {
        logError("No ride data available for pickup coordinates");
        return null;
      }

      // Try different possible paths to get pickup coordinates
      const pickupLocation = dataToUse?.ride?.rideDetails?.pickupLocation;

      if (!pickupLocation) {
        logError("Pickup location not found in ride data");
        return null;
      }

      if (pickupLocation?.coordinates && Array.isArray(pickupLocation.coordinates) && pickupLocation.coordinates.length >= 2) {
        return {
          latitude: pickupLocation.coordinates[1],
          longitude: pickupLocation.coordinates[0]
        }
      }

      logError("Invalid pickup coordinates format", pickupLocation);
      return null;
    } catch (error) {
      logError("Error getting pickup coordinates", error)
      return null
    }
  }, [rideDetails]);

  const getDropCoordinates = useCallback((rideData = null) => {
    try {
      // Use passed ride data or fall back to the component's rideDetails
      const dataToUse = rideData || rideDetails;

      if (!dataToUse) {
        logError("No ride data available for drop coordinates");
        return null;
      }

      // Try different possible paths to get drop coordinates
      const dropLocation =
        dataToUse?.ride?.rideDetails?.dropLocation ||
        dataToUse?.dropLocation;

      if (!dropLocation) {
        logError("Drop location not found in ride data");
        return null;
      }

      if (dropLocation?.coordinates && Array.isArray(dropLocation.coordinates) && dropLocation.coordinates.length >= 2) {
        return {
          latitude: dropLocation.coordinates[1],
          longitude: dropLocation.coordinates[0]
        }
      }

      logError("Invalid drop coordinates format", dropLocation);
      return null;
    } catch (error) {
      logError("Error getting drop coordinates", error)
      return null
    }
  }, [rideDetails]);

  // Open Google Maps for navigation
  const openGoogleMapsDirections = useCallback(async () => {
    try {
      const currentRideDetails = await getCurrentRideDetails();
      if (!currentRideDetails) {
        Alert.alert("Error", "Could not find ride details for navigation.");
        return;
      }

      // Determine if ride has started to decide which destination to use
      const rideStarted = currentRideDetails?.ride?.rideDetails?.isOtpVerify ||
        currentRideDetails?.ride?.rideDetails?.otp_verify_time;

      // Get coordinates based on ride status
      let destinationCoords;

      if (rideStarted) {
        // If ride has started, navigate to drop location
        const dropCoords = getDropCoordinates(currentRideDetails);
        if (dropCoords) {
          destinationCoords = `${dropCoords.latitude},${dropCoords.longitude}`;
          logDebug("Navigating to drop location");
        } else {
          Alert.alert("Error", "Drop location coordinates not available.");
          return;
        }
      } else {
        // If ride hasn't started, navigate to drop location
        const dropCoords = getDropCoordinates(currentRideDetails);
        if (dropCoords) {
          destinationCoords = `${dropCoords.latitude},${dropCoords.longitude}`;
          logDebug("Navigating to drop location");
        } else {
          Alert.alert("Error", "Drop location coordinates not available.");
          return;
        }
      }

      const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords}&travelmode=driving`;

      const canOpenUrl = await Linking.canOpenURL(url);
      if (canOpenUrl) {
        await Linking.openURL(url);
      } else {
        if (Platform.OS === "android") {
          try {
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
              data: url,
              flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
            });
          } catch (err) {
            logError("Error opening Google Maps with Intent Launcher", err);
            Alert.alert("Error", "Could not open Google Maps");
          }
        } else {
          logError("Cannot open Google Maps URL");
          Alert.alert("Error", "Could not open Google Maps");
        }
      }
    } catch (error) {
      logError("Error in openGoogleMapsDirections", error);
      Alert.alert("Error", "Could not open navigation. Please try again.");
    }
  }, [getCurrentRideDetails, getDropCoordinates]);

  const openGoogleMapsDirectionsPickup = useCallback(async () => {
    try {
      const currentRideDetails = await getCurrentRideDetails();
      if (!currentRideDetails) {
        Alert.alert("Error", "Could not find ride details for navigation.");
        return;
      }

      const pickupCoords = getPickupCoordinates(currentRideDetails);
      logDebug("pickupCoords", pickupCoords);

      if (!pickupCoords || !pickupCoords.latitude || !pickupCoords.longitude) {
        Alert.alert("Error", "Pickup coordinates are not available");
        return;
      }

      const pickup = `${pickupCoords.latitude},${pickupCoords.longitude}`;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${pickup}&travelmode=driving`;

      logDebug("Navigating to pickup location");

      const canOpenUrl = await Linking.canOpenURL(url);
      if (canOpenUrl) {
        await Linking.openURL(url);
      } else {
        if (Platform.OS === "android" && IntentLauncher) {
          try {
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
              data: url,
              flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
            });
          } catch (err) {
            logError("Error opening Google Maps with Intent Launcher", err);
            Alert.alert("Error", "Could not open Google Maps");
          }
        } else {
          logError("Cannot open Google Maps URL");
          Alert.alert("Error", "Could not open Google Maps");
        }
      }
    } catch (error) {
      logError("Error in openGoogleMapsDirectionsPickup", error);
      Alert.alert("Error", "Could not open navigation. Please try again.");
    }
  }, [getCurrentRideDetails, getPickupCoordinates]);

  return {
    handleOtpSubmit,
    handleCancelRide,
    handleCompleteRide,
    openGoogleMapsDirections,
    openGoogleMapsDirectionsPickup,
    startSound,
    stopSound,
    fetchCancelReasons,
    getCurrentRideDetails,
  }
}