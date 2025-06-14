import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Platform,
    StatusBar,
    ToastAndroid,
    Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import axios from "axios";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8'; 

import { tokenCache } from "../../Auth/cache";
import { useLocation } from "../../context/LocationContext";
import { useRide } from "../../context/RideContext";
import useNotificationPermission from "../../hooks/notification";

const POLLING_INTERVAL = 8000;
const BOOKING_TIMEOUT = 120000; // 2 minutes

// Modern Color Palette
const COLORS = {
    primary: "#6366F1", // Indigo
    primaryLight: "#A5B4FC",
    primaryDark: "#4338CA",
    
    secondary: "#F59E0B", // Amber
    secondaryLight: "#FDE68A",
    
    success: "#10B981", // Emerald
    successLight: "#D1FAE5",
    
    danger: "#EF4444", // Red
    dangerLight: "#FEE2E2",
    
    warning: "#F59E0B", // Amber
    warningLight: "#FEF3C7",
    
    text: {
        primary: "#111827",
        secondary: "#6B7280",
        tertiary: "#9CA3AF",
        inverse: "#FFFFFF",
    },
    
    background: {
        primary: "#FFFFFF",
        secondary: "#F9FAFB",
        tertiary: "#F3F4F6",
    },
    
    border: {
        light: "#E5E7EB",
        medium: "#D1D5DB",
        dark: "#9CA3AF",
    },
    
    overlay: "rgba(0, 0, 0, 0.5)",
};

// Helper function for platform-specific notifications
const showNotification = (title, message, type = "info") => {
    const displayMessage = `${title ? title + "\n" : ""}${message}`;
    let notificationTitle = title || "Notification";

    if (Platform.OS === 'android') {
        let duration = ToastAndroid.SHORT;
        if (type === 'error' || message.length > 60) {
            duration = ToastAndroid.LONG;
        }
        ToastAndroid.show(displayMessage, duration);
    } else {
        if (type === 'success') notificationTitle = title || "Success!";
        if (type === 'error') notificationTitle = title || "Error!";
        Alert.alert(notificationTitle, message);
    }
};

