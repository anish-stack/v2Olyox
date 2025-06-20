import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  RefreshControl,
  StatusBar,
  Image,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import axios from "axios";
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons, Entypo } from "@expo/vector-icons";
import { useSocket } from "../../context/SocketContext";
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get("window");
const GOOGLE_MAPS_API_KEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8";
const API_BASE_URL = "http://192.168.1.6:3100/api/v1";
// Loading steps with more engaging descriptions
const LOADING_STEPS = [
  "Initializing your delivery request...",
  "Searching for nearby delivery partners...",
  "Calculating the fastest route for your parcel...",
  "Notifying available drivers in your area...",
  "Finalizing your delivery details...",
];

// Status colors for visual feedback
const STATUS_COLORS = {
  accepted: "#FF9800",
  "Reached at Pickup Location": "#2196F3",
  in_transit: "#4CAF50",
  "Reached at drop Location": "#9C27B0",
  delivered: "#4CAF50",
  cancelled: "#F44336",
};

// Status descriptions for user-friendly messages
const STATUS_DESCRIPTIONS = {
  accepted: "Driver has accepted your request and is on the way to pickup",
  "Reached at Pickup Location": "Driver has reached the pickup location",
  in_transit: "Your parcel is on the way to the destination",
  "Reached at drop Location": "Driver has reached the drop location",
  delivered: "Your parcel has been delivered successfully",
  cancelled: "This delivery has been cancelled",
};

