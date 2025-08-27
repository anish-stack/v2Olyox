"use client"

import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Modal,
    TextInput,
    Linking,
    Dimensions,
    Image,
    FlatList,
    StatusBar,
    Animated,
    Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { CommonActions, useNavigation, useRoute, useFocusEffect } from "@react-navigation/native"
import axios from "axios"
import { Audio } from "expo-av"
import MapView, { Polyline, Marker } from "react-native-maps"

import { useFetchUserDetails } from "../../hooks/New Hookes/RiderDetailsHooks"
import { MaterialIcons } from "@expo/vector-icons"
import { API_BASE_URL } from "../NewConstant"
import * as Updates from "expo-updates"
import HeaderNew from "../components/Header/HeaderNew"
import useSettings from "../../hooks/settings.hook"
import { styles } from "./RunningRideStyles"

const { width, height } = Dimensions.get("window")

const decodePolyline = (encoded) => {
    const poly = []
    let index = 0
    const len = encoded.length
    let lat = 0
    let lng = 0

    while (index < len) {
        let b
        let shift = 0
        let result = 0
        do {
            b = encoded.charCodeAt(index++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
        lat += dlat

        shift = 0
        result = 0
        do {
            b = encoded.charCodeAt(index++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
        lng += dlng

        poly.push({
            latitude: lat / 1e5,
            longitude: lng / 1e5,
        })
    }
    return poly
}

export default function RunningRide() {
    const route = useRoute()
    const { rideData } = route.params || {}
    const navigation = useNavigation()
    const { fetchUserDetails, userData } = useFetchUserDetails()
    const { settings } = useSettings()

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current
    const slideAnim = useRef(new Animated.Value(50)).current
    const mapRef = useRef(null)

    // Core state
    const [activeRideData, setActiveRideData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [userLoading, setUserLoading] = useState(true)
    const [error, setError] = useState(null)
    const [refreshing, setRefreshing] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

    // Modal states
    const [showCancelModal, setCancelModal] = useState(false)
    const [showOtpModal, setShowOtpModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)

    // Form states
    const [cancelReasons, setCancelReasons] = useState([])
    const [selectedReason, setSelectedReason] = useState(null)
    const [cancelling, setCancelling] = useState(false)
    const [otp, setOtp] = useState("")
    const [otpLoading, setOtpLoading] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState("cash")

    // UI states
    const [activeTab, setActiveTab] = useState("user")
    const [rideStep, setRideStep] = useState("pickup")

    // Map state
    const [routeCoordinates, setRouteCoordinates] = useState([])
    const [mapRegion, setMapRegion] = useState(null)

    // Memoized values
    const rideStatus = useMemo(() => activeRideData?.ride_status, [activeRideData?.ride_status])
    const paymentStatus = useMemo(() => activeRideData?.payment_status, [activeRideData?.payment_status])
    const totalFare = useMemo(
        () => activeRideData?.pricing?.total_fare?.toFixed(2),
        [activeRideData?.pricing?.total_fare],
    )

    // Driver-friendly alert helper
    const showDriverAlert = useCallback((title, message, type = "info") => {
        const alertConfig = {
            success: { icon: "✅", color: "#4CAF50" },
            error: { icon: "❌", color: "#F44336" },
            warning: { icon: "⚠️", color: "#FF9800" },
            info: { icon: "ℹ️", color: "#2196F3" },
        }

        const config = alertConfig[type] || alertConfig.info

        Alert.alert(`${config.icon} ${title}`, message, [{ text: "Got it!", style: "default" }], {
            cancelable: true,
            userInterfaceStyle: "light", // iOS specific
        })
    }, [])

    // Enhanced map region calculation for iOS
    const calculateMapRegion = useCallback((pickup, drop) => {
        if (!pickup || !drop) return null

        const pickupCoords = pickup.coordinates || pickup
        const dropCoords = drop.coordinates || drop

        const minLat = Math.min(pickupCoords[1], dropCoords[1])
        const maxLat = Math.max(pickupCoords[1], dropCoords[1])
        const minLng = Math.min(pickupCoords[0], dropCoords[0])
        const maxLng = Math.max(pickupCoords[0], dropCoords[0])

        const latDelta = (maxLat - minLat) * 1.5 // Add padding
        const lngDelta = (maxLng - minLng) * 1.5

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(latDelta, 0.01),
            longitudeDelta: Math.max(lngDelta, 0.01),
        }
    }, [])

    const generateRouteCoordinates = useCallback(async (pickup, drop) => {
        if (!pickup || !drop) return []

        const pickupCoords = pickup.coordinates || pickup
        const dropCoords = drop.coordinates || drop

        try {
            // Replace with your Google Maps API key
            const GOOGLE_MAPS_API_KEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8"

            const origin = `${pickupCoords[1]},${pickupCoords[0]}`
            const destination = `${dropCoords[1]},${dropCoords[0]}`

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`,
            )

            const data = await response.json()

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0]
                const encodedPolyline = route.overview_polyline.points

                // Decode the polyline into coordinate array
                return decodePolyline(encodedPolyline)
            }
        } catch (error) {
            console.error("Error fetching route:", error)
        }

        // Fallback to straight line if API fails
        return [
            { latitude: pickupCoords[1], longitude: pickupCoords[0] },
            { latitude: dropCoords[1], longitude: dropCoords[0] },
        ]
    }, [])

    // Animation effects
    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start()
    }, [])

    // Optimized user details fetch with better error handling
    const handleFetchUserDetails = useCallback(async () => {
        try {
            setUserLoading(true)
            await fetchUserDetails()
        } catch (error) {
            console.error("❌ Error fetching user details:", error)
            showDriverAlert(
                "Connection Issue",
                "Unable to load your profile. Please check your internet connection.",
                "error",
            )
        } finally {
            setUserLoading(false)
        }
    }, [fetchUserDetails, showDriverAlert])

    // Enhanced ride details fetch with iOS optimizations
    const fetchActiveRideDetails = useCallback(
        async (isRetry = false) => {
            if (!isRetry) setLoading(true)
            setError(null)

            try {
                if (userData?.on_ride_id) {
                    const response = await axios.get(`https://www.appv2.olyox.com/rider/${userData.on_ride_id}`, {
                        timeout: Platform.OS === "ios" ? 20000 : 15000, // iOS gets more time
                    })

                    if (response.data?.data) {
                        const rideData = response.data.data
                        setActiveRideData(rideData)
                        setRetryCount(0)

                        // Update map data for iOS Polyline
                        if (rideData.pickup_location && rideData.drop_location) {
                            const region = calculateMapRegion(rideData.pickup_location, rideData.drop_location)
                            const coordinates = await generateRouteCoordinates(rideData.pickup_location, rideData.drop_location)

                            setMapRegion(region)
                            setRouteCoordinates(coordinates)
                        }

                        // Update ride step based on status
                        const status = rideData.ride_status
                        switch (status) {
                            case "driver_assigned":
                                setRideStep("pickup")
                                break
                            case "driver_arrived":
                                setRideStep("otp")
                                break
                            case "in_progress":
                                setRideStep("drop")
                                break
                            case "completed":
                                setRideStep("payment")
                                break
                            default:
                                setRideStep("pickup")
                        }
                    } else {
                        throw new Error("No ride data available")
                    }
                } else {
                    setActiveRideData(null)
                }
            } catch (error) {
                console.error("❌ Error fetching ride details:", error)

                let errorMessage = "Something went wrong. Please try again."
                let alertType = "error"

                if (error?.code === "ECONNABORTED") {
                    errorMessage = "Connection timeout. Please check your internet connection."
                    alertType = "warning"
                } else if (error?.response?.status === 404) {
                    errorMessage = "Ride not found. It may have been completed or cancelled."
                    alertType = "info"
                } else if (error?.response?.status >= 500) {
                    errorMessage = "Server is temporarily unavailable. Please try again in a moment."
                    alertType = "warning"
                }

                setError(errorMessage)
                setActiveRideData(null)

                if (!isRetry) {
                    showDriverAlert("Ride Update Failed", errorMessage, alertType)
                }

                // Auto retry with exponential backoff
                if (retryCount < 3 && userData?.on_ride_id) {
                    const delay = Math.pow(2, retryCount) * 1000
                    setTimeout(() => {
                        setRetryCount((prev) => prev + 1)
                        fetchActiveRideDetails(true)
                    }, delay)
                }
            } finally {
                if (!isRetry) setLoading(false)
            }
        },
        [userData?.on_ride_id, retryCount, calculateMapRegion, generateRouteCoordinates, showDriverAlert],
    )

    // Optimized polling with iOS background handling
    useFocusEffect(
        useCallback(() => {
            if (!activeRideData) return

            const currentRoute = navigation.getState()?.routes?.[navigation.getState().index]?.name
            if (currentRoute !== "start") return

            // iOS-optimized polling intervals
            const pollingInterval =
                Platform.OS === "ios"
                    ? rideStatus === "in_progress"
                        ? 3000
                        : 8000
                    : rideStatus === "in_progress"
                        ? 5000
                        : 10000

            const interval = setInterval(async () => {
                try {
                    await fetchActiveRideDetails(true)

                    const isCancelled = rideStatus === "cancelled"
                    const isCompleted = rideStatus === "completed" && paymentStatus === "completed"

                    if (isCancelled || isCompleted) {
                        clearInterval(interval)

                        showDriverAlert(
                            "Ride Update",
                            isCancelled ? "Your ride has been cancelled." : "Ride completed successfully! 🎉",
                            isCancelled ? "warning" : "success",
                        )

                        setTimeout(async () => {
                            await Updates.reloadAsync()
                            navigation.dispatch(
                                CommonActions.reset({
                                    index: 0,
                                    routes: [{ name: "Home" }],
                                }),
                            )
                        }, 2000)
                    }
                } catch (err) {
                    console.error("Polling error:", err)
                }
            }, pollingInterval)

            return () => clearInterval(interval)
        }, [rideStatus, paymentStatus, navigation, fetchActiveRideDetails, showDriverAlert]),
    )

    // Enhanced API calls with driver-friendly feedback
    const markReached = useCallback(async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/new/change-ride-status`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                status: "driver_arrived",
            })

            if (response.data.success) {
                setRideStep("otp")
                setShowOtpModal(true)
                await fetchActiveRideDetails()

                showDriverAlert(
                    "Location Reached! 🎯",
                    "Great! You have successfully reached the pickup location. Please collect the OTP from the rider.",
                    "success",
                )
            }
        } catch (error) {
            showDriverAlert(
                "Update Failed",
                "Unable to update your location status. Please check your connection and try again.",
                "error",
            )
        }
    }, [userData?._id, activeRideData?._id, fetchActiveRideDetails, showDriverAlert])

    const verifyOtp = useCallback(async () => {
        if (!otp || otp.length !== 4) {
            showDriverAlert("Invalid OTP", "Please enter the complete 4-digit OTP from the rider.", "warning")
            return
        }

        setOtpLoading(true)
        try {
            const response = await axios.post(`${API_BASE_URL}/new/verify-ride-otp`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                otp: otp,
            })

            if (response.data.success) {
                setOtp("")
                setShowOtpModal(false)
                setRideStep("drop")

                showDriverAlert(
                    "Ride Started! 🚗",
                    "OTP verified successfully! The ride has begun. Drive safely to the destination.",
                    "success",
                )

                await fetchActiveRideDetails()
            }
        } catch (error) {
            showDriverAlert(
                "OTP Verification Failed",
                error.response?.data?.message || "The OTP seems incorrect. Please ask the rider to provide the correct OTP.",
                "error",
            )
        } finally {
            setOtpLoading(false)
        }
    }, [otp, userData?._id, activeRideData?._id, fetchActiveRideDetails, showDriverAlert])

    const markDrop = useCallback(async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/new/change-ride-status`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                status: "completed",
            })

            if (response.data.success) {
                setRideStep("payment")
                setShowPaymentModal(true)
                await fetchActiveRideDetails()

                showDriverAlert(
                    "Ride Completed! 🎉",
                    "Excellent! You have successfully completed the ride. Now collect the payment from the rider.",
                    "success",
                )
            }
        } catch (error) {
            showDriverAlert(
                "Completion Failed",
                "Unable to mark the ride as completed. Please try again or contact support if the issue persists.",
                "error",
            )
        }
    }, [userData?._id, activeRideData?._id, fetchActiveRideDetails, showDriverAlert])

    const collectPayment = useCallback(async () => {
        try {
            // iOS-optimized audio setup
            if (Platform.OS === "ios") {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: false,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                })
            }

            const { sound } = await Audio.Sound.createAsync(require("./coin-sound.mp3"), {
                shouldPlay: false,
                isLooping: false,
                volume: 1.0,
            })

            const response = await axios.post(`${API_BASE_URL}/new/collect-payment`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                amount: activeRideData?.pricing?.total_fare,
                mode: paymentMethod,
            })

            if (response.data.success) {
                await sound.playAsync()
                setShowPaymentModal(false)

                showDriverAlert(
                    "Payment Collected! 💰",
                    `₹${totalFare} has been collected successfully. Great job completing this ride!`,
                    "success",
                )

                setTimeout(() => {
                    navigation.reset({
                        index: 0,
                        routes: [{ name: "Home" }],
                    })
                }, 2000)
            }
        } catch (error) {
            showDriverAlert(
                "Payment Collection Failed",
                error.response?.data?.message || "Unable to process payment collection. Please try again.",
                "error",
            )
        }
    }, [userData?._id, activeRideData?._id, paymentMethod, totalFare, navigation, showDriverAlert])

    // Enhanced cancel functionality
    const fetchCancelReasons = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/cancel-reasons?active=active&type=driver`)
            if (response.data?.data) {
                setCancelReasons(response.data.data)
            }
        } catch (err) {
            showDriverAlert("Error", "Unable to load cancellation reasons. Please try again.", "error")
        }
    }, [showDriverAlert])

    const handleCancel = useCallback(async () => {
        if (!selectedReason || !activeRideData?._id) return

        setCancelling(true)
        try {
            await axios.post(`${API_BASE_URL}/new/ride/cancel`, {
                ride: activeRideData._id,
                cancelBy: "driver",
                reason_id: selectedReason._id,
                reason: selectedReason.name,
            })

            showDriverAlert(
                "Ride Cancelled",
                "The ride has been cancelled successfully. You will be redirected to the home screen.",
                "info",
            )

            setTimeout(async () => {
                setCancelModal(false)
                setSelectedReason(null)
                await Updates.reloadAsync()
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: "Home" }],
                    }),
                )
            }, 2000)
        } catch (err) {
            showDriverAlert("Cancellation Failed", "Unable to cancel the ride. Please try again or contact support.", "error")
        } finally {
            setCancelling(false)
        }
    }, [selectedReason, activeRideData?._id, navigation, showDriverAlert])

    // Utility functions
    const makePhoneCall = useCallback(() => {
        Linking.openURL(`tel:01141236767`)
    }, [])

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        setRetryCount(0)
        try {
            await handleFetchUserDetails()
            await fetchActiveRideDetails()
        } finally {
            setRefreshing(false)
        }
    }, [handleFetchUserDetails, fetchActiveRideDetails])

    const handleRetry = useCallback(() => {
        setRetryCount(0)
        fetchActiveRideDetails()
    }, [fetchActiveRideDetails])

    // UI helper functions
    const getBottomButtonText = () => {
        switch (rideStep) {
            case "pickup":
                return "Mark Reached"
            case "otp":
                return "Enter OTP"
            case "drop":
                return "Mark Drop"
            case "payment":
                return "Collect Payment"
            default:
                return "Mark Reached"
        }
    }

    const handleBottomButtonPress = () => {
        switch (rideStep) {
            case "pickup":
                markReached()
                break
            case "otp":
                setShowOtpModal(true)
                break
            case "drop":
                markDrop()
                break
            case "payment":
                setShowPaymentModal(true)
                break
        }
    }

    // iOS-optimized map component with Polyline
    const renderMap = () => {
        if (!mapRegion || !activeRideData) return null

        return (
            <View style={styles.mapContainer}>
                <MapView
                    ref={mapRef}
                    style={styles.map}
                    region={mapRegion}
                    showsUserLocation={true}
                    showsScale={true}
                    zoomControlEnabled={true}
                    showsMyLocationButton={Platform.OS === "ios"}
                    toolbarEnabled={false}
                    moveOnMarkerPress={false}
                    loadingEnabled={true}
                    loadingIndicatorColor="#DC2626"
                    mapType={Platform.OS === "ios" ? "standard" : "standard"}
                >
                    {/* Pickup Marker */}
                    {activeRideData.pickup_location && (
                        <Marker
                            coordinate={{
                                latitude: activeRideData.pickup_location.coordinates[1],
                                longitude: activeRideData.pickup_location.coordinates[0],
                            }}
                            title="Pickup Location"
                            pinColor="#22C55E"
                        />
                    )}

                    {/* Drop Marker */}
                    {activeRideData.drop_location && (
                        <Marker
                            coordinate={{
                                latitude: activeRideData.drop_location.coordinates[1],
                                longitude: activeRideData.drop_location.coordinates[0],
                            }}
                            title="Drop Location"
                            pinColor="#DC2626"
                        />
                    )}

                    {/* Route Polyline for iOS */}
                    {routeCoordinates.length > 0 && (
                        <Polyline
                            coordinates={routeCoordinates}
                            strokeColor="#DC2626"
                            strokeWidth={4}
                            geodesic={true}   // smooth curves
                            {...(Platform.OS === "ios" ? { lineDashPattern: [5, 5] } : {})}
                        />
                    )}
                </MapView>

                {/* Distance and Duration Overlay */}
                <View style={styles.mapOverlay}>
                    <View style={styles.routeInfo}>
                        <Text style={styles.routeDistance}>{activeRideData.route_info?.distance || "N/A"} km</Text>
                        <Text style={styles.routeDuration}>{activeRideData.route_info?.duration || "N/A"} min</Text>
                    </View>
                </View>
            </View>
        )
    }

    // Enhanced tab content rendering
    const renderTabContent = () => {
        if (!activeRideData) return null

        switch (activeTab) {
            case "user":
                return (
                    <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
                        <View style={styles.userCard}>
                            <View style={styles.userHeader}>
                                <View style={styles.userAvatar}>
                                    <MaterialIcons name="person" size={24} color="#DC2626" />
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{activeRideData.user?.name || "Rider"}</Text>
                                    <Text style={styles.userPhone}>Tap call button to contact</Text>
                                </View>
                                <TouchableOpacity style={styles.callButton} onPress={() => makePhoneCall()} activeOpacity={0.8}>
                                    <MaterialIcons name="phone" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.addressSection}>
                                <View style={styles.addressItem}>
                                    <View style={[styles.locationDot, { backgroundColor: "#22C55E" }]} />
                                    <View style={styles.addressContent}>
                                        <Text style={styles.addressLabel}>Pickup Location</Text>
                                        <Text style={styles.addressValue}>
                                            {activeRideData.pickup_address?.formatted_address || "Loading address..."}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.routeLine} />

                                <View style={styles.addressItem}>
                                    <View style={[styles.locationDot, { backgroundColor: "#DC2626" }]} />
                                    <View style={styles.addressContent}>
                                        <Text style={styles.addressLabel}>Drop Location</Text>
                                        <Text style={styles.addressValue}>
                                            {activeRideData.drop_address?.formatted_address || "Loading address..."}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                )

            case "ride":
                return (
                    <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
                        <View style={styles.rideDetailsCard}>
                            <View style={styles.statusContainer}>
                                <Text style={styles.statusLabel}>Ride Status</Text>
                                <View style={[styles.statusBadge, { backgroundColor: "#DC2626" }]}>
                                    <Text style={styles.statusText}>{rideStatus?.replace("_", " ").toUpperCase()}</Text>
                                </View>
                            </View>

                            <View style={styles.rideMetrics}>
                                <View style={styles.metricItem}>
                                    <MaterialIcons name="straighten" size={20} color="#DC2626" />
                                    <Text style={styles.metricLabel}>Distance</Text>
                                    <Text style={styles.metricValue}>{activeRideData.route_info?.distance || "N/A"} km</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <MaterialIcons name="schedule" size={20} color="#DC2626" />
                                    <Text style={styles.metricLabel}>Duration</Text>
                                    <Text style={styles.metricValue}>{activeRideData.route_info?.duration || "N/A"} min</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <MaterialIcons name="payment" size={20} color="#DC2626" />
                                    <Text style={styles.metricLabel}>Payment</Text>
                                    <Text style={styles.metricValue}>{activeRideData.payment_method || "Cash"}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    fetchCancelReasons()
                                    setCancelModal(true)
                                }}
                                activeOpacity={0.8}
                            >
                                <MaterialIcons name="cancel" size={20} color="#DC2626" />
                                <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )

            case "fare":
                return (
                    <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
                        <View style={styles.fareCard}>
                            <Text style={styles.fareLabel}>Total Fare to Collect</Text>

                            <View style={styles.fareNoteContainer}>
                                <Text style={styles.fareNote}>
                                    This fare does not include extra charges. Please collect any additional costs such as tolls and
                                    parking fees directly from the rider.
                                </Text>
                            </View>

                            <Text style={styles.fareValue}>₹{totalFare}</Text>
                        </View>
                    </Animated.View>
                )

            default:
                return null
        }
    }

    // Initialize data
    useEffect(() => {
        if (rideData) {
            handleFetchUserDetails()
        }
    }, [rideData, handleFetchUserDetails])

    useEffect(() => {
        if (userData && !userLoading) {
            fetchActiveRideDetails()
        }
    }, [userData, userLoading, fetchActiveRideDetails])

    const showLoading = userLoading || loading
    const showRetryButton = error && !showLoading && retryCount >= 3

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle={Platform.OS === "ios" ? "dark-content" : "light-content"} backgroundColor="#DC2626" />
            <HeaderNew />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#DC2626"]} tintColor="#DC2626" />
                }
            >
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {/* iOS-optimized Map Component with Polyline */}
                    {renderMap()}

                    {/* Loading State */}
                    {showLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#DC2626" />
                            <Text style={styles.loadingText}>
                                {userLoading ? "Loading your details..." : "Getting ride information..."}
                            </Text>
                            {retryCount > 0 && <Text style={styles.retryText}>Attempt {retryCount} of 3</Text>}
                        </View>
                    )}

                    {/* Error State */}
                    {error && !showLoading && (
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={32} color="#DC2626" />
                            <Text style={styles.errorTitle}>Connection Issue</Text>
                            <Text style={styles.errorText}>{error}</Text>
                            {showRetryButton && (
                                <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
                                    <MaterialIcons name="refresh" size={20} color="#fff" />
                                    <Text style={styles.retryButtonText}>Try Again</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Success State */}
                    {!showLoading && !error && activeRideData && (
                        <>
                            {/* Tab Navigation */}
                            <View style={styles.tabContainer}>
                                {[
                                    { key: "user", icon: "person", label: "Rider" },
                                    { key: "ride", icon: "directions-car", label: "Trip" },
                                    { key: "fare", icon: "currency-rupee", label: "Fare" },
                                ].map((tab) => (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                                        onPress={() => setActiveTab(tab.key)}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialIcons name={tab.icon} size={20} color={activeTab === tab.key ? "#fff" : "#666"} />
                                        <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Tab Content */}
                            {renderTabContent()}
                        </>
                    )}

                    {/* No Data State */}
                    {!showLoading && !error && !activeRideData && (
                        <View style={styles.noDataContainer}>
                            <MaterialIcons name="info-outline" size={64} color="#999" />
                            <Text style={styles.noDataTitle}>No Active Ride</Text>
                            <Text style={styles.noDataText}>You don't have any active rides at the moment.</Text>
                            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                                <Text style={styles.refreshButtonText}>Refresh</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>

            {/* Fixed Bottom Button */}
            {!showLoading && !error && activeRideData && (
                <Animated.View style={[styles.bottomButtonContainer, { opacity: fadeAnim }]}>
                    <TouchableOpacity style={styles.bottomButton} onPress={handleBottomButtonPress} activeOpacity={0.8}>
                        <Text style={styles.bottomButtonText}>{getBottomButtonText()}</Text>
                        <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Enhanced Modals */}
            {/* Cancel Modal */}
            <Modal visible={showCancelModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Cancel Ride</Text>
                            <TouchableOpacity onPress={() => setCancelModal(false)}>
                                <MaterialIcons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>Please select a reason for cancellation:</Text>

                        <FlatList
                            data={cancelReasons}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.reasonItem, selectedReason?._id === item._id && styles.selectedReason]}
                                    onPress={() => setSelectedReason(item)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.radioButton}>
                                        {selectedReason?._id === item._id && <View style={styles.radioSelected} />}
                                    </View>
                                    <View style={styles.reasonContent}>
                                        <Text style={styles.reasonName}>{item.name}</Text>
                                        <Text style={styles.reasonDescription}>{item.description}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            style={styles.reasonsList}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelModalButton} onPress={() => setCancelModal(false)}>
                                <Text style={styles.cancelModalText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmButton, !selectedReason && styles.disabledButton]}
                                onPress={handleCancel}
                                disabled={!selectedReason || cancelling}
                            >
                                {cancelling ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>Confirm Cancel</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* OTP Modal */}
            <Modal visible={showOtpModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.otpModal}>
                        <MaterialIcons name="lock-outline" size={48} color="#DC2626" />
                        <Text style={styles.otpTitle}>Enter OTP</Text>
                        <Text style={styles.otpSubtitle}>Please enter the 4-digit OTP provided by the rider</Text>

                        <TextInput
                            style={styles.otpInput}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="numeric"
                            maxLength={4}
                            placeholder="0000"
                            textAlign="center"
                            autoFocus
                        />

                        <View style={styles.otpButtons}>
                            <TouchableOpacity
                                style={styles.otpCancelButton}
                                onPress={() => {
                                    setShowOtpModal(false)
                                    setOtp("")
                                }}
                            >
                                <Text style={styles.otpCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.otpVerifyButton}
                                onPress={verifyOtp}
                                disabled={otpLoading || otp.length !== 4}
                            >
                                {otpLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.otpVerifyText}>Verify OTP</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Payment Modal */}
            <Modal visible={showPaymentModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.paymentModal}>
                        <MaterialIcons name="payment" size={48} color="#22C55E" />
                        <Text style={styles.paymentTitle}>Collect Payment</Text>
                        <Text style={styles.paymentAmount}>₹{totalFare}</Text>

                        <View style={styles.paymentMethods}>
                            {[
                                { key: "cash", icon: "money", label: "Cash" },
                                { key: "digital", icon: "qr-code", label: "Digital" },
                            ].map((method) => (
                                <TouchableOpacity
                                    key={method.key}
                                    style={[styles.paymentMethod, paymentMethod === method.key && styles.activePaymentMethod]}
                                    onPress={() => setPaymentMethod(method.key)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name={method.icon} size={24} color={paymentMethod === method.key ? "#fff" : "#666"} />
                                    <Text
                                        style={[styles.paymentMethodText, paymentMethod === method.key && styles.activePaymentMethodText]}
                                    >
                                        {method.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {paymentMethod === "digital" && userData?.YourQrCodeToMakeOnline && (
                            <View style={styles.qrContainer}>
                                <Image source={{ uri: userData.YourQrCodeToMakeOnline }} style={styles.qrImage} resizeMode="contain" />
                                <Text style={styles.qrText}>Show this QR code to the rider</Text>
                            </View>
                        )}

                        <View style={styles.paymentButtons}>
                            <TouchableOpacity style={styles.paymentCancelButton} onPress={() => setShowPaymentModal(false)}>
                                <Text style={styles.paymentCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.paymentCollectButton} onPress={collectPayment}>
                                <Text style={styles.paymentCollectText}>Payment Collected</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    )
}
