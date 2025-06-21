"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    FlatList,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Dimensions,
    ScrollView,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRoute, useNavigation, CommonActions } from "@react-navigation/native"
import axios from "axios"
import NewUserAndDriverMap from "./NewMap"
import { useLocation } from "../context/LocationContext"
import { useRide } from "../context/RideContext"
import useNotificationPermission from "../hooks/notification"

const { width, height } = Dimensions.get("window")
const API_BASE_URL = "http://192.168.1.6:3100"

const STATUS_CONFIG = {
    driver_assigned: { label: "Driver Assigned", color: "#FF6B35", icon: "car-outline" },
    driver_arrived: { label: "Driver Arrived", color: "#4CAF50", icon: "checkmark-circle-outline" },
    in_progress: { label: "In Progress", color: "#2196F3", icon: "navigate-outline" },
    completed: { label: "Completed", color: "#8BC34A", icon: "flag-outline" },
}

export default function OnWayRide() {
    const route = useRoute()
    const { driver: ride_id } = route.params || {}
    const { location } = useLocation()
    const { clearCurrentRide } = useRide()
    const navigation = useNavigation()
    const { lastNotification } = useNotificationPermission()
    // State management
    const [activeRideData, setActiveRideData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [showCancelModal, setCancelModal] = useState(false)
    const [cancelReasons, setCancelReasons] = useState([])
    const [selectedReason, setSelectedReason] = useState(null)
    const [cancelling, setCancelling] = useState(false)
    const [error, setError] = useState(null)


    // console.log("lastNotification",lastNotification)

    // Memoized values
    const currentStatus = useMemo(
        () => (activeRideData?.ride_status ? STATUS_CONFIG[activeRideData.ride_status] : null),
        [activeRideData?.ride_status],
    )

    const canCancel = useMemo(() => activeRideData?.ride_status === "driver_assigned", [activeRideData?.ride_status])

    const driverInfo = useMemo(() => activeRideData?.driver, [activeRideData?.driver])

    // Fetch ride details
    const fetchRideDetails = useCallback(async () => {
        if (!ride_id) return

        setLoading(true)
        setError(null)

        try {
            const response = await axios.get(`${API_BASE_URL}/rider/${ride_id}`, {
                timeout: 10000,
            })

            if (response.data?.data) {
                setActiveRideData(response.data.data)
            } else {
                throw new Error("No ride data received")
            }
        } catch (err) {
            const errorMessage =
                err?.response?.data?.error ||
                (err?.code === "ECONNABORTED" ? "Request timeout" : "Failed to fetch ride details")
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [ride_id])

    // Fetch cancel reasons
    const fetchCancelReasons = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/admin/cancel-reasons?active=active`)
            if (response.data?.data) {
                setCancelReasons(response.data.data)
            }
        } catch (err) {
            Alert.alert("Error", "Failed to fetch cancel reasons")
        }
    }, [])

    // Handle cancel ride
    const handleCancel = useCallback(async () => {
        if (!selectedReason || !ride_id) return

        setCancelling(true)
        try {
            // Replace with your actual cancel API endpoint
            await axios.post(`${API_BASE_URL}/api/v1/new/ride/cancel`, {
                ride: ride_id,
                cancelBy: 'user',
                reason_id: selectedReason._id,
                reason: selectedReason.name,
            })

            Alert.alert("Success", "Ride cancelled successfully", [
                {
                    text: "OK",
                    onPress: () => {
                        setCancelModal(false)
                        // Navigate back or to appropriate screen
                    },
                },
            ])
        } catch (err) {
            Alert.alert("Error", "Failed to cancel ride. Please try again.")
        } finally {
            setCancelling(false)
        }
    }, [selectedReason, ride_id])

    const showEmergencyAlert = useCallback(() => {
        Alert.alert(
            "Emergency Help",
            "Choose an emergency service:",
            [
                {
                    text: "Call Police",
                    onPress: () => {
                        // Replace with actual emergency number
                        Alert.alert("Calling Police", "Emergency: 100")
                        // Linking.openURL('tel:100')
                    },
                },
                {
                    text: "Call Ambulance",
                    onPress: () => {
                        // Replace with actual emergency number
                        Alert.alert("Calling Ambulance", "Emergency: 108")
                        // Linking.openURL('tel:108')
                    },
                },
                {
                    text: "Call Olyox Support",
                    onPress: () => {
                        // Replace with actual support number
                        Alert.alert("Calling Support", "Olyox Support: +91-XXXXXXXXXX")
                        // Linking.openURL('tel:+91XXXXXXXXXX')
                    },
                },
                {
                    text: "Cancel",
                    style: "cancel",
                },
            ],
            { cancelable: true },
        )
    }, [])

    // Effects
    useEffect(() => {
        fetchRideDetails()
    }, [fetchRideDetails])

    useEffect(() => {
        if (!activeRideData?.ride_status) return;

        const rideStatus = activeRideData.ride_status;
        const paymentStatus = activeRideData.payment_status;

        // Cancelled ride alert
        if (rideStatus === 'cancelled') {
            Alert.alert(
                "Ride Status",
                "Your ride has been cancelled.",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            clearCurrentRide();
                            navigation.dispatch(
                                CommonActions.reset({
                                    index: 0,
                                    routes: [{ name: 'Home' }],
                                })
                            );
                        },
                    },
                ],
                { cancelable: false }
            );
            return;
        }

        // Ride completed but payment pending
        if (rideStatus === 'completed' && paymentStatus !== 'completed') {
            Alert.alert(
                "Ride Completed",
                "Your ride has been completed. Please proceed with payment.",
                [{ text: "OK" }],
                { cancelable: false }
            );
            return;
        }

        // Ride and payment both completed
        if (rideStatus === 'completed' && paymentStatus === 'completed') {
            Alert.alert(
                "🎉 Thank You!",
                "Thank you for completing your ride!",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            clearCurrentRide();
                            navigation.dispatch(
                                CommonActions.reset({
                                    index: 0,
                                    routes: [
                                        {
                                            name: 'RateRiderOrRide',
                                            params: {
                                                rideId: activeRideData?._id,
                                            },
                                        },
                                    ],
                                })
                            );
                        },

                    },
                ],
                { cancelable: false }
            );
        }
    }, [activeRideData?.ride_status, activeRideData?.payment_status]);


    useEffect(() => {
        const interval = setInterval(fetchRideDetails, 5000)
        return () => clearInterval(interval)
    }, [fetchRideDetails])

    // Render methods
    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                {currentStatus && (
                    <View style={styles.statusContainer}>
                        <Ionicons name={currentStatus.icon} size={20} color={currentStatus.color} />
                        <Text style={[styles.statusText, { color: currentStatus.color }]}>{currentStatus.label}</Text>
                    </View>
                )}
            </View>

            <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(!showMenu)}>
                <Ionicons name="ellipsis-vertical" size={24} color="#333" />
            </TouchableOpacity>

            {showMenu && (
                <View style={styles.menuDropdown}>
                    <TouchableOpacity style={styles.menuItem}>
                        <Ionicons name="headset-outline" size={20} color="#333" />
                        <Text style={styles.menuText}>Contact Support</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                            setShowMenu(false)
                            fetchCancelReasons()
                            setCancelModal(true)
                        }}
                    >
                        <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
                        <Text style={[styles.menuText, { color: "#FF3B30" }]}>Cancel Ride</Text>
                    </TouchableOpacity>

                </View>
            )}
        </View>
    )

    const renderCancelModal = () => (
        <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Cancel Ride</Text>
                        <TouchableOpacity onPress={() => setCancelModal(false)}>
                            <Ionicons name="close" size={24} color="#333" />
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
    )

    const renderHelpButton = () => (
        <View style={styles.helpButtonContainer}>
            <TouchableOpacity style={styles.helpButton} onPress={showEmergencyAlert}>
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
                <Text style={styles.helpButtonText}>Help</Text>
            </TouchableOpacity>
        </View>
    )

    const renderRideDetails = () => (
        <View style={styles.rideDetails}>
            {/* Driver Info */}
            <View style={styles.driverCard}>
                <View style={styles.driverAvatar}>
                    <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driverInfo?.name || "Driver"}</Text>
                    <View style={styles.driverMeta}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <Text style={styles.rating}>4.8</Text>
                        <Text style={styles.vehicleInfo}>• {driverInfo?.rideVehicleInfo?.vehicleName || "Vehicle"}</Text>
                    </View>
                </View>
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="call" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="chatbubble" size={20} color="#007AFF" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Route Info */}
            <View style={styles.routeContainer}>
                <View style={styles.routeItem}>
                    <View style={[styles.routeDot, { backgroundColor: "#4CAF50" }]} />
                    <View style={styles.routeInfo}>
                        <Text style={styles.routeLabel}>Pickup</Text>
                        <Text style={styles.routeAddress} numberOfLines={2}>
                            {activeRideData?.pickup_address?.formatted_address || "Pickup location"}
                        </Text>
                    </View>
                </View>

                {activeRideData?.ride_otp && (
                    <View style={styles.otpContainer}>
                        <Text style={styles.otpLabel}>OTP:</Text>
                        <Text style={styles.otpValue}>{activeRideData.ride_otp}</Text>
                    </View>
                )}

                <View style={styles.routeLine} />

                <View style={styles.routeItem}>
                    <View style={[styles.routeDot, { backgroundColor: "#FF6B35" }]} />
                    <View style={styles.routeInfo}>
                        <Text style={styles.routeLabel}>Drop-off</Text>
                        <Text style={styles.routeAddress} numberOfLines={2}>
                            {activeRideData?.drop_address?.formatted_address || "Drop location"}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Fare Details */}
            <View style={styles.fareContainer}>
                <Text style={styles.fareTitle}>Fare: ₹{activeRideData?.pricing?.total_fare || "0"}</Text>
                <Text style={styles.paymentMethod}>{activeRideData?.payment_method || "Cash"}</Text>
            </View>
        </View>
    )

    if (loading && !activeRideData) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#fff" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading ride details...</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.container}>


            {renderHeader()}
            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.mapContainer}>
                    <NewUserAndDriverMap
                        userLocation={location}
                        DriverLocation={driverInfo?.location?.coordinates}
                        DropLocation={activeRideData?.drop_location?.coordinates}
                        rideStatus={activeRideData?.ride_status}
                    />
                </View>

                {renderRideDetails()}

                {/* Add some bottom padding for the help button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {renderHelpButton()}
            {renderCancelModal()}

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchRideDetails}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: "#666",
    },
    header: {
        marginTop: 35,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
        position: "relative",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    statusContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 16,
    },
    statusText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: "600",
    },
    menuButton: {
        padding: 8,
    },
    menuDropdown: {
        position: "absolute",
        top: 50,
        right: 16,
        backgroundColor: "#fff",
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
        minWidth: 160,
        zIndex: 1000,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuText: {
        marginLeft: 12,
        fontSize: 16,
        color: "#333",
    },
    mapContainer: {

        height: height * 0.5, // Fixed height instead of flex: 1
    },
    rideDetails: {
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingTop: 16,
        maxHeight: height * 0.6,
    },
    driverCard: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    driverAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#007AFF",
        justifyContent: "center",
        alignItems: "center",
    },
    driverInfo: {
        flex: 1,
        marginLeft: 12,
    },
    driverName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
    },
    driverMeta: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    rating: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: "500",
        color: "#333",
    },
    vehicleInfo: {
        fontSize: 14,
        color: "#666",
    },
    actionButtons: {
        flexDirection: "row",
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#E3F2FD",
        justifyContent: "center",
        alignItems: "center",
        marginLeft: 8,
    },
    routeContainer: {
        paddingVertical: 16,
    },
    routeItem: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
    },
    routeLine: {
        width: 2,
        height: 20,
        backgroundColor: "#ddd",
        marginLeft: 5,
        marginVertical: 8,
    },
    routeInfo: {
        flex: 1,
        marginLeft: 16,
    },
    routeLabel: {
        fontSize: 12,
        color: "#666",
        textTransform: "uppercase",
        fontWeight: "600",
    },
    routeAddress: {
        fontSize: 14,
        color: "#333",
        marginTop: 2,
    },
    otpContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 28,
        marginVertical: 8,
        backgroundColor: "#E8F5E8",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        alignSelf: "flex-start",
    },
    otpLabel: {
        fontSize: 12,
        color: "#4CAF50",
        fontWeight: "600",
    },
    otpValue: {
        fontSize: 16,
        color: "#4CAF50",
        fontWeight: "700",
        marginLeft: 8,
    },
    fareContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    fareTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
    },
    paymentMethod: {
        fontSize: 14,
        color: "#666",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#fff",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: height * 0.8,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f0f0",
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "600",
        color: "#333",
    },
    modalSubtitle: {
        fontSize: 16,
        color: "#666",
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    reasonsList: {
        maxHeight: height * 0.4,
    },
    reasonItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f8f8f8",
    },
    selectedReason: {
        backgroundColor: "#E3F2FD",
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "#007AFF",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 2,
    },
    radioSelected: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#007AFF",
    },
    reasonContent: {
        flex: 1,
        marginLeft: 12,
    },
    reasonName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
    },
    reasonDescription: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
    },
    modalActions: {
        flexDirection: "row",
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
    },
    cancelModalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#ddd",
        alignItems: "center",
        marginRight: 8,
    },
    cancelModalText: {
        fontSize: 16,
        color: "#333",
        fontWeight: "500",
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: "#FF3B30",
        alignItems: "center",
        marginLeft: 8,
    },
    disabledButton: {
        backgroundColor: "#ccc",
    },
    confirmButtonText: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "600",
    },
    errorContainer: {
        position: "absolute",
        top: 100,
        left: 16,
        right: 16,
        backgroundColor: "#FF3B30",
        padding: 16,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    errorText: {
        color: "#fff",
        fontSize: 14,
        flex: 1,
    },
    retryButton: {
        backgroundColor: "#fff",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    retryText: {
        color: "#FF3B30",
        fontWeight: "600",
    },
    scrollContainer: {
        flex: 1,
    },
    helpButtonContainer: {
        position: "absolute",
        bottom: 20,
        left: 16,
        right: 16,
    },
    helpButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FF3B30",
        paddingVertical: 16,
        borderRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    helpButtonText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: "600",
        color: "#fff",
    },
})