export default function FindRider() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params;
  const mapRef = useRef(null);
  const scrollViewRef = useRef(null);
  const socketInstance = useSocket().socket();
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  // State
  const [driverLocation, setDriverLocation] = useState(null);
  const [parcelDetails, setParcelDetails] = useState(null);
  const [riderDetails, setRiderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riderFound, setRiderFound] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);
  const [parcelError, setParcelError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [statusUpdateTime, setStatusUpdateTime] = useState(null);
  const [showDriverInfo, setShowDriverInfo] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loadingStepAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const refreshIconAnim = useRef(new Animated.Value(0)).current;

  // Start pulse animation for markers
  useEffect(() => {
    const startPulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start(() => startPulseAnimation());
    };

    startPulseAnimation();
  }, [pulseAnim]);

  // Memoized values
  const coordinates = useMemo(() => {
    if (!parcelDetails?.locations) return null;
    return {
      pickup: {
        latitude: parcelDetails.locations.pickup.location.coordinates[1],
        longitude: parcelDetails.locations.pickup.location.coordinates[0],
      },
      dropoff: {
        latitude: parcelDetails.locations.dropoff.location.coordinates[1],
        longitude: parcelDetails.locations.dropoff.location.coordinates[0],
      },
    };
  }, [parcelDetails]);

  // Get current destination based on status
  const currentDestination = useMemo(() => {
    if (!coordinates || !parcelDetails) return null;

    const status = parcelDetails.status;
    if (status === "accepted" || status === "Reached at Pickup Location") {
      return coordinates.pickup;
    } else {
      return coordinates.dropoff;
    }
  }, [coordinates, parcelDetails]);

  // Fetch parcel details from API
  const fetchParcelDetails = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setRefreshing(true);
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/parcel/get-parcel/${id}`);
      const parcel = response?.data?.parcelDetails;

      if (!parcel) {
        throw new Error("No parcel data found.");
      }

      setParcelDetails(parcel);
      setRiderFound(parcel.driver_accept);
      setRiderDetails(parcel.rider_id);
      setStatusUpdateTime(new Date().toLocaleTimeString());

      // If a driver has accepted the parcel
      if (parcel.driver_accept) {
        const coords = parcel?.rider_id?.location?.coordinates;
        if (coords && coords.length === 2) {
          setDriverLocation({
            latitude: coords[1],
            longitude: coords[0],
          });
        }

        setLoading(false);
        animateSlideUp();
      }

      // Fit map to show all markers
      if (mapReady && mapRef.current) {
        fitMapToMarkers();
      }
    } catch (err) {
      console.error("Error fetching parcel details:", err);
      // Don't show technical errors to user
      if (!parcelError) {
        setParcelError({
          message: "Sorry, we couldn't find a rider at the moment. But your order has been successfully created — we'll assign a rider to you as soon as possible. Thank you for your patience!",
          parcel: id
        });
      }
    } finally {
      setRefreshing(false);
      if (showLoader) {
        setLoading(false);
        animateSlideUp();
      }
    }
  }, [id, mapReady, parcelError]);

  // Refresh data
  const onRefresh = useCallback(() => {
    // Animate refresh icon
    Animated.sequence([
      Animated.timing(refreshIconAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(refreshIconAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    fetchParcelDetails(true);
  }, [fetchParcelDetails]);

  // Start loading step animation
  const startLoadingStepAnimation = useCallback(() => {
    // Reset to first step
    setCurrentLoadingStep(0);

    // Animate through all steps
    const animateNextStep = (step) => {
      if (step >= LOADING_STEPS.length || !loading || parcelError) return;

      setTimeout(() => {
        setCurrentLoadingStep(step);
        animateNextStep(step + 1);
      }, 3000); // Change step every 3 seconds
    };

    animateNextStep(0);
  }, [loading, parcelError]);

  // Animate slide up for bottom sheet
  const animateSlideUp = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  // Fit map to show all markers
  const fitMapToMarkers = useCallback(() => {
    if (!mapRef.current || !coordinates) return;

    const points = [];
    if (coordinates.pickup) points.push(coordinates.pickup);
    if (coordinates.dropoff) points.push(coordinates.dropoff);
    if (driverLocation) points.push(driverLocation);

    if (points.length > 0) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 70, right: 70, bottom: 300, left: 70 },
        animated: true,
      });
    }
  }, [coordinates, driverLocation]);

  // Initialize component
  useEffect(() => {
    fetchParcelDetails();
    startLoadingStepAnimation();

    // Stop searching after 2 minutes if no driver is found
    const searchTimeout = setTimeout(() => {
      if (loading && !parcelError && !riderFound) {
        setLoading(false);
        setParcelError({
          message: "We couldn't find any available drivers at the moment. Please try again later.",
          parcel: id
        });
        animateSlideUp();
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearTimeout(searchTimeout);
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socketInstance) return;

    // Handle rider acceptance
    const handleParcelAcceptByRider = (data) => {
      console.log("Parcel Accepted by Rider:", data);
      if (data.parcel === id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchParcelDetails(false);
        setRiderFound(true);
        setLoading(false);
        animateSlideUp();
      }
    };

    // Handle parcel status updates
    const handleParcelStatusUpdate = (data) => {
      console.log("Parcel Status Update:", data);
      if (data.parcelId === id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchParcelDetails(false);
        setStatusUpdateTime(new Date().toLocaleTimeString());
      }
    };

    // Handle driver location updates
    const handleDriverLocationUpdate = (data) => {
      console.log("Driver Location Update:", data);
      if (data.parcelId === id && data.location) {
        setDriverLocation({
          latitude: data.location.coordinates[1],
          longitude: data.location.coordinates[0],
        });
      }
    };

    // Handle errors
    const handleParcelError = (data) => {
      console.log("Parcel Error:", data);
      if (data.parcelId === id) {
        setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setParcelError(data);
          setLoading(false);
          animateSlideUp();
        }, 5000)
      }
    };

    // Register socket event listeners
    socketInstance.on("parcel_accepted", handleParcelAcceptByRider);
    socketInstance.on("parcel_status_update", handleParcelStatusUpdate);
    socketInstance.on("driver_location_update", handleDriverLocationUpdate);
    socketInstance.on("parcel_error", handleParcelError);

    // Cleanup socket event listeners
    return () => {
      socketInstance.off("parcel_accepted", handleParcelAcceptByRider);
      socketInstance.off("parcel_status_update", handleParcelStatusUpdate);
      socketInstance.off("driver_location_update", handleDriverLocationUpdate);
      socketInstance.off("parcel_error", handleParcelError);
    };
  }, [socketInstance, id, fetchParcelDetails, animateSlideUp]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchParcelDetails(false);
      return () => { };
    }, [fetchParcelDetails])
  );

  // Handle cancel request
  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this delivery request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              setRefreshing(true);
              await axios.post(`${API_BASE_URL}/parcel/cancel-request/${id}`);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack()
              setRefreshing(false);
            } catch (error) {
              console.error("Error cancelling request:", error);
              Alert.alert(
                "Cancellation Failed",
                "We couldn't cancel your request at this time. Please try again."
              );
              setRefreshing(false);

            } finally {
              setRefreshing(false);
            }
          },
        },
      ]
    );
  }, [id, navigation]);

  // Call driver
  const callDriver = useCallback(() => {
    if (!riderDetails?.phone) {
      Alert.alert("Error", "Driver phone number is not available");
      return;
    }

    Linking.openURL(`tel:${riderDetails.phone}`);
  }, [riderDetails]);

  // Call support
  const callSupport = useCallback(() => {
    Linking.openURL("tel:+918888888888"); // Replace with actual support number
  }, []);

  // Render map with markers and directions
  const renderMap = () => (
    <View style={styles.mapContainer}>
      {coordinates && (
        <MapView
          ref={mapRef}
                 provider={isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}  // Use Google Maps on Android, default (Apple Maps) on iOS
       
          style={styles.map}
          initialRegion={{
            latitude: coordinates.pickup.latitude,
            longitude: coordinates.pickup.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onMapReady={() => {
            setMapReady(true);
            fitMapToMarkers();
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          showsTraffic={false}
        >
          {/* Pickup Marker */}
          <Marker coordinate={coordinates.pickup}>
            <Animated.View
              style={[
                styles.markerPickup,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <MaterialIcons name="local-shipping" size={18} color="#fff" />
            </Animated.View>
            <View style={styles.markerLabel}>
              <Text style={styles.markerText}>Pickup</Text>
            </View>
          </Marker>

          {/* Dropoff Marker */}
          <Marker coordinate={coordinates.dropoff}>
            <View style={styles.markerDropoff}>
              <Ionicons name="location" size={18} color="#fff" />
            </View>
            <View style={styles.markerLabel}>
              <Text style={styles.markerText}>Dropoff</Text>
            </View>
          </Marker>

          {/* Driver Marker */}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              tracksViewChanges={false}
            >
              <Animated.View
                style={[
                  styles.driverMarker,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <MaterialCommunityIcons name="motorbike" size={20} color="#fff" />
              </Animated.View>
            </Marker>
          )}

          {/* Directions: Driver to Pickup or Dropoff */}
          {driverLocation && currentDestination && (
            <MapViewDirections
              origin={driverLocation}
              destination={currentDestination}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={4}
              strokeColor="#FF5722"
              lineDashPattern={[0]}
              mode="DRIVING"
              optimizeWaypoints={true}
              onReady={(result) => {
                console.log(`Distance: ${result.distance} km`);
                console.log(`Duration: ${result.duration} min`);
              }}
            />
          )}

          {/* Directions: Pickup to Dropoff */}
          {coordinates.pickup && coordinates.dropoff && (
            <MapViewDirections
              origin={coordinates.pickup}
              destination={coordinates.dropoff}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={3}
              strokeColor="#2196F3"
              lineDashPattern={[5, 5]}
              mode="DRIVING"
            />
          )}
        </MapView>
      )}

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={fitMapToMarkers}
        >
          <MaterialIcons name="fullscreen" size={22} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setModalVisible(true)}
        >
          <Entypo name="dots-three-vertical" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlButton}
          onPress={onRefresh}
        >
          <Animated.View style={{
            transform: [{
              rotate: refreshIconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            }]
          }}>
            <MaterialIcons name="refresh" size={22} color="#333" />
          </Animated.View>
        </TouchableOpacity>

        {riderFound && (
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={callDriver}
          >
            <Ionicons name="call" size={22} color="#FF5722" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Badge */}
      {parcelDetails && (
        <View style={[
          styles.statusBadge,
          { backgroundColor: STATUS_COLORS[parcelDetails.status] || '#666' }
        ]}>
          <Text style={styles.statusText}>{parcelDetails.status}</Text>
          {statusUpdateTime && (
            <Text style={styles.statusTime}>Updated at {statusUpdateTime}</Text>
          )}
        </View>
      )}
    </View>
  );

  // Render loading overlay
  const renderLoadingOverlay = () => (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingCard}>
        <View style={styles.loadingStepsContainer}>
          {LOADING_STEPS.map((step, index) => (
            <View
              key={index}
              style={[
                styles.loadingStep,
                index === currentLoadingStep && styles.activeLoadingStep
              ]}
            >
              <View style={[
                styles.stepCircle,
                index === currentLoadingStep && styles.activeStepCircle
              ]}>
                {index < currentLoadingStep ? (
                  <MaterialIcons name="check" size={16} color="#fff" />
                ) : (
                  <Text style={[
                    styles.stepNumber,
                    index === currentLoadingStep && styles.activeStepNumber
                  ]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[
                styles.stepText,
                index === currentLoadingStep && styles.activeStepText
              ]}>{step}</Text>
            </View>
          ))}
        </View>

        <ActivityIndicator size="large" color="#FF5722" style={styles.loadingIndicator} />

        <Text style={styles.loadingText}>{LOADING_STEPS[currentLoadingStep]}</Text>

        <TouchableOpacity
          style={styles.cancelSearchButton}
          onPress={handleCancel}
        >
          <Text style={styles.cancelSearchText}>Cancel Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render no rider found
  const renderNoRiderFound = () => (
    <View style={styles.noRiderContainer}>
      {parcelError ? (
        <>
          <MaterialIcons name="error-outline" size={60} color="#FF5722" />
          <Text style={styles.errorTitle}>Driver Search Failed</Text>
          <Text style={styles.errorText}>
            {parcelError.message ||
              " Sorry, we couldn't find a rider at the moment. But your order has been successfully created — we'll assign a rider to you as soon"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              setParcelError(null);
              fetchParcelDetails();
              startLoadingStepAnimation();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <MaterialIcons name="search-off" size={60} color="#666" />
          <Text style={styles.noRiderTitle}>No Riders Found</Text>
          <Text style={styles.noRiderText}>
            We'll notify you as soon as a rider accepts your request. Thank you for your patience.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // Render parcel details
  const renderParcelDetails = () => {
    if (!parcelDetails) return null;

    return (
      <View style={styles.detailsCard}>
        {/* Status Description */}
        {parcelDetails.status && (
          <View style={[
            styles.statusDescriptionContainer,
            { borderLeftColor: STATUS_COLORS[parcelDetails.status] || '#666' }
          ]}>
            <Text style={styles.statusDescription}>
              {STATUS_DESCRIPTIONS[parcelDetails.status] || parcelDetails.status}
            </Text>
          </View>
        )}

        {/* Rider Found Badge */}
        {riderFound && (
          <TouchableOpacity
            style={styles.riderBadge}
            onPress={() => setShowDriverInfo(!showDriverInfo)}
          >
            <MaterialCommunityIcons name="motorbike" size={18} color="#007c91" style={{ marginRight: 8 }} />
            <Text style={styles.riderBadgeText}>
              {showDriverInfo ? "Hide driver details" : "View driver details"}
            </Text>
            <Ionicons
              name={showDriverInfo ? "chevron-up" : "chevron-down"}
              size={16}
              color="#007c91"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        )}

        {/* Driver Details (Collapsible) */}
        {riderFound && showDriverInfo && (
          <View style={styles.driverDetailsCard}>
            <View style={styles.driverHeader}>
              <View style={styles.driverAvatarContainer}>
                {riderDetails?.documents?.profile ? (
                  <Image
                    source={{ uri: riderDetails.documents.profile }}
                    style={styles.driverAvatar}
                  />
                ) : (
                  <View style={styles.driverAvatarPlaceholder}>
                    <MaterialIcons name="person" size={30} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{riderDetails?.name || "Driver"}</Text>
                {riderDetails?.rideVehicleInfo?.vehicleName && (
                  <Text style={styles.vehicleInfo}>
                    {riderDetails.rideVehicleInfo.vehicleName} • {riderDetails.rideVehicleInfo.VehicleNumber || ""}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.callDriverButton}
                onPress={callDriver}
              >
                <Ionicons name="call" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {riderDetails?.phone && (
              <TouchableOpacity
                style={styles.driverContactRow}
                onPress={callDriver}
              >
                <Ionicons name="call-outline" size={18} color="#666" style={{ marginRight: 8 }} />
                <Text style={styles.driverContactText}>{riderDetails.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Delivery Details */}
        <Text style={styles.cardTitle}>Delivery Details</Text>

        {/* Locations */}
        <View style={styles.locationContainer}>
          <View style={styles.locationIconContainer}>
            <View style={styles.pickupDot} />
          </View>
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Pickup</Text>
            <Text style={styles.address}>{parcelDetails.locations.pickup.address}</Text>
          </View>
        </View>

        <View style={styles.locationConnector}>
          <View style={styles.locationDivider} />
          <MaterialIcons name="arrow-downward" size={16} color="#666" style={styles.directionIcon} />
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationIconContainer}>
            <View style={styles.dropoffDot} />
          </View>
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Dropoff</Text>
            <Text style={styles.address}>{parcelDetails.locations.dropoff.address}</Text>
          </View>
        </View>

        {/* Fare Details */}
        <View style={styles.fareContainer}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Base Fare</Text>
            <Text style={styles.fareValue}>₹{parcelDetails.fares.baseFare}</Text>
          </View>

          {parcelDetails.fares.couponApplied && (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Discount</Text>
              <Text style={styles.discountValue}>-₹{parcelDetails.fares.discount}</Text>
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{parcelDetails.fares.payableAmount}</Text>
          </View>
        </View>

        {/* OTP Card */}
        {riderFound && parcelDetails.otp && (
          <View style={styles.otpCard}>
            <Text style={styles.otpHeading}>
              {parcelDetails.status === "in_transit" || parcelDetails.status === "Reached at drop Location"
                ? "Delivery Verification"
                : "Pickup Verification"}
            </Text>
            <Text style={styles.otpInstruction}>
              {parcelDetails.status === "in_transit" || parcelDetails.status === "Reached at drop Location"
                ? "Share this OTP with the driver when they arrive at the drop location"
                : "Share this OTP with the driver when they arrive at the pickup location"}
            </Text>
            <View style={styles.otpValueBox}>
              <Text style={styles.otpValueText}>{parcelDetails.otp}</Text>
            </View>
          </View>
        )}

        {/* Customer Info */}
        <View style={styles.customerInfoContainer}>
          <Text style={styles.customerInfoTitle}>Customer</Text>
          <Text style={styles.customerName}>{parcelDetails.customerId.name || parcelDetails.name || "Customer"}</Text>
          <Text style={styles.customerPhone}>{parcelDetails.customerId.number || parcelDetails.phone || "N/A"}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}


      {/* Map */}
      {renderMap()}

      {/* Loading Overlay */}
      {loading && renderLoadingOverlay()}

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.bottomSheetHandle} />

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.detailsScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#FF5722"]}
              tintColor="#FF5722"
            />
          }
        >
          {!riderFound && !loading && renderNoRiderFound()}
          {renderParcelDetails()}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {parcelDetails && !parcelDetails.is_pickup_complete && (

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Cancel Request</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate("Home")}
            disabled={refreshing}
          >
            <Text style={styles.buttonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Options Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Options</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                callSupport();
                setModalVisible(false);
              }}
            >
              <MaterialIcons name="support-agent" size={22} color="#2196F3" style={styles.modalOptionIcon} />
              <Text style={styles.modalOptionText}>Contact Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                onRefresh();
                setModalVisible(false);
              }}
            >
              <MaterialIcons name="refresh" size={22} color="#4CAF50" style={styles.modalOptionIcon} />
              <Text style={styles.modalOptionText}>Refresh Status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalOption, styles.cancelOption]}
              onPress={() => {
                setModalVisible(false);
                handleCancel();
              }}
            >
              <MaterialIcons name="cancel" size={22} color="#F44336" style={styles.modalOptionIcon} />
              <Text style={[styles.modalOptionText, styles.cancelText]}>Cancel Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  mapContainer: {
    height: "55%",
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mapControlButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  statusBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FF5722",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statusText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  statusTime: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10,
    marginTop: 2,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  loadingStepsContainer: {
    width: "100%",
    marginBottom: 30,
  },
  loadingStep: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    opacity: 0.5,
  },
  activeLoadingStep: {
    opacity: 1,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  activeStepCircle: {
    backgroundColor: "#FF5722",
  },
  stepNumber: {
    color: "#333",
    fontWeight: "bold",
  },
  activeStepNumber: {
    color: "#fff",
  },
  stepText: {
    fontSize: 14,
    color: "#666",
    flex: 1,
  },
  activeStepText: {
    color: "#333",
    fontWeight: "600",
  },
  loadingIndicator: {
    marginBottom: 15,
  },
  loadingText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },
  cancelSearchButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  cancelSearchText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "50%",
    paddingTop: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#ddd",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  detailsScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noRiderContainer: {
    alignItems: "center",
    padding: 20,
  },
  noRiderTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginVertical: 10,
    color: "#333",
  },
  noRiderText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginVertical: 10,
    color: "#FF5722",
  },
  errorText: {
    textAlign: "center",
    color: "#666",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#FF5722",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statusDescriptionContainer: {
    backgroundColor: "#f8f8f8",
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  statusDescription: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    color: "#333",
  },
  locationContainer: {
    flexDirection: "row",
    marginBottom: 4,
  },
  locationIconContainer: {
    width: 24,
    alignItems: "center",
    marginRight: 10,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF5722",
  },
  locationConnector: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: 17,
    height: 30,
  },
  locationDivider: {
    width: 2,
    height: 20,
    backgroundColor: "#ddd",
  },
  directionIcon: {
    marginTop: -4,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  address: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  fareContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: "#666",
  },
  fareValue: {
    fontSize: 14,
    color: "#333",
  },
  discountValue: {
    fontSize: 14,
    color: "#4CAF50",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF5722",
  },
  customerInfoContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  customerInfoTitle: {
    fontSize: 14,
    color: "#999",
    marginBottom: 5,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 3,
  },
  customerPhone: {
    fontSize: 14,
    color: "#666",
  },
  buttonContainer: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#FF3B30",
    padding: 15,
    borderRadius: 12,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButton: {
    flex: 1,
    backgroundColor: "#34C759",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  markerPickup: {
    backgroundColor: "#4CAF50",
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerDropoff: {
    backgroundColor: "#FF5722",
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
  },
  driverMarker: {
    backgroundColor: "#2196F3",
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerLabel: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: -5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  markerText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#333",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalOptionIcon: {
    marginRight: 16,
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
  },
  cancelOption: {
    borderBottomWidth: 0,
  },
  cancelText: {
    color: "#F44336",
  },
  riderBadge: {
    backgroundColor: "#e0f7fa",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginVertical: 10,
    borderColor: "#00acc1",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  riderBadgeText: {
    color: "#007c91",
    fontSize: 14,
    fontWeight: "600",
  },
  driverDetailsCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  driverAvatarContainer: {
    marginRight: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ddd",
  },
  driverAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    color: "#666",
  },
  callDriverButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF5722",
    justifyContent: "center",
    alignItems: "center",
  },
  driverContactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    marginTop: 8,
  },
  driverContactText: {
    fontSize: 14,
    color: "#666",
  },
  otpCard: {
    backgroundColor: "#fff3e0",
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    borderColor: "#ffa726",
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  otpHeading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ef6c00",
    marginBottom: 8,
  },
  otpInstruction: {
    fontSize: 14,
    color: "#6d4c41",
    marginBottom: 12,
  },
  otpValueBox: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#ffa726",
  },
  otpValueText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d84315",
    letterSpacing: 4,
  },
});