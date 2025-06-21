import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { Audio } from 'expo-av';
import LottieView from 'lottie-react-native';
import { NewRidePooling } from '../../utils/NewRidePooling';
import { API_BASE_URL, colors } from '../../NewConstant';
import { useFetchUserDetails } from '../../../hooks/New Hookes/RiderDetailsHooks';
import axios from 'axios';
import useNotificationPermission from '../../../hooks/notification';
import { useRideDriver } from '../../../context/RideContext';
import { useNavigation } from '@react-navigation/native';

const screenHeight = Dimensions.get('window').height;

export default function RideSearching({refreshing}) {
    const { userData, loading, error, fetchUserDetails, isOnline } = useFetchUserDetails();
    const [rides, setRides] = useState([]);
    const [searching, setSearching] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [lastStatusCheck, setLastStatusCheck] = useState(null);
    const [statusHistory, setStatusHistory] = useState([]);
    const [currentRide, setCurrentRide] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const navigation = useNavigation()
    // Audio refs
    const notificationSound = useRef(null);
    const intervalRef = useRef(null);
    const statusIntervalRef = useRef(null);
    const soundIntervalRef = useRef(null);

    // Load notification sound
    useEffect(() => {
        loadNotificationSound();
        return () => {
            if (notificationSound.current) {
                notificationSound.current.unloadAsync();
            }
        };
    }, []);

    const loadNotificationSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                require('./sound.mp3'),
                { shouldPlay: false }
            );
            notificationSound.current = sound;
        } catch (error) {
            console.log('Error loading notification sound:', error);
        }
    };



    const playNotificationSound = async () => {
        try {
            if (notificationSound.current) {
                await notificationSound.current.replayAsync();
            }
        } catch (error) {
            console.log('Error playing notification sound:', error);
        }
    };

    const startContinuousSound = () => {
        soundIntervalRef.current = setInterval(async () => {
            if (modalOpen && !searching) {
                await playNotificationSound();
            }
        }, 2000); // Play sound every 2 seconds
    };

    const stopContinuousSound = () => {
        if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
            soundIntervalRef.current = null;
        }
    };

    const checkRideStatus = async (rideId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/new/status-driver/${rideId}`);
            const rideStatus = response.data.data.ride_status;

            console.log(`Ride status for ${rideId}: ${rideStatus}`);

            if (rideStatus === 'driver_assigned' || rideStatus === 'cancelled') {
                console.log(`Ride ${rideId} is ${rideStatus}, closing modal and clearing state`);

                // Immediately close modal and clear all states
                setShowModal(false);
                setModalOpen(false);
                setCurrentRide(null);
                setRides([]);
                setSearching(true);

                // Stop all intervals
                stopStatusPolling();
                stopContinuousSound();

                // Restart ride pooling for new rides
                startRidePolling();

                return true; // Ride is completed/cancelled
            }

            return false; // Ride is still active
        } catch (error) {
            console.log('Error checking ride status:', error);
            return false;
        }
    };

    const startStatusPolling = (rideId) => {
        stopStatusPolling(); // Clear any existing interval

        statusIntervalRef.current = setInterval(async () => {
            const shouldStop = await checkRideStatus(rideId);
            if (shouldStop) {
                stopStatusPolling();
            }
        }, 3000); // Check status every 3 seconds
    };

    const stopStatusPolling = () => {
        if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
        }
    };

    useEffect(() => {
        console.log("I am refreshing",refreshing)
        fetchUserDetails();
    }, [refreshing]);

    useEffect(() => {

        if (userData?._id && isOnline && !userData?.on_ride_id) {
            startRidePolling();
        } else {
            stopRidePolling();
        }

        return () => {
            stopRidePolling();
            stopStatusPolling();
            stopContinuousSound();
        };
    }, [userData, isOnline,refreshing]);

    const startRidePolling = () => {
        stopRidePolling(); // Clear any existing interval

        intervalRef.current = setInterval(async () => {
            await checkForRides();
        }, 5000); // Check every second as requested
    };

    const stopRidePolling = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    const checkForRides = async () => {
        try {
            const timestamp = new Date().toLocaleTimeString();

            const data = await NewRidePooling(userData._id);

            if (data?.length > 0) {
                const firstRide = data[0];
                const rideId = firstRide._id;

                setRides([firstRide]);
                setCurrentRide(firstRide);
                setSearching(false);
                setShowModal(true);
                setModalOpen(true);

                // Update status history
                setStatusHistory(prev => [...prev.slice(-4), {
                    timestamp,
                    status: 'ride_found',
                    rideId: rideId.substring(0, 8),
                    data: firstRide
                }]);
                setLastStatusCheck(timestamp);

                // Play notification sound and start continuous sound
                await playNotificationSound();
                startContinuousSound();

                // Stop ride pooling and start status polling
                stopRidePolling();
                startStatusPolling(rideId);

            } else {
                
                setRides([]);
                setSearching(true);
                setShowModal(false);
                setModalOpen(false);

                // Update status history
                setStatusHistory(prev => [...prev.slice(-4), {
                    timestamp,
                    status: 'no_rides',
                    rideId: null,
                    data: null
                }]);
                setLastStatusCheck(timestamp);
            }
        } catch (err) {
            console.log("❌ Ride pooling error:", err.message);
            setStatusHistory(prev => [...prev.slice(-4), {
                timestamp: new Date().toLocaleTimeString(),
                status: 'error',
                rideId: null,
                data: { error: err.message }
            }]);
        }
    };

    const handleAccept = async () => {
        console.log("✅ Attempting to accept ride...");

        // Validate required fields
        const action = 'accept';
        const rideId = currentRide?._id;
        const riderId = userData?._id;

        if (!rideId || !riderId) {
            console.error("❌ Validation Failed: Missing rideId or riderId.");
            console.log("rideId:", rideId);
            console.log("riderId:", riderId);
            return;
        }

        const requestBody = {
            action,
            rideId,
            riderId
        };

        console.log("📤 Sending request with body:", requestBody);

        try {
            const response = await axios.post(`${API_BASE_URL}/new/ride-action-reject-accepet`, requestBody);
            console.log("✅ Ride accepted successfully:", response.data);

            // Stop all sounds and intervals AFTER successful API call
            stopContinuousSound();
            stopStatusPolling();
            stopRidePolling();

            // Close modal and clear states
            setShowModal(false);
            setModalOpen(false);
            navigation.navigate('start', { rideData: rideId });

            // Clear ride data
            setCurrentRide(null);
            setRides([]);


        } catch (error) {
            console.error("❌ API Error while accepting ride:");
            console.log("Error response:", error?.response?.data || error.message);
        }
    };



    const handleReject = async () => {
      console.log("✅ Attempting to accept ride...");

        // Validate required fields
        const action = 'reject';
        const rideId = currentRide?._id;
        const riderId = userData?._id;

        if (!rideId || !riderId) {
            console.error("❌ Validation Failed: Missing rideId or riderId.");
            console.log("rideId:", rideId);
            console.log("riderId:", riderId);
            return;
        }

        const requestBody = {
            action,
            rideId,
            riderId
        };

        console.log("📤 Sending request with body:", requestBody);

        try {
            const response = await axios.post(`${API_BASE_URL}/new/ride-action-reject-accepet`, requestBody);
            console.log("✅ Ride accepted successfully:", response.data);

            // Stop all sounds and intervals AFTER successful API call
            stopContinuousSound();
            stopStatusPolling();
                 startRidePolling();


            // Close modal and clear states
            setShowModal(false);
            setModalOpen(false);
          
            setCurrentRide(null);
            setRides([]);


        } catch (error) {
            console.error("❌ API Error while accepting ride:");
                  setShowModal(false);
            setModalOpen(false);
          
            setCurrentRide(null);
            setRides([]);

            console.log("Error response:", error?.response?.data || error.message);
        }
    };

    const formatCurrency = (amount) => {
        return `₹${parseFloat(amount).toFixed(2)}`;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'checking': return colors.primary;
            case 'no_rides': return colors.textSecondary;
            case 'error': return colors.error;
            case 'ride_found': return colors.success;
            default: return colors.success;
        }
    };

    const ride = rides[0];

    return (
        <View style={styles.container}>
            {isOnline ? (
                <>
                    {/* Status Display */}
                    {/* <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>🔄 Live Status</Text>
            <Text style={styles.lastCheck}>
              Last Check: {lastStatusCheck || 'Not started'}
            </Text> */}

                    {/* Status History */}
                    {/* <ScrollView style={styles.statusHistory} showsVerticalScrollIndicator={false}>
              {statusHistory.map((item, index) => (
                <View key={index} style={styles.statusItem}>
                  <Text style={[styles.statusTime, { color: getStatusColor(item.status) }]}>
                    {item.timestamp}
                  </Text>
                  <Text style={styles.statusText}>
                    {item.status === 'checking' && '🔍 Searching...'}
                    {item.status === 'no_rides' && '📍 No rides found'}
                    {item.status === 'error' && '❌ Error occurred'}
                    {item.status === 'ride_found' && '🚗 Ride available'}
                  </Text>
                  {item.rideId && (
                    <Text style={styles.rideId}>ID: {item.rideId}...</Text>
                  )}
                </View>
              ))}
            </ScrollView> */}
                    {/* </View> */}

                    {searching ? (
                        <>
                            <LottieView
                                source={require("./car.json")}
                                autoPlay
                                loop
                                style={styles.waitingAnimation}
                            />
                            <Text style={styles.searchingText}>
                                🔍 Searching for rides every second...
                            </Text>

                        </>
                    ) : null}
                </>
            ) : (
                <View style={styles.messageBox}>
                    <Image
                        source={require('./offline.png')}
                        style={styles.image}
                        resizeMode="contain"
                    />
                    <Text style={styles.mainMessage}>
                        Please <Text style={styles.highlight}>go online</Text> to take rides
                    </Text>
                    <Text style={styles.subMessage}>
                        Boost your earnings by staying available!
                    </Text>
                </View>
            )}

            {loading && <ActivityIndicator size="large" color={colors.red200} />}
            {error && <Text style={styles.errorText}>Error fetching user: {error.message}</Text>}

            {/* Enhanced Full-Screen Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showModal}
                onRequestClose={() => {
                    // Handle modal close - stop sounds and resume searching
                    stopContinuousSound();
                    stopStatusPolling();
                    setShowModal(false);
                    setModalOpen(false);
                    setCurrentRide(null);
                    setRides([]);
                    setSearching(true);
                    startRidePolling();
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>🚗 Incoming Ride Request</Text>

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
                                    <Text style={styles.label}>Platform Fee:</Text>
                                    <Text style={styles.value}>{formatCurrency(ride?.pricing?.platform_fee)}</Text>
                                </View>
                                <View style={[styles.detailRow, styles.totalRow]}>
                                    <Text style={styles.totalLabel}>Total Fare:</Text>
                                    <Text style={styles.totalValue}>{formatCurrency(ride?.pricing?.total_fare)}</Text>
                                </View>
                            </View>

                            {/* Additional Info */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>ℹ️ Additional Info</Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Payment Method:</Text>
                                    <Text style={styles.value}>{ride?.payment_method?.toUpperCase()}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Vehicle Type:</Text>
                                    <Text style={styles.value}>{ride?.vehicle_type?.toUpperCase()}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Ride OTP:</Text>
                                    <Text style={[styles.value, styles.otp]}>{ride?.ride_otp}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Status:</Text>
                                    <Text style={styles.value}>{ride?.ride_status?.toUpperCase()}</Text>
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                                <Text style={styles.buttonText}>❌ Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept}>
                                <Text style={styles.buttonText}>✅ Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
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
        fontWeight: '700',
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
        fontWeight: '600',
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
        alignSelf: 'center',
        marginBottom: 20,
    },
    searchingText: {
        fontSize: 18,
        color: colors.textPrimary,
        fontWeight: '600',
        textAlign: 'center',
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
        alignItems: 'center',
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
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    highlight: {
        color: colors.success,
    },
    subMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    errorText: {
        color: colors.error,
        marginTop: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: '#000000aa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '95%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        maxHeight: screenHeight * 0.85,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 16,
        textAlign: 'center',
    },
    rideDetails: {
        maxHeight: screenHeight * 0.6,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        paddingBottom: 4,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
        paddingVertical: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        flex: 1,
    },
    value: {
        fontSize: 14,
        color: colors.textPrimary,
        flex: 2,
        textAlign: 'right',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        paddingTop: 8,
        marginTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.success,
    },
    otp: {
        fontWeight: '700',
        fontSize: 16,
        color: colors.primary,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    acceptBtn: {
        backgroundColor: colors.success,
        padding: 16,
        borderRadius: 12,
        width: '48%',
        alignItems: 'center',
        elevation: 2,
    },
    rejectBtn: {
        backgroundColor: colors.error,
        padding: 16,
        borderRadius: 12,
        width: '48%',
        alignItems: 'center',
        elevation: 2,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
});