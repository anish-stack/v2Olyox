import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  ToastAndroid,
  Dimensions,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import * as Location from "expo-location";
import axios from "axios";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { tokenCache } from "../../Auth/cache";
import { useLocation } from "../../context/LocationContext";
import { useRide } from "../../context/RideContext";
import useNotificationPermission from "../../hooks/notification";
import MapViewDirections from "react-native-maps-directions";
import useSettings from "../../hooks/Settings";
import { useRideSearching } from "../../context/ride_searching";
import {
  DELHI_NCR_BOUNDS,
  VCOLORS,
  GOOGLE_MAPS_APIKEY,
  POLLING_INTERVAL,
  RIDER_CHECK_INTERVAL,
  BOOKING_TIMEOUT,
  decodePolyline,
} from "../../constants/colors";

const { width, height } = Dimensions.get("window");
const isAndroid = Platform.OS === "android";

const showNotification = (title, message, type = "info") => {
  // Skip if title is "Ride not found"
  if (title?.toLowerCase() === "ride not found") {
    return;
  }

  const displayMessage = `${title ? title + "\n" : ""}${message}`;

  if (Platform.OS === "android") {
    ToastAndroid.show(
      displayMessage,
      type === "error" || message.length > 60
        ? ToastAndroid.LONG
        : ToastAndroid.SHORT
    );
  } else {
    Alert.alert(
      title ||
      (type === "success"
        ? "Success!"
        : type === "error"
          ? "Error!"
          : "Notification"),
      message
    );
  }
};

const isLocationInDelhiNCR = (latitude, longitude) => {
  return (
    latitude >= DELHI_NCR_BOUNDS.south &&
    latitude <= DELHI_NCR_BOUNDS.north &&
    longitude >= DELHI_NCR_BOUNDS.west &&
    longitude <= DELHI_NCR_BOUNDS.east
  );
};

