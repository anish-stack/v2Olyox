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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import axios from "axios";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

import Map from "../Map/Map"; // Assuming this component is correctly set up
import { tokenCache } from "../../Auth/cache"; // Assuming this is correctly set up
import { useLocation } from "../../context/LocationContext"; // Assuming this is correctly set up
import { useRide } from "../../context/RideContext"; // Assuming this is correctly set up
import useNotificationPermission from "../../hooks/notification"; // Assuming this is correctly set up

const POLLING_INTERVAL = 8000;
const BOOKING_TIMEOUT = 120000; // 2 minutes

// Rich Red Theme Color Palette
const COLORS = {
    primaryRed: "#D32F2F", // Rich Red (Material Design Red 700)
    primaryRedLight: "#FFCDD2", // Light Red (Material Design Red 100)
    primaryRedDark: "#B71C1C", // Dark Red (Material Design Red 900)
    accentGold: "#FFC107", // Accent Gold/Amber for contrast
    accentGoldLight: "#FFECB3",

    successGreen: "#4CAF50", // Green for success messages
    successGreenLight: "#E8F5E9",

    infoBlue: "#2196F3", // Blue for informational messages
    infoBlueLight: "#E3F2FD",

    textPrimary: "#212121", // Dark Gray for primary text
    textSecondary: "#757575", // Medium Gray for secondary text
    textOnPrimaryRed: "#FFFFFF", // White text on red backgrounds

    background: "#F5F5F5", // Light Gray for screen background
    surface: "#FFFFFF", // White for card backgrounds
    border: "#E0E0E0", // Light Gray for borders/dividers
    mediumGray: "#BDBDBD",
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
    } else { // iOS or other platforms
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
                    `http://192.168.1.6:3100/api/v1/new/status/${createdRideId}`, // Ensure this URL is correct
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
                        updateRideContextStatus("confirmed"); // Or a more specific status
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
                        // Message updated by setBookingStatusMessage
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
                // For other network errors, polling continues until timeout
            }
        };

        pollingRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
        pollRideStatus(); // Initial call

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
                "http://192.168.1.6:3100/api/v1/new/new-ride", // Ensure this URL is correct
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
                            // Optional: API call to inform backend of user cancellation
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
            case "Online": return "credit-card-check-outline"; // Changed for better "Online" representation
            default: return "credit-card-settings-outline";
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
                <Icon name="arrow-left-circle-outline" size={28} color={COLORS.primaryRedDark} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Confirm Your Ride</Text>
            <View style={styles.headerButton} /> {/* Placeholder for balance */}
        </View>
    );

    const RideInfoDisplay = () => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Journey Details</Text>
                {selectedRide?.durationInMinutes && (
                    <View style={[styles.tag, {backgroundColor: COLORS.primaryRedLight}]}>
                        <Icon name="clock-fast" size={16} color={COLORS.primaryRedDark} />
                        <Text style={[styles.tagText, {color: COLORS.primaryRedDark}]}>
                            ~{selectedRide.durationInMinutes.toFixed(0)} min
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.locationRow}>
                <Icon name="map-marker-circle" size={24} color={COLORS.accentGold} />
                <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>FROM</Text>
                    <Text style={styles.locationValue} numberOfLines={2}>
                        {pickup?.description || "Current Location"}
                    </Text>
                </View>
            </View>

            <View style={styles.dottedLineContainer}>
                <View style={styles.dottedLine} />
            </View>

            <View style={styles.locationRow}>
                <Icon name="flag-checkered" size={24} color={COLORS.successGreen} />
                <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>TO</Text>
                    <Text style={styles.locationValue} numberOfLines={2}>
                        {dropoff?.description || "Selected Destination"}
                    </Text>
                </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Fare Estimate</Text>
            <View style={styles.fareDetailRow}>
                <Text style={styles.fareLabel}>Vehicle Type</Text>
                <Text style={styles.fareValue}>{selectedRide?.vehicleName || "N/A"}</Text>
            </View>
            <View style={[styles.fareDetailRow, styles.totalFareRow]}>
                <Text style={styles.totalFareLabel}>Estimated Total</Text>
                <Text style={styles.totalFareValue}>
                    ₹{selectedRide?.totalPrice?.toFixed(0) || "0"}
                </Text>
            </View>
            <Text style={styles.fareDisclaimer}>
                This is an estimated fare. Actual charges may vary based on traffic, tolls, and final distance.
            </Text>
        </View>
    );

    const BookingProgressIndicator = () => (
        <View style={[styles.card, styles.bookingProgressCard]}>
            <ActivityIndicator size="large" color={COLORS.primaryRed} />
            <Text style={styles.bookingStatusTitle}>Finding Your Ride...</Text>
            <Text style={styles.bookingStatusMessage}>{bookingStatusMessage}</Text>
            <View style={styles.statusTimeline}>
                <View style={[styles.timelineDot, (currentRideStatus === 'pending' || currentRideStatus === 'searching') && styles.timelineDotActive]} />
                <View style={styles.timelineConnector} />
                <View style={[styles.timelineDot, currentRideStatus === 'driver_assigned' && styles.timelineDotActive]} />
            </View>
            {rideOtp && (
                <View style={styles.otpContainer}>
                    <Text style={styles.otpLabel}>Your Ride OTP:</Text>
                    <Text style={styles.otpValue}>{rideOtp}</Text>
                </View>
            )}
            <TouchableOpacity style={styles.cancelRideButton} onPress={handleCancelBooking}>
                <Icon name="close-circle-outline" size={20} color={COLORS.primaryRedDark} />
                <Text style={styles.cancelRideButtonText}>Cancel Request</Text>
            </TouchableOpacity>
        </View>
    );

    if (isLoadingLocation) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryRedDark} />
                <Header />
                <View style={styles.fullScreenLoader}>
                    <ActivityIndicator size="large" color={COLORS.primaryRed} />
                    <Text style={styles.loaderText}>Fetching your location...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryRedDark} />
            <Header />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.mapViewContainer}>
                    <Map origin={origin} destination={destination} isFakeRiderShow={true} />
                </View>

                {isBookingInProgress ? <BookingProgressIndicator /> : <RideInfoDisplay />}

            </ScrollView>

            {!isBookingInProgress && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.paymentMethodSelector} onPress={handleChangePayment}>
                        <Icon name={getPaymentIcon()} size={24} color={COLORS.primaryRed} />
                        <Text style={styles.paymentMethodText}>{paymentMethod}</Text>
                        <Icon name="chevron-down" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            (!selectedRide || !currentLocation || isCreatingRide) && styles.actionButtonDisabled,
                        ]}
                        onPress={handleCreateRide}
                        disabled={!selectedRide || !currentLocation || isCreatingRide}
                    >
                        {isCreatingRide ? (
                            <ActivityIndicator color={COLORS.textOnPrimaryRed} />
                        ) : (
                            <Text style={styles.actionButtonText}>Confirm & Request Ride</Text>
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
        backgroundColor: COLORS.background,
    },
    scrollContainer: {
        paddingBottom: Platform.OS === 'ios' ? 120 : 100,
    },
    headerContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: COLORS.surface, // White header
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerButton: {
        padding: 5,
        minWidth: 30,
    },
    headerTitle: {
        flex: 1,
        textAlign: "center",
        fontSize: 18,
        fontWeight: "600",
        color: COLORS.textPrimary,
    },
    mapViewContainer: {
        height: 280,
        backgroundColor: COLORS.border, // Light gray for map placeholder
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 5,
    },
    card: {
        backgroundColor: COLORS.surface,
        marginHorizontal: 15,
        marginTop: 10,
        padding: 20,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: COLORS.textPrimary,
    },
    tag: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    tagText: {
        marginLeft: 6,
        fontSize: 13,
        fontWeight: "500",
    },
    locationRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginVertical: 8,
    },
    locationTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: "500",
        textTransform: "uppercase",
        marginBottom: 2,
    },
    locationValue: {
        fontSize: 15,
        color: COLORS.textPrimary,
        fontWeight: "500",
    },
    dottedLineContainer: {
        height: 25,
        marginLeft: 11,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    dottedLine: {
        height: '100%',
        width: 2,
        borderLeftWidth: 2,
        borderLeftColor: COLORS.mediumGray,
        borderStyle: 'dashed',
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    fareDetailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    fareLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    fareValue: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontWeight: "500",
    },
    totalFareRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    totalFareLabel: {
        fontSize: 16,
        fontWeight: "bold",
        color: COLORS.textPrimary,
    },
    totalFareValue: {
        fontSize: 18,
        fontWeight: "bold",
        color: COLORS.primaryRed, // Total fare in red
    },
    fareDisclaimer: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 12,
        textAlign: "center",
        fontStyle: 'italic',
    },
    bookingProgressCard: {
        alignItems: "center",
        paddingVertical: 30,
    },
    bookingStatusTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: COLORS.textPrimary,
        marginTop: 20,
        marginBottom: 8,
    },
    bookingStatusMessage: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: "center",
        marginBottom: 25,
        paddingHorizontal: 10,
    },
    statusTimeline: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 15,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.mediumGray,
    },
    timelineDotActive: {
        backgroundColor: COLORS.primaryRed, // Active dot in red
    },
    timelineConnector: {
        width: 60,
        height: 2,
        backgroundColor: COLORS.mediumGray,
        marginHorizontal: 5,
    },
    otpContainer: {
        marginTop: 15,
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: COLORS.primaryRedLight,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.primaryRed,
    },
    otpLabel: {
        fontSize: 14,
        color: COLORS.primaryRedDark,
        marginBottom: 4,
    },
    otpValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primaryRedDark,
        letterSpacing: 3,
    },
    cancelRideButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: COLORS.surface, // White background
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.primaryRedDark,
    },
    cancelRideButtonText: {
        color: COLORS.primaryRedDark,
        fontSize: 15,
        fontWeight: "500",
        marginLeft: 8,
    },
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: Platform.OS === 'ios' ? 35 : 20,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 5,
    },
    paymentMethodSelector: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.background, // Light gray background for selector
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    paymentMethodText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        fontWeight: "500",
        color: COLORS.textPrimary,
    },
    actionButton: {
        backgroundColor: COLORS.primaryRed, // Main action button in red
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    actionButtonDisabled: {
        backgroundColor: COLORS.mediumGray,
    },
    actionButtonText: {
        color: COLORS.textOnPrimaryRed, // White text on red button
        fontSize: 16,
        fontWeight: "bold",
    },
    fullScreenLoader: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.background,
    },
    loaderText: {
        marginTop: 15,
        fontSize: 16,
        color: COLORS.textSecondary,
    },
});