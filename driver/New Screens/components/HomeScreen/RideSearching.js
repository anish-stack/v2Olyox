
import { useEffect, useState, useRef, useCallback } from "react"
import {
    View,
    Text,
    ActivityIndicator,
    StyleSheet,
    Image,
    Modal,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    Alert,
} from "react-native"
import { Audio } from "expo-av"
import LottieView from "lottie-react-native"
import { NewRidePooling } from "../../utils/NewRidePooling"
import { API_BASE_URL, colors } from "../../NewConstant"
import { useFetchUserDetails } from "../../../hooks/New Hookes/RiderDetailsHooks"
import axios from "axios"
import { useNavigation, useFocusEffect } from "@react-navigation/native"

const screenHeight = Dimensions.get("window").height

export default function RideSearching({ refreshing,id }) {
    const { userData, loading, error, fetchUserDetails, isOnline } = useFetchUserDetails()
    const [rides, setRides] = useState([])
    const [searching, setSearching] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [lastStatusCheck, setLastStatusCheck] = useState(null)
    const [statusHistory, setStatusHistory] = useState([])
    const [currentRide, setCurrentRide] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [isProcessingAction, setIsProcessingAction] = useState(false)
    const navigation = useNavigation()
// console.log("userData",userData)
    // Audio and interval refs
    const notificationSound = useRef(null)
    const intervalRef = useRef(null)
    const statusIntervalRef = useRef(null)
    const soundIntervalRef = useRef(null)
    const isMountedRef = useRef(true)
    const isAudioLoadedRef = useRef(false)

    // Enhanced audio management
    const loadNotificationSound = useCallback(async () => {
        try {
            // Unload existing sound first
            if (notificationSound.current) {
                await notificationSound.current.unloadAsync()
                notificationSound.current = null
                isAudioLoadedRef.current = false
            }

            // Configure audio mode for better performance
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            })

            const { sound } = await Audio.Sound.createAsync(require("./sound.mp3"), {
                shouldPlay: false,
                isLooping: true, // Changed to false for better control
                volume: 1.0,
            })

            notificationSound.current = sound
            isAudioLoadedRef.current = true
            console.log("✅ Notification sound loaded successfully")
        } catch (error) {
            console.log("❌ Error loading notification sound:", error)
            isAudioLoadedRef.current = false
        }
    }, [])
    const playNotificationSound = useCallback(async () => {
        try {
            if (notificationSound.current && isAudioLoadedRef.current) {
                // Get current status
                const status = await notificationSound.current.getStatusAsync()

                // If already playing, don't restart
                if (!status.isPlaying) {
                    await notificationSound.current.setPositionAsync(0)
                    await notificationSound.current.playAsync()
                }
            }
        } catch (error) {
            console.log("❌ Error playing notification sound:", error)
        }
    }, [])
    const stopNotificationSound = useCallback(async () => {
        try {
            if (notificationSound.current && isAudioLoadedRef.current) {
                await notificationSound.current.stopAsync()
                await notificationSound.current.setPositionAsync(0)
                console.log("🔇 Notification sound stopped")
            }
        } catch (error) {
            console.log("❌ Error stopping notification sound:", error)
        }
    }, [])

    const startContinuousSound = useCallback(() => {
        // Only clear the interval, don't stop the currently playing sound
        if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current)
            soundIntervalRef.current = null
        }

        // Play initial sound immediately
        playNotificationSound()

        // Set up interval for continuous playing
        soundIntervalRef.current = setInterval(async () => {
            if (modalOpen && !searching && !isProcessingAction) {
                await playNotificationSound()
            }
        }, 3000)

        console.log("🔊 Started continuous sound")
    }, [modalOpen, searching, isProcessingAction, playNotificationSound])

    const stopContinuousSound = useCallback(async () => {
        // Clear the interval first
        if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current)
            soundIntervalRef.current = null
        }

        // Then stop the actual audio
        await stopNotificationSound()
        console.log("🔇 Stopped continuous sound")
    }, [stopNotificationSound])

    // Enhanced cleanup function
    const cleanupAll = useCallback(async () => {
        console.log("🧹 Starting cleanup...")

        // Stop all intervals
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }

        if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current)
            statusIntervalRef.current = null
        }

        // Stop sound and clear sound interval
        await stopContinuousSound()

        console.log("✅ Cleanup completed")
    }, [stopContinuousSound])

    const checkRideStatus = useCallback(
        async (rideId) => {
            if (!isMountedRef.current) return false

            try {
                const response = await axios.get(`${API_BASE_URL}/new/status-driver/${rideId}`)
                const rideStatus = response.data.data.ride_status

                console.log(`Ride status for ${rideId}: ${rideStatus}`)

                if (rideStatus === "driver_assigned" || rideStatus === "cancelled") {
                    console.log(`Ride ${rideId} is ${rideStatus}, closing modal and clearing state`)

                    // Stop all sounds and intervals immediately
                    await cleanupAll()

                    if (isMountedRef.current) {
                        // Clear all states
                        setShowModal(false)
                        setModalOpen(false)
                        setCurrentRide(null)
                        setRides([])
                        setSearching(true)
                        setIsProcessingAction(false)

                        // Restart ride pooling for new rides
                        startRidePolling()
                    }

                    return true // Ride is completed/cancelled
                }

                return false // Ride is still active
            } catch (error) {
                console.log("❌ Error checking ride status:", error)
                return false
            }
        },
        [cleanupAll],
    )

    const startStatusPolling = useCallback(
        (rideId) => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current)
            }

            statusIntervalRef.current = setInterval(async () => {
                if (!isMountedRef.current) return

                const shouldStop = await checkRideStatus(rideId)
                if (shouldStop && statusIntervalRef.current) {
                    clearInterval(statusIntervalRef.current)
                    statusIntervalRef.current = null
                }
            }, 3000) // Check status every 3 seconds
        },
        [checkRideStatus],
    )

    // Load sound on component mount
    useEffect(() => {
        loadNotificationSound()

        return () => {
            isMountedRef.current = false
            cleanupAll()

            // Unload sound
            if (notificationSound.current) {
                notificationSound.current.unloadAsync().catch(console.log)
            }
        }
    }, [loadNotificationSound, cleanupAll])

    // Focus effect for proper cleanup when screen loses focus
    useFocusEffect(
        useCallback(() => {
            isMountedRef.current = true

            return () => {
                isMountedRef.current = false
                cleanupAll()
            }
        }, [cleanupAll]),
    )

    useEffect(() => {
        fetchUserDetails()
    }, [])

    useEffect(() => {
        if (userData?._id && isOnline && !userData?.on_ride_id) {
            startRidePolling()
        } else {
            cleanupAll()
        }
    }, [userData, isOnline, refreshing])

  const startRidePolling = useCallback(() => {
    console.log("🚦 Starting ride polling...");

    if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
        checkForRides(); // don't await inside setInterval
    }, 7000); // Every 5 seconds
}, [userData]);


    const checkForRides = useCallback(async () => {
        console.log("🔍 Checking for new rides...")
        if (!isMountedRef.current || isProcessingAction) return

        try {
            const timestamp = new Date().toLocaleTimeString()
            let sendRider  = userData?._id || id
            if(sendRider === undefined || sendRider === null){
                console.log("❌ User data is not available, cannot fetch rides")    
                return
            }

            const data = await NewRidePooling(sendRider)
            console.log("📥 Ride pooling response:", data)
            if (data?.length > 0 && data[0]?._id) {
                const firstRide = data[0];
                const rideId = firstRide._id;

                setRides([firstRide]);
                setCurrentRide(firstRide)
                setSearching(false)
                setShowModal(true)
                setModalOpen(true)

                // Update status history
                setStatusHistory((prev) => [
                    ...prev.slice(-4),
                    {
                        timestamp,
                        status: "ride_found",
                        rideId: rideId.substring(0, 8),
                        data: firstRide,
                    },
                ])
                setLastStatusCheck(timestamp)

                // Play notification sound and start continuous sound
                await playNotificationSound()
                startContinuousSound()

                // Stop ride pooling and start status polling
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
                startStatusPolling(rideId)
            } else if (isMountedRef.current) {
                setRides([])
                setSearching(true)
                setShowModal(false)
                setModalOpen(false)

                // Update status history
                setStatusHistory((prev) => [
                    ...prev.slice(-4),
                    {
                        timestamp,
                        status: "no_rides",
                        rideId: null,
                        data: null,
                    },
                ])
                setLastStatusCheck(timestamp)
            }
        } catch (err) {
            console.log("❌ Ride pooling error:", err.message)
            if (isMountedRef.current) {
                setStatusHistory((prev) => [
                    ...prev.slice(-4),
                    {
                        timestamp: new Date().toLocaleTimeString(),
                        status: "error",
                        rideId: null,
                        data: { error: err.message },
                    },
                ])
            }
        }
    }, [userData])

    const handleAccept = useCallback(async () => {
        if (isProcessingAction) return

        console.log("✅ Attempting to accept ride...")
        setIsProcessingAction(true)

        // Stop sound immediately when user takes action
        await stopContinuousSound()

        // Validate required fields
        const action = "accept"
        const rideId = currentRide?._id
        const riderId = userData?._id

        if (!rideId || !riderId) {
            console.error("❌ Validation Failed: Missing rideId or riderId.")
            setIsProcessingAction(false)
            return
        }

        const requestBody = {
            action,
            rideId,
            riderId,
        }

        console.log("📤 Sending request with body:", requestBody)

        try {
            const response = await axios.post(`${API_BASE_URL}/new/ride-action-reject-accepet`, requestBody)
            console.log("✅ Ride accepted successfully:", response.data)

            // Complete cleanup
            await cleanupAll()

            if (isMountedRef.current) {
                // Close modal and clear states
                setShowModal(false)
                setModalOpen(false)
                setCurrentRide(null)
                setRides([])
                setIsProcessingAction(false)

                // Navigate to ride start
                navigation.navigate("start", { rideData: rideId })
            }
        } catch (error) {
            console.error("❌ API Error while accepting ride:", error?.response?.data || error.message)

            if (isMountedRef.current) {
                setIsProcessingAction(false)
                Alert.alert("Error", "Failed to accept ride. Please try again.")
            }
        }
    }, [isProcessingAction, currentRide, userData, stopContinuousSound, cleanupAll, navigation])

    const handleReject = useCallback(async () => {
        if (isProcessingAction) return

        console.log("❌ Attempting to reject ride...")
        setIsProcessingAction(true)

        // Stop sound immediately when user takes action
        await stopContinuousSound()

        // Validate required fields
        const action = "reject"
        const rideId = currentRide?._id
        const riderId = userData?._id

        if (!rideId || !riderId) {
            console.error("❌ Validation Failed: Missing rideId or riderId.")
            setIsProcessingAction(false)
            return
        }

        const requestBody = {
            action,
            rideId,
            riderId,
        }

        console.log("📤 Sending request with body:", requestBody)

        try {
            const response = await axios.post(`${API_BASE_URL}/new/ride-action-reject-accepet`, requestBody)
            console.log("✅ Ride rejected successfully:", response.data)

            // Complete cleanup
            await cleanupAll()

            if (isMountedRef.current) {
                // Close modal and clear states
                setShowModal(false)
                setModalOpen(false)
                setCurrentRide(null)
                setRides([])
                setIsProcessingAction(false)

                // Restart ride polling
                startRidePolling()
            }
        } catch (error) {
            console.error("❌ API Error while rejecting ride:", error?.response?.data || error.message)

            if (isMountedRef.current) {
                // Even on error, close modal and restart polling
                setShowModal(false)
                setModalOpen(false)
                setCurrentRide(null)
                setRides([])
                setIsProcessingAction(false)
                startRidePolling()
            }
        }
    }, [isProcessingAction, currentRide, userData, stopContinuousSound, cleanupAll, startRidePolling])

    const handleModalClose = useCallback(async () => {
        console.log("🚪 Modal closing...")

        // Stop sounds immediately
        await stopContinuousSound()

        // Complete cleanup
        await cleanupAll()

        if (isMountedRef.current) {
            setShowModal(false)
            setModalOpen(false)
            setCurrentRide(null)
            setRides([])
            setSearching(true)
            setIsProcessingAction(false)

            // Restart ride polling
            startRidePolling()
        }
    }, [stopContinuousSound, cleanupAll, startRidePolling])

    const formatCurrency = (amount) => {
        return `₹${Number.parseFloat(amount).toFixed(2)}`
    }

    const ride = rides[0]

    return (
        <View style={styles.container}>
            {isOnline ? (
                <>
                    {searching ? (
                        <>
                            <LottieView source={require("./car.json")} autoPlay loop style={styles.waitingAnimation} />
                            <Text style={styles.searchingText}>🔍 Searching for rides every 5 seconds...</Text>
                        </>
                    ) : null}
                </>
            ) : (
                <View style={styles.messageBox}>
                    <Image source={require("./offline.png")} style={styles.image} resizeMode="contain" />
                    <Text style={styles.mainMessage}>
                        Please <Text style={styles.highlight}>go online</Text> to take rides
                    </Text>
                    <Text style={styles.subMessage}>Boost your earnings by staying available!</Text>
                </View>
            )}

            {loading && <ActivityIndicator size="large" color={colors.red200} />}
            {error && <Text style={styles.errorText}>Error fetching user: {error.message}</Text>}

            {/* Enhanced Full-Screen Modal */}
            <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={handleModalClose}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🚗 Incoming Ride Request</Text>
                            <TouchableOpacity style={styles.closeButton} onPress={handleModalClose} disabled={isProcessingAction}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.rideDetails} showsVerticalScrollIndicator={false}>
                            {/* Basic Ride Info */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📍 Trip Details</Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Pickup:</Text>
                                    <Text style={styles.value}>{ride?.pickup_address?.formatted_address}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Drop:</Text>
                                    <Text style={styles.value}>{ride?.drop_address?.formatted_address}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Distance:</Text>
                                    <Text style={styles.value}>{ride?.route_info?.distance} km</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Duration:</Text>
                                    <Text style={styles.value}>{ride?.route_info?.duration} mins</Text>
                                </View>
                            </View>

                            {/* Pricing Details */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>💰 Pricing Breakdown</Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Base Fare:</Text>
                                    <Text style={styles.value}>{formatCurrency(ride?.pricing?.base_fare)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Distance Fare:</Text>
                                    <Text style={styles.value}>{formatCurrency(ride?.pricing?.distance_fare)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Time Fare:</Text>
                                    <Text style={styles.value}>{formatCurrency(ride?.pricing?.time_fare)}</Text>
                                </View>
                                {ride?.pricing?.night_charge > 0 && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.label}>Night Charge:</Text>
                                        <Text style={styles.value}>{formatCurrency(ride?.pricing?.night_charge)}</Text>
                                    </View>
                                )}
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Extra Earning:</Text>
                                    <Text style={styles.value}>{formatCurrency(ride?.pricing?.platform_fee)}</Text>
                                </View>
                                <View style={[styles.detailRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>Total Fare:</Text>
                                    <Text style={styles.totalValue}>{formatCurrency(ride?.pricing?.total_fare)}</Text>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={[styles.rejectBtn, isProcessingAction && styles.disabledButton]}
                                onPress={handleReject}
                                disabled={isProcessingAction}
                            >
                                {isProcessingAction ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.buttonText}>❌ Reject</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.acceptBtn, isProcessingAction && styles.disabledButton]}
                                onPress={handleAccept}
                                disabled={isProcessingAction}
                            >
                                {isProcessingAction ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.buttonText}>✅ Accept</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundDefault,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    statusContainer: {
        backgroundColor: colors.backgroundPaper,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        elevation: 2,
        shadowColor: colors.borderDark,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: 8,
    },
    lastCheck: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 12,
    },
    statusHistory: {
        maxHeight: 120,
    },
    statusItem: {
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        paddingLeft: 12,
        paddingVertical: 6,
        marginBottom: 8,
    },
    statusTime: {
        fontSize: 12,
        fontWeight: "600",
    },
    statusText: {
        fontSize: 14,
        color: colors.textPrimary,
        marginTop: 2,
    },
    rideId: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    waitingAnimation: {
        width: 120,
        height: 120,
        alignSelf: "center",
        marginBottom: 20,
    },
    searchingText: {
        fontSize: 18,
        color: colors.textPrimary,
        fontWeight: "600",
        textAlign: "center",
        marginBottom: 20,
    },
    searchingStats: {
        backgroundColor: colors.backgroundPaper,
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
    },
    statsText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 6,
    },
    messageBox: {
        alignItems: "center",
        padding: 14,
        backgroundColor: colors.backgroundPaper,
        borderRadius: 12,
        elevation: 2,
        marginBottom: 10,
        shadowColor: colors.borderDark,
        shadowOpacity: 0.2,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    image: {
        width: 80,
        height: 80,
        marginBottom: 15,
    },
    mainMessage: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.textPrimary,
        textAlign: "center",
    },
    highlight: {
        color: colors.success,
    },
    subMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: 8,
        textAlign: "center",
    },
    errorText: {
        color: colors.error,
        marginTop: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "#000000aa",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "95%",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        maxHeight: screenHeight * 0.85,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: colors.textPrimary,
        flex: 1,
        textAlign: "center",
    },
    closeButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.error,
        justifyContent: "center",
        alignItems: "center",
    },
    closeButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    rideDetails: {
        maxHeight: screenHeight * 0.6,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.textPrimary,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        paddingBottom: 4,
    },
    detailRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8,
        paddingVertical: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.textSecondary,
        flex: 1,
    },
    value: {
        fontSize: 14,
        color: colors.textPrimary,
        flex: 2,
        textAlign: "right",
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        paddingTop: 8,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "700",
        color: colors.textPrimary,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.success,
    },
    otp: {
        fontWeight: "700",
        fontSize: 16,
        color: colors.primary,
    },
    actionButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    acceptBtn: {
        backgroundColor: colors.success,
        padding: 16,
        borderRadius: 12,
        width: "48%",
        alignItems: "center",
        elevation: 2,
    },
    rejectBtn: {
        backgroundColor: colors.error,
        padding: 16,
        borderRadius: 12,
        width: "48%",
        alignItems: "center", // Corrected: changed 'center' to 'center'
        elevation: 2,
    },
    disabledButton: {
        opacity: 0.6,
    },
    buttonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 16,
    },
})