export default function BookingConfirmation() {
  const route = useRoute();
  const navigation = useNavigation();
  const { location: contextLocation } = useLocation();
  const { saveRide, updateRideStatus } = useRide();
  const {
    saveRideSearching,
    updateRideStatusSearching,
    clearCurrentRideSearching,
  } = useRideSearching();
  const { fcmToken } = useNotificationPermission();
  const { settings } = useSettings();
  const { origin, destination, selectedRide, dropoff, pickup } =
    route.params || {};

  // State management - optimized with better initial values
  const [currentLocation, setCurrentLocation] = useState(
    contextLocation?.coords || null
  );
  const [isLoadingLocation, setIsLoadingLocation] = useState(
    !contextLocation?.coords
  );
  const [isCreatingRide, setIsCreatingRide] = useState(false);
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [bookingStatusMessage, setBookingStatusMessage] = useState(
    "Preparing your ride..."
  );
  const [currentRideStatus, setCurrentRideStatus] = useState("pending");
  const [rideOtp, setRideOtp] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [createdRideId, setCreatedRideId] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [ridersNearYou, setRidersNearYou] = useState([]);
  const [isLoadingRiders, setIsLoadingRiders] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [ridePoolingEnabled, setRidePoolingEnabled] = useState(false);
  const [poolingTimer, setPoolingTimer] = useState(null);

  // Refs
  const pollingRef = useRef(null);
  const riderCheckRef = useRef(null);
  const bookingTimeoutRef = useRef(null);
  const poolingTimeoutRef = useRef(null);
  const mapRef = useRef(null);
  const isActiveRef = useRef(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastPollingTime = useRef(0);

  // Memoized values - optimized calculations
  const farePayload = useMemo(
    () => ({
      base_fare: selectedRide?.pricing?.baseFare || 0,
      distance_fare: selectedRide?.pricing?.distanceCost || 0,
      time_fare: selectedRide?.pricing?.timeCost || 0,
      platform_fee: selectedRide?.pricing?.fuelSurcharge || 0,
      night_charge: selectedRide?.pricing?.nightSurcharge || 0,
      rain_charge: selectedRide?.conditions?.rain
        ? selectedRide?.pricing?.rainCharge || 10
        : 0,
      toll_charge: selectedRide?.pricing?.tollCost || 0,
      discount: selectedRide?.pricing?.discount || 0,
      total_fare: selectedRide?.totalPrice,
      currency: selectedRide?.pricing?.currency || "INR",
      is_pooling: ridePoolingEnabled,
    }),
    [selectedRide, ridePoolingEnabled]
  );

  const isLocationValid = useMemo(() => {
    if (!origin || !destination) return false;
    return (
      isLocationInDelhiNCR(origin.latitude, origin.longitude) &&
      isLocationInDelhiNCR(destination.latitude, destination.longitude)
    );
  }, [origin, destination]);

  const vehicleIcon = useMemo(() => {
    const vehicleType =
      selectedRide?.vehicleType || selectedRide?.vehicleName || "";
    return vehicleType.toLowerCase().includes("bike") ||
      vehicleType.toLowerCase().includes("motorcycle")
      ? "motorbike"
      : "car";
  }, [selectedRide]);

  // Optimized map region calculation
  const mapRegion = useMemo(() => {
    if (!origin) return null;

    return {
      latitude: origin.latitude,
      longitude: origin.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [origin]);

  // Enhanced cleanup function
  const cleanup = useCallback(() => {
    [pollingRef, riderCheckRef, bookingTimeoutRef, poolingTimeoutRef].forEach(
      (ref) => {
        if (ref.current) {
          if (ref === pollingRef || ref === riderCheckRef) {
            clearInterval(ref.current);
          } else {
            clearTimeout(ref.current);
          }
          ref.current = null;
        }
      }
    );
  }, []);

  // Optimized stop booking process
  const stopBookingProcess = useCallback(
    (reason) => {
      console.log("Stopping booking process:", reason);
      setIsBookingInProgress(false);
      setRideCompleted(true);
      cleanup();
    },
    [cleanup]
  );

  // Enhanced fetch nearby riders with better error handling
  const fetchNearByRiders = useCallback(async () => {
    if (!origin || !selectedRide || !isActiveRef.current || isLoadingRiders)
      return;

    setIsLoadingRiders(true);
    setLocationError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await axios.post(
        "https://www.appv2.olyox.com/api/v1/new/find-rider-near-user",
        {
          lat: origin.latitude,
          lng: origin.longitude,
          vehicleType: selectedRide.vehicleName || selectedRide.vehicleType,
        },
        {
          timeout: 8000,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.data?.success && Array.isArray(response.data?.data)) {
        setRidersNearYou(response.data.data);
        console.log("Nearby riders found:", response.data.data.length);
      } else {
        setRidersNearYou([]);
      }
    } catch (error) {
      console.error("Error fetching nearby riders:", error);
      setRidersNearYou([]);

      if (error.name === "AbortError" || error.code === "ECONNABORTED") {
        setLocationError("Network timeout. Please check your connection.");
      } else if (error.response?.status >= 500) {
        setLocationError("Server error. Please try again.");
      } else {
        setLocationError("Unable to find nearby riders.");
      }
    } finally {
      setIsLoadingRiders(false);
    }
  }, []);

  // Optimized directions fetching
  const fetchDirections = useCallback(async () => {
    if (!origin || !destination || coordinates.length > 0) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await axios.post(
        "https://appapi.olyox.com/directions",
        {
          pickup: { latitude: origin.latitude, longitude: origin.longitude },
          dropoff: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
        {
          timeout: 10000,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (response.data?.polyline) {
        const decodedCoords = decodePolyline(response.data.polyline).map(
          ([lat, lng]) => ({
            latitude: lat,
            longitude: lng,
          })
        );
        setCoordinates(decodedCoords);
      }
    } catch (error) {
      console.error("Error fetching directions:", error);
      // Don't show error for directions as MapViewDirections will handle fallback
    }
  }, [origin, destination, coordinates.length]);

  // Enhanced location fetching
  const fetchLocation = useCallback(async () => {
    if (currentLocation) {
      setIsLoadingLocation(false);
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      if (contextLocation?.coords) {
        setCurrentLocation(contextLocation.coords);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission is required to book a ride.");
        showNotification(
          "Permission Denied",
          "Location permission required.",
          "error"
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 10000,
      });

      setCurrentLocation(position.coords);
    } catch (err) {
      console.error("Error getting location:", err);
      setLocationError("Unable to get your current location.");
      showNotification("Location Error", "Unable to get location.", "error");
    } finally {
      setIsLoadingLocation(false);
    }
  }, [contextLocation, currentLocation]);

  // Optimized polling with rate limiting
  const pollRideStatus = useCallback(async () => {
    if (
      !createdRideId ||
      !isBookingInProgress ||
      rideCompleted ||
      !isActiveRef.current
    )
      return;

    const now = Date.now();
    if (now - lastPollingTime.current < 4000) return; // Rate limiting
    lastPollingTime.current = now;

    try {
      const token = await tokenCache.getToken("auth_token_db");
      if (!token) {
        showNotification(
          "Authentication Error",
          "Please log in again.",
          "error"
        );
        stopBookingProcess("AUTH_ERROR_POLL");
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await axios.get(
        `https://www.appv2.olyox.com/api/v1/new/status/${createdRideId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (rideCompleted || !isActiveRef.current) return;

      const { status: newStatus, rideDetails, message } = response.data;

      setCurrentRideStatus(newStatus);
      setBookingStatusMessage(message || `Ride status: ${newStatus}`);

      switch (newStatus) {
        case "driver_assigned":
          showNotification(
            "Driver Assigned!",
            message || "Your ride is on the way.",
            "success"
          );
          saveRide({ ...rideDetails, ride_otp: rideOtp });
          clearCurrentRideSearching();
          updateRideStatus("confirmed");
          stopBookingProcess("DRIVER_ASSIGNED");
          navigation.replace("RideStarted", {
            driver: rideDetails?._id,
            origin,
            destination,
          });
          break;
        case "cancelled":
          clearCurrentRideSearching();
          showNotification(
            "Ride Cancelled",
            message || "Ride cancelled.",
            "info"
          );
          stopBookingProcess("CANCELLED_BY_SYSTEM");
          break;
        case "completed":
          clearCurrentRideSearching();
          showNotification(
            "Ride Completed!",
            message || "Thank you for riding.",
            "success"
          );
          stopBookingProcess("COMPLETED");
          break;
      }
    } catch (err) {
      console.error("Error polling ride status:", err);
      if (err.response?.status === 401 || err.response?.status === 404) {
        // Don't show error notification for every polling failure
        console.warn("Status polling failed, will retry...");
      }
    }
  }, [
    createdRideId,
    isBookingInProgress,
    rideCompleted,
    navigation,
    saveRide,
    updateRideStatus,
    origin,
    destination,
    rideOtp,
    stopBookingProcess,
  ]);

  // Enhanced ride creation
  const handleCreateRide = useCallback(async () => {
    if (
      !currentLocation ||
      !origin ||
      !destination ||
      !selectedRide ||
      !fcmToken
    ) {
      showNotification(
        "Missing Information",
        "Ensure location and ride details are selected.",
        "error"
      );
      return;
    }

    if (!isLocationValid) {
      Alert.alert(
        "Service Area",
        "We currently only accept bookings within Delhi NCR (Delhi, Gurgaon, Noida, Haryana). Please select locations within our service area.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsCreatingRide(true);
    setIsBookingInProgress(true);
    setRideCompleted(false);
    setBookingStatusMessage("Requesting your ride...");
    setCurrentRideStatus("pending");

    try {
      const token = await tokenCache.getToken("auth_token_db");
      if (!token) {
        showNotification(
          "Authentication Error",
          "Please log in again.",
          "error"
        );
        stopBookingProcess("AUTH_ERROR_CREATE");
        return;
      }

      const rideData = {
        vehicleType: selectedRide.vehicleType || selectedRide.vehicleName,
        pickupLocation: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
        dropLocation: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        currentLocation: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        pick_desc: pickup?.description,
        drop_desc: dropoff?.description,
        fare: farePayload,
        fcmToken,
        paymentMethod,
        platform: Platform.OS,
        scheduledAt: null,
        pickupAddress: pickup?.address || {},
        dropAddress: dropoff?.address || {},
        isPooling: ridePoolingEnabled,
      };

      const response = await axios.post(
        "https://www.appv2.olyox.com/api/v1/new/new-ride",
        rideData,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        }
      );

      if (response.data?.success && response.data.data?.rideId) {
        const rideDetails = response.data.data;
        saveRideSearching({ _id: response.data.data?.rideId });
        updateRideStatusSearching("searching");
        setCreatedRideId(rideDetails.rideId);

        if (rideDetails.ride_otp) setRideOtp(rideDetails.ride_otp);

        setBookingStatusMessage("Searching for drivers...");
        setCurrentRideStatus(rideDetails.ride_status || "searching");

        // Start ride pooling timer after successful ride creation
        poolingTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current && !rideCompleted) {
            setRidePoolingEnabled(true);
          }
        }, 10000);

        // Set booking timeout
        bookingTimeoutRef.current = setTimeout(() => {
          if (
            isBookingInProgress &&
            currentRideStatus !== "driver_assigned" &&
            !rideCompleted
          ) {
            showNotification(
              "No Drivers Found",
              "Could not find a driver. Try again later.",
              "info"
            );
            stopBookingProcess("TIMEOUT");
          }
        }, BOOKING_TIMEOUT);
      } else {
        throw new Error(response.data?.message || "Invalid server response.");
      }
    } catch (err) {
      console.error("Error creating ride:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to create ride.";
      // showNotification("Booking Failed", errorMessage, "error")
      stopBookingProcess("CREATE_RIDE_API_ERROR");
    } finally {
      setIsCreatingRide(false);
    }
  }, [
    currentLocation,
    origin,
    destination,
    selectedRide,
    fcmToken,
    pickup,
    dropoff,
    farePayload,
    paymentMethod,
    isBookingInProgress,
    currentRideStatus,
    rideCompleted,
    stopBookingProcess,
    isLocationValid,
    ridePoolingEnabled,
  ]);

  // Enhanced cancel booking
  const handleCancelBooking = useCallback(
    (isAutoCancel = false) => {
      const performCancel = async () => {
        try {
          stopBookingProcess("USER_CANCELLED");

          if (createdRideId) {
            const token = await tokenCache.getToken("auth_token_db");
            if (token) {
              await axios.post(
                `https://www.appv2.olyox.com/api/v1/new/cancel-before/${createdRideId}`,
                {},
                {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 10000,
                }
              );
            }
          }

          updateRideStatusSearching("cancel");
          clearCurrentRideSearching();
          setCreatedRideId(null);
          setRideOtp(null);
          setRidePoolingEnabled(false);

          if (!isAutoCancel) {
            showNotification(
              "Success",
              "Ride cancelled successfully.",
              "success"
            );
          }
        } catch (error) {
          console.error("Failed to cancel ride:", error);
          if (!isAutoCancel) {
            showNotification(
              "Cancel Failed",
              "Error cancelling ride.",
              "error"
            );
          }
        }
      };

      if (isAutoCancel) {
        performCancel();
      } else {
        Alert.alert(
          "Cancel Booking?",
          "Are you sure you want to cancel this ride?",
          [
            { text: "No", style: "cancel" },
            { text: "Yes", style: "destructive", onPress: performCancel },
          ]
        );
      }
    },
    [createdRideId, stopBookingProcess]
  );

  // Payment method selection (unchanged as requested)
  const handleChangePayment = useCallback(() => {
    Alert.alert(
      "Select Payment Method",
      "Choose your preferred payment method:",
      [
        { text: "Cash", onPress: () => setPaymentMethod("Cash") },
        { text: "UPI", onPress: () => setPaymentMethod("UPI") },
        { text: "Online", onPress: () => setPaymentMethod("Online") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }, []);

  // Get payment icon (unchanged as requested)
  const getPaymentIcon = useCallback(() => {
    switch (paymentMethod) {
      case "Cash":
        return "cash-multiple";
      case "UPI":
        return "cellphone-link";
      case "Online":
        return "credit-card-outline";
      default:
        return "credit-card-settings-outline";
    }
  }, [paymentMethod]);

  // Optimized map fitting
  const fitMapToMarkers = useCallback(() => {
    if (!mapRef.current || !origin || !destination || !mapReady) return;

    const coordinates = [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ];

    // Add rider coordinates if available
    ridersNearYou.forEach((rider) => {
      const lat = rider.location?.coordinates[1] ?? rider.lat;
      const lng = rider.location?.coordinates[0] ?? rider.lng;
      if (
        typeof lat === "number" &&
        typeof lng === "number" &&
        !isNaN(lat) &&
        !isNaN(lng)
      ) {
        coordinates.push({ latitude: lat, longitude: lng });
      }
    });

    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
        animated: true,
      });
    }, 300);
  }, [origin, destination, ridersNearYou, mapReady]);

  // Effects
  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      return () => {
        isActiveRef.current = false;
        if (isBookingInProgress && !rideCompleted) {
          cleanup();
        }
      };
    }, [isBookingInProgress, rideCompleted, cleanup, fadeAnim])
  );

  // Initialize location and directions
  useEffect(() => {
    fetchLocation();
    if (!isAndroid) {
      fetchDirections();
    }
  }, [fetchLocation, fetchDirections, isAndroid]);

  // Fetch nearby riders
  useEffect(() => {
    if (origin && selectedRide && !isLoadingLocation) {
      fetchNearByRiders();

      // Set up periodic rider checking
      riderCheckRef.current = setInterval(
        fetchNearByRiders,
        RIDER_CHECK_INTERVAL
      );

      return () => {
        if (riderCheckRef.current) {
          clearInterval(riderCheckRef.current);
          riderCheckRef.current = null;
        }
      };
    }
  }, [origin, selectedRide, isLoadingLocation, fetchNearByRiders]);

  // Fit map when ready
  useEffect(() => {
    if (mapReady && (ridersNearYou.length > 0 || (origin && destination))) {
      fitMapToMarkers();
    }
  }, [ridersNearYou, mapReady, fitMapToMarkers]);

  // Optimized status polling
  useEffect(() => {
    if (!createdRideId || !isBookingInProgress || rideCompleted) return;

    // Start polling after 3 seconds instead of 5
    const initialTimeout = setTimeout(() => {
      pollRideStatus();
      pollingRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
    }, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [createdRideId, isBookingInProgress, rideCompleted, pollRideStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Memoized components
  const Header = React.memo(() => (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Icon name="arrow-left" size={24} color={VCOLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Book Your Ride</Text>
      <View style={styles.headerButton} />
    </View>
  ));

  const ServiceAreaWarning = React.memo(() => {
    if (isLocationValid) return null;
    return (
      <View style={styles.warningCard}>
        <Icon name="alert-circle" size={24} color={VCOLORS.warning} />
        <View style={styles.warningTextContainer}>
          <Text style={styles.warningTitle}>Service Area Notice</Text>
          <Text style={styles.warningText}>
            We currently only accept bookings within Delhi NCR (Delhi, Gurgaon,
            Noida, Haryana).
          </Text>
        </View>
      </View>
    );
  });

  const RiderAvailabilityIndicator = React.memo(() => (
    <View style={styles.riderIndicatorCard}>
      <View style={styles.riderIndicatorHeader}>
        <Icon
          name={vehicleIcon}
          size={20}
          color={
            ridersNearYou.length > 0 ? VCOLORS.success : VCOLORS.text.secondary
          }
        />
        <Text style={styles.riderIndicatorTitle}>
          {isLoadingRiders
            ? "Checking..."
            : `${ridersNearYou.length} riders nearby`}
        </Text>
        {isLoadingRiders && (
          <ActivityIndicator size="small" color={VCOLORS.primary} />
        )}
      </View>
      {ridersNearYou.length === 0 && !isLoadingRiders && (
        <Text style={styles.riderIndicatorSubtext}>
          No riders available in your area right now. Please try again later.
        </Text>
      )}
      {locationError && <Text style={styles.errorText}>{locationError}</Text>}
    </View>
  ));

  const MapSection = React.memo(() => (
    <View style={styles.mapContainer}>
      {origin && destination && mapRegion ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={mapRegion}
          onMapReady={() => {
            setMapReady(true);
            setTimeout(fitMapToMarkers, 500);
          }}
          showsUserLocation={true}
          showsCompass={false}
          showsMyLocationButton={false}
          minZoomLevel={8}
          maxZoomLevel={18}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          {/* Pickup marker */}
          <Marker
            coordinate={{
              latitude: origin.latitude,
              longitude: origin.longitude,
            }}
            title="Pickup"
            description={pickup?.description || "Pickup location"}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.pickupMarker}>
              <Icon name="circle" size={16} color={VCOLORS.success} />
            </View>
          </Marker>

          {/* Drop-off marker */}
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Drop-off"
            description={dropoff?.description || "Destination"}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.dropoffMarker}>
              <Icon name="square" size={16} color={VCOLORS.danger} />
            </View>
          </Marker>

          {/* Available riders markers - optimized */}
          {ridersNearYou.slice(0, 10).map((rider, index) => {
            const lat = rider.location?.coordinates[1] ?? rider.lat ?? 28.6139;
            const lng = rider.location?.coordinates[0] ?? rider.lng ?? 77.209;

            // Small random offset to prevent overlapping
            const offsetLat = lat + (Math.random() - 0.5) * 0.0008;
            const offsetLng = lng + (Math.random() - 0.5) * 0.0008;

            return (
              <Marker
                key={`rider-${rider.id || index}`}
                coordinate={{ latitude: offsetLat, longitude: offsetLng }}
                title={`${vehicleIcon === "motorbike" ? "Bike" : "Car"} Rider`}
                description="Available for ride"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.riderMarker}>
                  <Icon name={vehicleIcon} size={16} color={VCOLORS.primary} />
                </View>
              </Marker>
            );
          })}

          {/* Route rendering - optimized */}
          {isAndroid ? (
            <MapViewDirections
              origin={{
                latitude: origin.latitude,
                longitude: origin.longitude,
              }}
              destination={{
                latitude: destination.latitude,
                longitude: destination.longitude,
              }}
              apikey={GOOGLE_MAPS_APIKEY}
              strokeWidth={3}
              strokeColor={VCOLORS.primary}
              mode="DRIVING"
              optimizeWaypoints={true}
              onError={(errorMessage) => {
                console.warn("MapViewDirections Error:", errorMessage);
              }}
            />
          ) : (
            coordinates.length > 0 && (
              <Polyline
                coordinates={coordinates}
                strokeWidth={3}
                strokeColor={VCOLORS.primary}
              />
            )
          )}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Icon name="map-outline" size={48} color={VCOLORS.text.tertiary} />
          <Text style={styles.mapPlaceholderText}>Loading map...</Text>
        </View>
      )}
    </View>
  ));

  const LocationCard = React.memo(() => (
    <View style={styles.locationCard}>
      <View style={styles.locationRow}>
        <View style={styles.locationIconContainer}>
          <View
            style={[styles.locationDot, { backgroundColor: VCOLORS.success }]}
          />
        </View>
        <View style={styles.locationTextContainer}>
          <Text style={styles.locationLabel}>PICKUP</Text>
          <Text style={styles.locationText} numberOfLines={2}>
            {pickup?.description || "Current Location"}
          </Text>
        </View>
      </View>
      <View style={styles.routeLine} />
      <View style={styles.locationRow}>
        <View style={styles.locationIconContainer}>
          <View
            style={[styles.locationDot, { backgroundColor: VCOLORS.danger }]}
          />
        </View>
        <View style={styles.locationTextContainer}>
          <Text style={styles.locationLabel}>DROP-OFF</Text>
          <Text style={styles.locationText} numberOfLines={2}>
            {dropoff?.description || "Selected Destination"}
          </Text>
        </View>
      </View>
    </View>
  ));

  const RideDetailsCard = React.memo(() => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Icon name={vehicleIcon} size={24} color={VCOLORS.primary} />
          <Text style={styles.cardTitle}>
            {selectedRide?.vehicleName || "Standard Vehicle"}
          </Text>
        </View>
        {selectedRide?.durationInMinutes && (
          <View style={styles.durationBadge}>
            <Icon name="clock-outline" size={16} color={VCOLORS.primary} />
            <Text style={styles.durationText}>
              {selectedRide.durationInMinutes.toFixed(0)} min
            </Text>
          </View>
        )}
      </View>

      <View style={styles.fareSection}>
        <Text style={styles.fareSectionTitle}>Fare Breakdown</Text>

        {/* Total Fare Before Discount */}
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Total Fare (Before Discount)</Text>
          <Text style={styles.fareValue}>
            ₹
            {selectedRide && settings
              ? (
                selectedRide.totalPrice *
                (1 + settings.ride_percentage_off / 100)
              ).toFixed(0)
              : "0"}
          </Text>
        </View>

        {/* Offer Discount Row */}
        {selectedRide && settings && (
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>
              Offer Discount ({settings.ride_percentage_off}%)
            </Text>
            <Text style={[styles.fareValue, { color: VCOLORS.success }]}>
              -₹
              {(
                (selectedRide.totalPrice * settings.ride_percentage_off) /
                100
              ).toFixed(0)}
            </Text>
          </View>
        )}

        {/* Actual Total Fare */}
        <View style={styles.totalFareRow}>
          <Text style={styles.totalFareLabel}>Total Fare</Text>
          <Text style={styles.totalFareValue}>
            ₹{selectedRide?.totalPrice?.toFixed(0) || "0"}
          </Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        ⚠️ Toll and MCD charges are not included in the fare. Please pay the
        driver separately if applicable.
      </Text>
    </View>
  ));

  const BookingProgressCard = React.memo(() => (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <ActivityIndicator size="large" color={VCOLORS.primary} />
        <Text style={styles.progressTitle}>Finding Your Driver</Text>
        <Text style={styles.progressMessage}>{bookingStatusMessage}</Text>
      </View>

      {ridePoolingEnabled && (
        <View style={styles.poolingNotice}>
          <Icon name="account-group" size={20} color={VCOLORS.primary} />
          <Text style={styles.poolingText}>
            Ride pooling enabled for better availability
          </Text>
        </View>
      )}

      <View style={styles.statusIndicator}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              (currentRideStatus === "searching" ||
                currentRideStatus === "pending") &&
              styles.statusDotActive,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              (currentRideStatus === "searching" ||
                currentRideStatus === "pending") &&
              styles.statusTextActive,
            ]}
          >
            Searching for drivers
          </Text>
        </View>
        <View style={styles.statusConnector} />
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              currentRideStatus === "driver_assigned" && styles.statusDotActive,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              currentRideStatus === "driver_assigned" &&
              styles.statusTextActive,
            ]}
          >
            Driver assigned
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => handleCancelBooking()}
        activeOpacity={0.7}
      >
        <Icon name="close-circle-outline" size={20} color={VCOLORS.danger} />
        <Text style={styles.cancelButtonText}>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  ));

  if (isLoadingLocation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={VCOLORS.background.primary}
        />
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={VCOLORS.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={VCOLORS.background.primary}
      />
      <Header />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <MapSection />
          <RiderAvailabilityIndicator />
          <ServiceAreaWarning />
          <LocationCard />
          {isBookingInProgress ? <BookingProgressCard /> : <RideDetailsCard />}
        </ScrollView>

        {!isBookingInProgress && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.paymentSelector}
              onPress={handleChangePayment}
              activeOpacity={0.7}
            >
              <Icon name={getPaymentIcon()} size={24} color={VCOLORS.primary} />
              <Text style={styles.paymentText}>{paymentMethod}</Text>
              <Icon
                name="chevron-down"
                size={20}
                color={VCOLORS.text.secondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.bookButton,
                (!selectedRide ||
                  !currentLocation ||
                  isCreatingRide ||
                  !isLocationValid) &&
                styles.bookButtonDisabled,
              ]}
              onPress={handleCreateRide}
              disabled={
                !selectedRide ||
                !currentLocation ||
                isCreatingRide ||
                !isLocationValid
              }
              activeOpacity={0.8}
            >
              {isCreatingRide ? (
                <ActivityIndicator size="small" color={VCOLORS.text.inverse} />
              ) : (
                <>
                  <Text style={styles.bookButtonText}>
                    {ridePoolingEnabled ? "Book Pool Ride" : "Book Ride"}
                  </Text>
                  <Text style={styles.bookButtonSubtext}>
                    ₹{selectedRide?.totalPrice?.toFixed(0) || "0"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: VCOLORS.background.primary,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: VCOLORS.background.primary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VCOLORS.border.light,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.light,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VCOLORS.background.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: VCOLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: VCOLORS.text.secondary,
    textAlign: "center",
  },
  mapContainer: {
    height: height * 0.35,
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: VCOLORS.background.secondary,
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: VCOLORS.text.tertiary,
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: VCOLORS.background.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: VCOLORS.success,
  },
  dropoffMarker: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: VCOLORS.background.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: VCOLORS.danger,
  },
  riderMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: VCOLORS.background.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: VCOLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.medium,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VCOLORS.warningLight,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: VCOLORS.warning,
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: VCOLORS.warning,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: VCOLORS.text.secondary,
    lineHeight: 16,
  },
  riderIndicatorCard: {
    backgroundColor: VCOLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.light,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  riderIndicatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  riderIndicatorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: VCOLORS.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  riderIndicatorSubtext: {
    fontSize: 12,
    color: VCOLORS.text.secondary,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 12,
    color: VCOLORS.danger,
    lineHeight: 16,
  },
  locationCard: {
    backgroundColor: VCOLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationIconContainer: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: VCOLORS.text.secondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    color: VCOLORS.text.primary,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: VCOLORS.border.medium,
    marginLeft: 11,
    marginVertical: 8,
  },
  card: {
    backgroundColor: VCOLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  cardTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: VCOLORS.text.primary,
    marginLeft: 12,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VCOLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  durationText: {
    fontSize: 12,
    fontWeight: "600",
    color: VCOLORS.primary,
    marginLeft: 4,
  },
  fareSection: {
    marginBottom: 16,
  },
  fareSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: VCOLORS.text.primary,
    marginBottom: 12,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: VCOLORS.text.secondary,
  },
  fareValue: {
    fontSize: 14,
    fontWeight: "500",
    color: VCOLORS.text.primary,
  },
  totalFareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VCOLORS.border.light,
    marginTop: 8,
  },
  totalFareLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: VCOLORS.text.primary,
  },
  totalFareValue: {
    fontSize: 18,
    fontWeight: "700",
    color: VCOLORS.primary,
  },
  disclaimer: {
    fontSize: 15,
    color: VCOLORS.text.tertiary,
    lineHeight: 16,
    fontWeight: "700",
    fontStyle: "italic",
  },
  progressCard: {
    backgroundColor: VCOLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  progressHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: VCOLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  progressMessage: {
    fontSize: 14,
    color: VCOLORS.text.secondary,
    textAlign: "center",
  },
  poolingNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: VCOLORS.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  poolingText: {
    fontSize: 12,
    color: VCOLORS.primary,
    fontWeight: "500",
    marginLeft: 8,
  },
  statusIndicator: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: VCOLORS.border.medium,
    marginRight: 12,
  },
  statusDotActive: {
    backgroundColor: VCOLORS.primary,
  },
  statusText: {
    fontSize: 14,
    color: VCOLORS.text.secondary,
  },
  statusTextActive: {
    color: VCOLORS.text.primary,
    fontWeight: "500",
  },
  statusConnector: {
    width: 2,
    height: 20,
    backgroundColor: VCOLORS.border.light,
    marginLeft: 5,
    marginVertical: 8,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: VCOLORS.dangerLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VCOLORS.danger,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: VCOLORS.danger,
    marginLeft: 8,
  },
  footer: {
    backgroundColor: VCOLORS.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VCOLORS.border.light,
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.dark,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  paymentSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VCOLORS.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: "500",
    color: VCOLORS.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  bookButton: {
    backgroundColor: VCOLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: VCOLORS.shadow.medium,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bookButtonDisabled: {
    backgroundColor: VCOLORS.border.medium,
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: VCOLORS.text.inverse,
    marginBottom: 2,
  },
  bookButtonSubtext: {
    fontSize: 14,
    color: VCOLORS.text.inverse,
    opacity: 0.9,
  },
});