export default function BookingConfirmation() {
    const route = useRoute();
    const navigation = useNavigation();
    const { location: contextLocation } = useLocation();
    const { saveRide, updateRideStatus: updateRideContextStatus } = useRide();
    const { fcmToken } = useNotificationPermission();

    const { origin, destination, selectedRide, dropoff, pickup } = route.params || {};

    const [currentLocation, setCurrentLocation] = useState(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [isCreatingRide, setIsCreatingRide] = useState(false);
    const [isBookingInProgress, setIsBookingInProgress] = useState(false);
    const [bookingStatusMessage, setBookingStatusMessage] = useState("Preparing your ride...");
    const [currentRideStatus, setCurrentRideStatus] = useState("pending");
    const [rideOtp, setRideOtp] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [createdRideId, setCreatedRideId] = useState(null);

    const pollingRef = useRef(null);
    const bookingTimeoutRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        const fetchLocation = async () => {
            setIsLoadingLocation(true);
            try {
                if (contextLocation?.coords) {
                    setCurrentLocation(contextLocation.coords);
                } else {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== "granted") {
                        showNotification("Permission Denied", "Location permission is required to book a ride.", "error");
                        setIsLoadingLocation(false);
                        return;
                    }
                    const position = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });
                    setCurrentLocation(position.coords);
                }
            } catch (err) {
                console.error("Error getting location:", err);
                showNotification("Location Error", "Unable to get your current location. Please try again.", "error");
            }
            setIsLoadingLocation(false);
        };
        fetchLocation();
    }, [contextLocation]);

    useEffect(() => {
        if (!createdRideId || !isBookingInProgress) {
            return;
        }

        const pollRideStatus = async () => {
            try {
                const token = await tokenCache.getToken("auth_token_db");
                if (!token) {
                    showNotification("Authentication Error", "Please log in again.", "error");
                    stopBookingProcess("AUTH_ERROR_POLL");
                    return;
                }

                const response = await axios.get(
                    `http://192.168.1.23:3100/api/v1/new/status/${createdRideId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: POLLING_INTERVAL - 1000,
                    }
                );

                const { status: newStatus, rideDetails: polledRideDetails, message: pollMessage } = response.data;
                setCurrentRideStatus(newStatus);
                setBookingStatusMessage(pollMessage || `Ride status: ${newStatus}`);

                switch (newStatus) {
                    case 'driver_assigned':
                        showNotification("Driver Assigned!", pollMessage || "Your ride is on the way.", "success");
                        saveRide({ ...polledRideDetails, ride_otp: rideOtp });
                        updateRideContextStatus("confirmed");
                        stopBookingProcess("DRIVER_ASSIGNED");
                        navigation.replace("DriverTrackingScreen", {
                            ride: { ...polledRideDetails, ride_otp: rideOtp },
                            origin,
                            destination,
                        });
                        break;
                    case 'cancelled':
                        showNotification("Ride Cancelled", pollMessage || "Your ride has been cancelled.", "info");
                        stopBookingProcess("CANCELLED_BY_SYSTEM");
                        break;
                    case 'completed':
                        showNotification("Ride Completed!", pollMessage || "Thank you for riding with us.", "success");
                        stopBookingProcess("COMPLETED");
                        break;
                    case 'pending':
                    case 'searching':
                    case 'driver_arrived':
                    case 'in_progress':
                        break;
                    default:
                        console.warn("Unhandled ride status from polling:", newStatus);
                        break;
                }
            } catch (err) {
                console.error("Error polling ride status:", err.response?.data || err.message);
                if (err.response && (err.response.status === 401 || err.response.status === 404)) {
                    showNotification("Status Check Error", "Could not verify ride status. Please try again or contact support.", "error");
                    stopBookingProcess("POLL_API_ERROR");
                }
            }
        };

        pollingRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
        pollRideStatus();

        return () => {
            clearInterval(pollingRef.current);
        };
    }, [createdRideId, isBookingInProgress, navigation, saveRide, updateRideContextStatus, origin, destination, rideOtp]);

    const stopBookingProcess = (reason) => {
        console.log("Stopping booking process, reason:", reason);
        setIsBookingInProgress(false);
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (bookingTimeoutRef.current) clearTimeout(bookingTimeoutRef.current);
    };

    const handleCreateRide = async () => {
        if (!currentLocation || !origin || !destination || !selectedRide || !fcmToken) {
            showNotification("Missing Information", "Please ensure location is enabled and all ride details are selected.", "error");
            return;
        }

        setIsCreatingRide(true);
        setIsBookingInProgress(true);
        setBookingStatusMessage("Requesting your ride...");
        setCurrentRideStatus("pending");

        try {
            const token = await tokenCache.getToken("auth_token_db");
            if (!token) {
                showNotification("Authentication Error", "Please log in again to book a ride.", "error");
                stopBookingProcess("AUTH_ERROR_CREATE");
                setIsCreatingRide(false);
                return;
            }

            const farePayload = {
                base_fare: selectedRide.pricing?.baseFare || 0,
                distance_fare: selectedRide.pricing?.distanceCost || 0,
                time_fare: selectedRide.pricing?.timeCost || 0,
                platform_fee: selectedRide.pricing?.fuelSurcharge || 0,
                night_charge: selectedRide.pricing?.nightSurcharge || 0,
                rain_charge: selectedRide.conditions?.rain ? (selectedRide.pricing?.rainCharge || 10) : 0,
                toll_charge: selectedRide.pricing?.tollCost || 0,
                discount: selectedRide.pricing?.discount || 0,
                total_fare: selectedRide.totalPrice,
                currency: selectedRide.pricing?.currency || 'INR',
            };

            const rideData = {
                vehicleType: selectedRide.vehicleType || selectedRide.vehicleName,
                pickupLocation: { latitude: origin.latitude, longitude: origin.longitude },
                dropLocation: { latitude: destination.latitude, longitude: destination.longitude },
                currentLocation: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                pick_desc: pickup?.description,
                drop_desc: dropoff?.description,
                fare: farePayload,
                fcmToken: fcmToken,
                paymentMethod: paymentMethod,
                platform: Platform.OS,
                scheduledAt: null,
                pickupAddress: pickup?.address || {},
                dropAddress: dropoff?.address || {},
            };

            const response = await axios.post(
                "http://192.168.1.23:3100/api/v1/new/new-ride",
                rideData,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 20000,
                }
            );

            if (response.data && response.data.success && response.data.data && response.data.data.rideId) {
                const rideDetailsFromCreate = response.data.data;
                setCreatedRideId(rideDetailsFromCreate.rideId);
                if (rideDetailsFromCreate.ride_otp) {
                    setRideOtp(rideDetailsFromCreate.ride_otp);
                }
                showNotification("Ride Requested!", response.data.message || "Searching for drivers...", "success");
                setBookingStatusMessage("Searching for nearby drivers...");
                setCurrentRideStatus(rideDetailsFromCreate.ride_status || "searching");

                bookingTimeoutRef.current = setTimeout(() => {
                    if (isBookingInProgress && currentRideStatus !== 'driver_assigned') {
                        showNotification("No Drivers Found", "We couldn't find a driver for you at this moment. Please try again later.", "info");
                        stopBookingProcess("TIMEOUT");
                    }
                }, BOOKING_TIMEOUT);
            } else {
                const errorMessage = response.data?.message || "Invalid response from server when creating ride.";
                throw new Error(errorMessage);
            }
        } catch (err) {
            console.error("Error creating ride:", err.response?.data?.error || err.response?.data.message || err);
            const apiErrorMessage = err.response?.data?.error || err.response?.data.message || err || "Failed to create ride request.";
            showNotification("Booking Failed", apiErrorMessage, "error");
            stopBookingProcess("CREATE_RIDE_API_ERROR");
        } finally {
            setIsCreatingRide(false);
        }
    };

    const handleCancelBooking = () => {
        Alert.alert(
            "Cancel Booking?",
            "Are you sure you want to cancel this booking request?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                        stopBookingProcess("USER_CANCELLED");
                        showNotification("Booking Cancelled", "Your ride request has been cancelled.", "info");
                        if (createdRideId) {
                            console.log("TODO: Call API to cancel ride", createdRideId);
                        }
                        setCreatedRideId(null);
                        setRideOtp(null);
                    },
                },
            ]
        );
    };

    const handleChangePayment = () => {
        Alert.alert(
            "Select Payment Method",
            "Choose your preferred payment method:",
            [
                { text: "Cash", onPress: () => setPaymentMethod("Cash") },
                { text: "UPI", onPress: () => setPaymentMethod("UPI") },
                { text: "Online", onPress: () => setPaymentMethod("Online") },
                { text: "Cancel", style: "cancel" },
            ],
            { cancelable: true }
        );
    };

    const getPaymentIcon = () => {
        switch (paymentMethod) {
            case "Cash": return "cash-multiple";
            case "UPI": return "cellphone-link";
            case "Online": return "credit-card-outline";
            default: return "credit-card-settings-outline";
        }
    };

    const fitMapToMarkers = () => {
        if (mapRef.current && origin && destination) {
            const coordinates = [
                { latitude: origin.latitude, longitude: origin.longitude },
                { latitude: destination.latitude, longitude: destination.longitude }
            ];
            
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }
    };

    const Header = () => (
        <View style={styles.headerContainer}>
            <TouchableOpacity
                style={styles.headerButton}
                onPress={() => {
                    if (isBookingInProgress) {
                        handleCancelBooking();
                    } else {
                        navigation.goBack();
                    }
                }}
            >
                <Icon name="arrow-left" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Book Your Ride</Text>
            <View style={styles.headerButton} />
        </View>
    );

    const MapSection = () => (
        <View style={styles.mapContainer}>
            {origin && destination ? (
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={{
                        latitude: (origin.latitude + destination.latitude) / 2,
                        longitude: (origin.longitude + destination.longitude) / 2,
                        latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 2 || 0.01,
                        longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 2 || 0.01,
                    }}
                    onMapReady={fitMapToMarkers}
                >
                    {/* Pickup Marker */}
                    <Marker
                        coordinate={{
                            latitude: origin.latitude,
                            longitude: origin.longitude,
                        }}
                        title="Pickup Location"
                        description={pickup?.description || "Your pickup location"}
                        pinColor={COLORS.success}
                    >
                        <View style={styles.customMarker}>
                            <Icon name="map-marker-circle" size={30} color={COLORS.success} />
                        </View>
                    </Marker>

                    {/* Drop Marker */}
                    <Marker
                        coordinate={{
                            latitude: destination.latitude,
                            longitude: destination.longitude,
                        }}
                        title="Drop Location"
                        description={dropoff?.description || "Your destination"}
                        pinColor={COLORS.danger}
                    >
                        <View style={styles.customMarker}>
                            <Icon name="flag-checkered" size={30} color={COLORS.danger} />
                        </View>
                    </Marker>

                    {/* Route Direction */}
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
                        strokeWidth={4}
                        strokeColor={COLORS.primary}
                        optimizeWaypoints={true}
                        onError={(errorMessage) => {
                            console.log('Direction error: ', errorMessage);
                        }}
                    />
                </MapView>
            ) : (
                <View style={styles.mapPlaceholder}>
                    <Icon name="map-outline" size={48} color={COLORS.text.tertiary} />
                    <Text style={styles.mapPlaceholderText}>Map loading...</Text>
                </View>
            )}
        </View>
    );

    const LocationCard = () => (
        <View style={styles.locationCard}>
            <View style={styles.locationRow}>
                <View style={styles.locationIconContainer}>
                    <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
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
                    <View style={[styles.locationDot, { backgroundColor: COLORS.danger }]} />
                </View>
                <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>DROP-OFF</Text>
                    <Text style={styles.locationText} numberOfLines={2}>
                        {dropoff?.description || "Selected Destination"}
                    </Text>
                </View>
            </View>
        </View>
    );

    const RideDetailsCard = () => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Ride Details</Text>
                {selectedRide?.durationInMinutes && (
                    <View style={styles.durationBadge}>
                        <Icon name="clock-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.durationText}>
                            {selectedRide.durationInMinutes.toFixed(0)} min
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.vehicleInfo}>
                <Icon name="car" size={24} color={COLORS.text.secondary} />
                <Text style={styles.vehicleText}>
                    {selectedRide?.vehicleName || "Standard Vehicle"}
                </Text>
            </View>

            <View style={styles.fareSection}>
                <Text style={styles.fareSectionTitle}>Fare Breakdown</Text>
                <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Base Fare</Text>
                    <Text style={styles.fareValue}>
                        ₹{selectedRide?.totalPrice?.toFixed(0) || "0"}
                    </Text>
                </View>
               
               
                <View style={styles.totalFareRow}>
                    <Text style={styles.totalFareLabel}>Total Fare</Text>
                    <Text style={styles.totalFareValue}>
                        ₹{selectedRide?.totalPrice?.toFixed(0) || "0"}
                    </Text>
                </View>
            </View>

            <Text style={styles.disclaimer}>
                * Final fare may vary based on actual distance, traffic conditions, and tolls.
            </Text>
        </View>
    );

    const BookingProgressCard = () => (
        <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.progressTitle}>Finding Your Driver</Text>
                <Text style={styles.progressMessage}>{bookingStatusMessage}</Text>
            </View>

            <View style={styles.statusIndicator}>
                <View style={styles.statusRow}>
                    <View style={[
                        styles.statusDot,
                        (currentRideStatus === 'pending' || currentRideStatus === 'searching') && styles.statusDotActive
                    ]} />
                    <Text style={styles.statusText}>Searching for drivers</Text>
                </View>
                <View style={styles.statusConnector} />
                <View style={styles.statusRow}>
                    <View style={[
                        styles.statusDot,
                        currentRideStatus === 'driver_assigned' && styles.statusDotActive
                    ]} />
                    <Text style={styles.statusText}>Driver assigned</Text>
                </View>
            </View>

            {rideOtp && (
                <View style={styles.otpSection}>
                    <Text style={styles.otpLabel}>Your Ride OTP</Text>
                    <Text style={styles.otpValue}>{rideOtp}</Text>
                </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelBooking}>
                <Icon name="close-circle-outline" size={20} color={COLORS.danger} />
                <Text style={styles.cancelButtonText}>Cancel Request</Text>
            </TouchableOpacity>
        </View>
    );

    if (isLoadingLocation) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.primary} />
                <Header />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Getting your location...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.primary} />
            <Header />
            
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
            >
                <MapSection />
                <LocationCard />
                
                {isBookingInProgress ? (
                    <BookingProgressCard />
                ) : (
                    <RideDetailsCard />
                )}
            </ScrollView>

            {!isBookingInProgress && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.paymentSelector} onPress={handleChangePayment}>
                        <Icon name={getPaymentIcon()} size={24} color={COLORS.primary} />
                        <Text style={styles.paymentText}>{paymentMethod}</Text>
                        <Icon name="chevron-down" size={20} color={COLORS.text.secondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.bookButton,
                            (!selectedRide || !currentLocation || isCreatingRide) && styles.bookButtonDisabled,
                        ]}
                        onPress={handleCreateRide}
                        disabled={!selectedRide || !currentLocation || isCreatingRide}
                    >
                        {isCreatingRide ? (
                            <ActivityIndicator color={COLORS.text.inverse} size="small" />
                        ) : (
                            <>
                                <Text style={styles.bookButtonText}>Book Ride</Text>
                                <Text style={styles.bookButtonSubtext}>
                                    ₹{selectedRide?.totalPrice?.toFixed(0) || "0"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background.primary,
    },
    
    // Header Styles
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.light,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background.secondary,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        textAlign: 'center',
    },

    // Scroll View Styles
    scrollView: {
        flex: 1,
    },
    scrollContainer: {
        paddingBottom: 20,
    },

    // Loading Styles
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },

    // Map Styles
    mapContainer: {
        height: height * 0.35,
        margin: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    map: {
        flex: 1,
    },
    mapPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background.tertiary,
    },
    mapPlaceholderText: {
        marginTop: 8,
        fontSize: 14,
        color: COLORS.text.tertiary,
    },
    customMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Location Card Styles
    locationCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.background.primary,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    locationIconContainer: {
        marginRight: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
    },
    locationDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    routeLine: {
        width: 2,
        height: 32,
        backgroundColor: COLORS.border.medium,
        marginLeft: 11,
        marginVertical: 8,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text.tertiary,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    locationText: {
        fontSize: 15,
        color: COLORS.text.primary,
        lineHeight: 20,
    },

    // Card Styles
    card: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.background.primary,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    durationText: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.primary,
    },

    // Vehicle Info Styles
    vehicleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.background.secondary,
        borderRadius: 12,
    },
    vehicleText: {
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text.primary,
    },

    // Fare Section Styles
    fareSection: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border.light,
        paddingTop: 16,
    },
    fareSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 12,
    },
    fareRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    fareLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
    },
    fareValue: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text.primary,
    },
    totalFareRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border.light,
    },
    totalFareLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    totalFareValue: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.primary,
    },
    disclaimer: {
        fontSize: 12,
        color: COLORS.text.tertiary,
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
        lineHeight: 16,
    },

    // Progress Card Styles
    progressCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.background.primary,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 2,
        borderColor: COLORS.primaryLight,
    },
    progressHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    progressTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginTop: 12,
        marginBottom: 8,
    },
    progressMessage: {
        fontSize: 14,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },

    // Status Indicator Styles
    statusIndicator: {
        marginBottom: 20,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.border.medium,
        marginRight: 12,
    },
    statusDotActive: {
        backgroundColor: COLORS.primary,
    },
    statusText: {
        fontSize: 14,
        color: COLORS.text.secondary,
    },
    statusConnector: {
        width: 2,
        height: 20,
        backgroundColor: COLORS.border.light,
        marginLeft: 5,
        marginVertical: 4,
    },

    // OTP Section Styles
    otpSection: {
        backgroundColor: COLORS.successLight,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    otpLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.success,
        marginBottom: 4,
    },
    otpValue: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.success,
        letterSpacing: 2,
    },

    // Cancel Button Styles
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
    },
    cancelButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.danger,
    },

    // Footer Styles
    footer: {
        backgroundColor: COLORS.background.primary,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border.light,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },

    // Payment Selector Styles
    paymentSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background.secondary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border.light,
    },
    paymentText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text.primary,
    },

    // Book Button Styles
    bookButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        minHeight: 56,
    },
    bookButtonDisabled: {
        backgroundColor: COLORS.border.medium,
        elevation: 0,
        shadowOpacity: 0,
    },
    bookButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.inverse,
        marginBottom: 2,
    },
    bookButtonSubtext: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text.inverse,
        opacity: 0.9,
    },
});