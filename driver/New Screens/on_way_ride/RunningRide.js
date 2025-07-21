import {
    View,
    Text,
    ScrollView,
    StyleSheet,
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { CommonActions, useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import { Audio } from "expo-av"

import { useFetchUserDetails } from "../../hooks/New Hookes/RiderDetailsHooks";
import NewMap from "../components/running-ride/NewMap";
import { MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL } from "../NewConstant";
import * as Updates from 'expo-updates';
import HeaderNew from "../components/Header/HeaderNew";
import useSettings from "../../hooks/settings.hook";

const { width, height } = Dimensions.get('window');

// Enhanced color scheme
const COLORS = {
    primary: '#1a73e8',
    secondary: '#34a853',
    danger: '#ea4335',
    warning: '#fbbc04',
    success: '#34a853',
    background: '#f8f9fa',
    surface: '#ffffff',
    text: {
        primary: '#202124',
        secondary: '#5f6368',
        light: '#9aa0a6',
    },
    border: '#e8eaed',
    shadow: 'rgba(0, 0, 0, 0.1)',
};



export default function RunningRide() {
    const route = useRoute();
    const { rideData } = route.params || {};
    const navigation = useNavigation();
    const { fetchUserDetails, userData } = useFetchUserDetails();

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const { settings } = useSettings()
    // Core state
    const [activeRideData, setActiveRideData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userLoading, setUserLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // Modal states
    const [showCancelModal, setCancelModal] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Form states
    const [cancelReasons, setCancelReasons] = useState([]);
    const [selectedReason, setSelectedReason] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');

    // UI states
    const [activeTab, setActiveTab] = useState('user');
    const [rideStep, setRideStep] = useState('pickup');

    // Memoized values
    const rideStatus = useMemo(() => activeRideData?.ride_status, [activeRideData?.ride_status]);
    const paymentStatus = useMemo(() => activeRideData?.payment_status, [activeRideData?.payment_status]);
    const totalFare = useMemo(() => activeRideData?.pricing?.total_fare?.toFixed(2), [activeRideData?.pricing?.total_fare]);

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
        ]).start();
    }, []);

    // Optimized user details fetch
    const handleFetchUserDetails = useCallback(async () => {
        try {
            setUserLoading(true);
            await fetchUserDetails();
        } catch (error) {
            console.error("❌ Error fetching user details:", error);
            setError("Unable to load user information. Please try again.");
        } finally {
            setUserLoading(false);
        }
    }, [fetchUserDetails]);

    // Enhanced ride details fetch with better error handling
    const fetchActiveRideDetails = useCallback(async (isRetry = false) => {
        if (!isRetry) setLoading(true);
        setError(null);

        try {
            if (userData?.on_ride_id) {
                const response = await axios.get(
                    `https://www.appv2.olyox.com/rider/${userData.on_ride_id}`,
                    { timeout: 15000 }
                );

                if (response.data?.data) {
                    setActiveRideData(response.data.data);
                    setRetryCount(0);

                    // Update ride step based on status
                    const status = response.data.data.ride_status;
                    switch (status) {
                        case 'driver_assigned':
                            setRideStep('pickup');
                            break;
                        case 'driver_arrived':
                            setRideStep('otp');
                            break;
                        case 'in_progress':
                            setRideStep('drop');
                            break;
                        case 'completed':
                            setRideStep('payment');
                            break;
                        default:
                            setRideStep('pickup');
                    }
                } else {
                    throw new Error("No ride data available");
                }
            } else {
                setActiveRideData(null);
            }
        } catch (error) {
            console.error("❌ Error fetching ride details:", error);

            let errorMessage = "Something went wrong. Please try again.";
            if (error?.code === 'ECONNABORTED') {
                errorMessage = "Connection timeout. Please check your internet.";
            } else if (error?.response?.status === 404) {
                errorMessage = "Ride not found. It may have been completed or cancelled.";
            } else if (error?.response?.status >= 500) {
                errorMessage = "Server is temporarily unavailable. Please try again.";
            }

            setError(errorMessage);
            setActiveRideData(null);

            // Auto retry with exponential backoff
            if (retryCount < 3 && userData?.on_ride_id) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    fetchActiveRideDetails(true);
                }, delay);
            }
        } finally {
            if (!isRetry) setLoading(false);
        }
    }, [userData?.on_ride_id, retryCount]);

    // Optimized polling with proper cleanup
    useFocusEffect(
        useCallback(() => {
            if (!activeRideData) return;

            const currentRoute = navigation.getState()?.routes?.[navigation.getState().index]?.name;
            if (currentRoute !== 'start') return;

            const pollingInterval = rideStatus === 'in_progress' ? 5000 : 10000;

            const interval = setInterval(async () => {
                try {
                    await fetchActiveRideDetails(true);

                    const isCancelled = rideStatus === 'cancelled';
                    const isCompleted = rideStatus === 'completed' && paymentStatus === 'completed';

                    if (isCancelled || isCompleted) {
                        clearInterval(interval);

                        Alert.alert(
                            "Ride Update",
                            isCancelled ? "Your ride has been cancelled." : "Ride completed successfully!",
                            [{
                                text: "OK",
                                onPress: async () => {
                                    await Updates.reloadAsync();
                                    navigation.dispatch(
                                        CommonActions.reset({
                                            index: 0,
                                            routes: [{ name: 'Home' }],
                                        })
                                    );
                                },
                            }],
                            { cancelable: false }
                        );
                    }
                } catch (err) {
                    console.error("Polling error:", err);
                }
            }, pollingInterval);

            return () => clearInterval(interval);
        }, [rideStatus, paymentStatus, navigation, fetchActiveRideDetails])
    );

    // Enhanced API calls with better UX
    const markReached = useCallback(async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/new/change-ride-status`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                status: 'driver_arrived'
            });

            if (response.data.success) {
                setRideStep('otp');
                setShowOtpModal(true);
                await fetchActiveRideDetails();

                Alert.alert(
                    'Location Reached! 🎯',
                    'You have successfully reached the pickup location.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert(
                'Unable to Update Status',
                'Please check your connection and try again.',
                [{ text: 'OK' }]
            );
        }
    }, [userData?._id, activeRideData?._id, fetchActiveRideDetails]);

    const verifyOtp = useCallback(async () => {
        if (!otp || otp.length !== 4) {
            Alert.alert('Invalid OTP', 'Please enter a valid 4-digit OTP');
            return;
        }

        setOtpLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/new/verify-ride-otp`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                otp: otp
            });

            if (response.data.success) {
                setOtp('');
                setShowOtpModal(false);
                setRideStep('drop');

                Alert.alert(
                    'Ride Started! 🚗',
                    'OTP verified successfully. Have a safe journey!',
                    [{ text: 'OK' }]
                );

                await fetchActiveRideDetails();
            }
        } catch (error) {
            Alert.alert(
                'OTP Verification Failed',
                error.response?.data?.message || 'Please check the OTP and try again.'
            );
        } finally {
            setOtpLoading(false);
        }
    }, [otp, userData?._id, activeRideData?._id, fetchActiveRideDetails]);

    const markDrop = useCallback(async () => {
        try {
            const response = await axios.post(`${API_BASE_URL}/new/change-ride-status`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                status: 'completed'
            });

            if (response.data.success) {
                setRideStep('payment');
                setShowPaymentModal(true);
                await fetchActiveRideDetails();

                Alert.alert(
                    'Ride Completed! 🎉',
                    'You have successfully completed the ride.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert(
                'Unable to Complete Ride',
                'Please try again or contact support.',
                [{ text: 'OK' }]
            );
        }
    }, [userData?._id, activeRideData?._id, fetchActiveRideDetails]);

    const collectPayment = useCallback(async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                require("./coin-sound.mp3"),
                {
                    shouldPlay: false,
                    isLooping: false,
                    volume: 1.0,
                }
            );

            const response = await axios.post(`${API_BASE_URL}/new/collect-payment`, {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                amount: activeRideData?.pricing?.total_fare,
                mode: paymentMethod,
            });

            if (response.data.success) {
                // ✅ Play the sound
                await sound.playAsync();

                setShowPaymentModal(false);

                Alert.alert(
                    'Payment Collected! 💰',
                    `₹${totalFare} has been collected successfully.`,
                    [{
                        text: 'OK',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: "Home" }],
                            });
                        },
                    },
                    ]);
            }
        } catch (error) {
            Alert.alert(
                "Payment Collection Failed",
                error.response?.data?.message || "Please try again.",
                [{ text: "OK" }]
            );
        }
    }, [userData?._id, activeRideData?._id, paymentMethod, totalFare, navigation]);
    // Enhanced cancel functionality
    const fetchCancelReasons = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/cancel-reasons?active=active&type=driver`);
            if (response.data?.data) {
                setCancelReasons(response.data.data);
            }
        } catch (err) {
            Alert.alert("Error", "Unable to load cancellation reasons");
        }
    }, []);

    const handleCancel = useCallback(async () => {
        if (!selectedReason || !activeRideData?._id) return;

        setCancelling(true);
        try {
            await axios.post(`${API_BASE_URL}/new/ride/cancel`, {
                ride: activeRideData._id,
                cancelBy: 'driver',
                reason_id: selectedReason._id,
                reason: selectedReason.name,
            });

            Alert.alert(
                "Ride Cancelled",
                "The ride has been cancelled successfully.",
                [{
                    text: "OK",
                    onPress: async () => {
                        setCancelModal(false);
                        setSelectedReason(null);
                        await Updates.reloadAsync();
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: 'Home' }],
                            })
                        );
                    },
                }]
            );
        } catch (err) {
            Alert.alert(
                "Cancellation Failed",
                "Unable to cancel the ride. Please try again."
            );
        } finally {
            setCancelling(false);
        }
    }, [selectedReason, activeRideData?._id, navigation]);

    // Utility functions
    const makePhoneCall = useCallback(() => {
        Linking.openURL(`tel:01141236767`);
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setRetryCount(0);
        try {
            await handleFetchUserDetails();
            await fetchActiveRideDetails();
        } finally {
            setRefreshing(false);
        }
    }, [handleFetchUserDetails, fetchActiveRideDetails]);

    const handleRetry = useCallback(() => {
        setRetryCount(0);
        fetchActiveRideDetails();
    }, [fetchActiveRideDetails]);

    // UI helper functions
    const getBottomButtonText = () => {
        switch (rideStep) {
            case 'pickup': return 'Mark Reached';
            case 'otp': return 'Enter OTP';
            case 'drop': return 'Mark Drop';
            case 'payment': return 'Collect Payment';
            default: return 'Mark Reached';
        }
    };

    const handleBottomButtonPress = () => {
        switch (rideStep) {
            case 'pickup': markReached(); break;
            case 'otp': setShowOtpModal(true); break;
            case 'drop': markDrop(); break;
            case 'payment': setShowPaymentModal(true); break;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'driver_assigned': return COLORS.warning;
            case 'driver_arrived': return COLORS.primary;
            case 'in_progress': return COLORS.success;
            case 'completed': return COLORS.success;
            case 'cancelled': return COLORS.danger;
            default: return COLORS.text.secondary;
        }
    };

    // Enhanced tab content rendering
    const renderTabContent = () => {
        if (!activeRideData) return null;

        switch (activeTab) {
            case 'user':
                return (
                    <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
                        <View style={styles.userCard}>
                            <View style={styles.userHeader}>
                                <View style={styles.userAvatar}>
                                    <MaterialIcons name="person" size={24} color={COLORS.primary} />
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{activeRideData.user?.name || 'N/A'}</Text>

                                </View>
                                <TouchableOpacity
                                    style={styles.callButton}
                                    onPress={() => makePhoneCall()}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="phone" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.addressSection}>
                                <View style={styles.addressItem}>
                                    <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
                                    <View style={styles.addressContent}>
                                        <Text style={styles.addressLabel}>Pickup Location</Text>
                                        <Text style={styles.addressValue}>
                                            {activeRideData.pickup_address?.formatted_address || 'N/A'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.routeLine} />

                                <View style={styles.addressItem}>
                                    <View style={[styles.locationDot, { backgroundColor: COLORS.danger }]} />
                                    <View style={styles.addressContent}>
                                        <Text style={styles.addressLabel}>Drop Location</Text>
                                        <Text style={styles.addressValue}>
                                            {activeRideData.drop_address?.formatted_address || 'N/A'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                );

            case 'ride':
                return (
                    <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
                        <View style={styles.rideDetailsCard}>
                            <View style={styles.statusContainer}>
                                <Text style={styles.statusLabel}>Ride Status</Text>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(rideStatus) }]}>
                                    <Text style={styles.statusText}>{rideStatus?.replace('_', ' ').toUpperCase()}</Text>
                                </View>
                            </View>

                            <View style={styles.rideMetrics}>
                                <View style={styles.metricItem}>
                                    <MaterialIcons name="straighten" size={20} color={COLORS.primary} />
                                    <Text style={styles.metricLabel}>Distance</Text>
                                    <Text style={styles.metricValue}>{activeRideData.route_info?.distance} km</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
                                    <Text style={styles.metricLabel}>Duration</Text>
                                    <Text style={styles.metricValue}>{activeRideData.route_info?.duration} min</Text>
                                </View>
                                <View style={styles.metricItem}>
                                    <MaterialIcons name="payment" size={20} color={COLORS.primary} />
                                    <Text style={styles.metricLabel}>Payment</Text>
                                    <Text style={styles.metricValue}>{activeRideData.payment_method}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    fetchCancelReasons();
                                    setCancelModal(true);
                                }}
                                activeOpacity={0.8}
                            >
                                <MaterialIcons name="cancel" size={20} color={COLORS.danger} />
                                <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                );

            case 'fare':
                return (
                    <Animated.View style={[styles.tabContent, { opacity: fadeAnim }]}>
                        <View style={styles.fare_dCard}>


                            <Text style={styles.fare_dLabel}>Total Fare to be Collected from User</Text>

                            <View style={styles.fare_dNoteContainer}>
                                <Text style={styles.fare_dNote}>
                                    This fare Not includes MCD and toll taxes. Please  collect any additional charges from the user if Toll and Any Other.
                                </Text>
                            </View>

                            <Text style={styles.fare_dValue}>₹{totalFare}</Text>
                        </View>

                    </Animated.View>
                );

            default:
                return null;
        }
    };

    // Initialize data
    useEffect(() => {
        if (rideData) {
            handleFetchUserDetails();
        }
    }, [rideData, handleFetchUserDetails]);

    useEffect(() => {
        if (userData && !userLoading) {
            fetchActiveRideDetails();
        }
    }, [userData, userLoading, fetchActiveRideDetails]);

    const showLoading = userLoading || loading;
    const showRetryButton = error && !showLoading && retryCount >= 3;

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
            <HeaderNew />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            >
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    {/* Map Component */}
                    {(activeRideData?.pickup_location && activeRideData?.drop_location) && (
                        <View style={styles.mapContainer}>
                            <NewMap
                                ride_status={activeRideData?.ride_status}
                                pickup={activeRideData?.pickup_location?.coordinates}
                                drop={activeRideData?.drop_location?.coordinates}
                                isReached={() => { }}
                            />
                        </View>
                    )}

                    {/* Loading State */}
                    {showLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.loadingText}>
                                {userLoading ? "Loading your details..." : "Getting ride information..."}
                            </Text>
                            {retryCount > 0 && (
                                <Text style={styles.retryText}>
                                    Attempt {retryCount} of 3
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Error State */}
                    {error && !showLoading && (
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={32} color={COLORS.danger} />
                            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
                            <Text style={styles.errorText}>{error}</Text>
                            {showRetryButton && (
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    onPress={handleRetry}
                                    activeOpacity={0.8}
                                >
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
                                    { key: 'user', icon: 'person', label: 'Rider' },
                                    { key: 'ride', icon: 'directions-car', label: 'Trip' },
                                    { key: 'fare', icon: 'currency-rupee', label: 'Fare' },
                                ].map((tab) => (
                                    <TouchableOpacity
                                        key={tab.key}
                                        style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                                        onPress={() => setActiveTab(tab.key)}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialIcons
                                            name={tab.icon}
                                            size={20}
                                            color={activeTab === tab.key ? '#fff' : COLORS.text.secondary}
                                        />
                                        <Text style={[
                                            styles.tabText,
                                            activeTab === tab.key && styles.activeTabText
                                        ]}>
                                            {tab.label}
                                        </Text>
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
                            <MaterialIcons name="info-outline" size={64} color={COLORS.text.light} />
                            <Text style={styles.noDataTitle}>No Active Ride</Text>
                            <Text style={styles.noDataText}>
                                You don't have any active rides at the moment.
                            </Text>
                            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                                <Text style={styles.refreshButtonText}>Refresh</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>

            {/* Fixed Bottom Button */}
            {!showLoading && !error && activeRideData && (
                <Animated.View
                    style={[
                        styles.bottomButtonContainer,
                        { opacity: fadeAnim }
                    ]}
                >
                    <TouchableOpacity
                        style={styles.bottomButton}
                        onPress={handleBottomButtonPress}
                        activeOpacity={0.8}
                    >
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
                                <MaterialIcons name="close" size={24} color={COLORS.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalSubtitle}>
                            Please select a reason for cancellation:
                        </Text>

                        <FlatList
                            data={cancelReasons}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.reasonItem,
                                        selectedReason?._id === item._id && styles.selectedReason
                                    ]}
                                    onPress={() => setSelectedReason(item)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.radioButton}>
                                        {selectedReason?._id === item._id && (
                                            <View style={styles.radioSelected} />
                                        )}
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
                            <TouchableOpacity
                                style={styles.cancelModalButton}
                                onPress={() => setCancelModal(false)}
                            >
                                <Text style={styles.cancelModalText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.confirmButton,
                                    !selectedReason && styles.disabledButton
                                ]}
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
                        <MaterialIcons name="lock-outline" size={48} color={COLORS.primary} />
                        <Text style={styles.otpTitle}>Enter OTP</Text>
                        <Text style={styles.otpSubtitle}>
                            Please enter the 4-digit OTP provided by the rider
                        </Text>

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
                                    setShowOtpModal(false);
                                    setOtp('');
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
                        <MaterialIcons name="payment" size={48} color={COLORS.success} />
                        <Text style={styles.paymentTitle}>Collect Payment</Text>
                        <Text style={styles.paymentAmount}>₹{totalFare}</Text>

                        <View style={styles.paymentMethods}>
                            {[
                                { key: 'cash', icon: 'money', label: 'Cash' },
                                { key: 'digital', icon: 'qr-code', label: 'Digital' },
                            ].map((method) => (
                                <TouchableOpacity
                                    key={method.key}
                                    style={[
                                        styles.paymentMethod,
                                        paymentMethod === method.key && styles.activePaymentMethod
                                    ]}
                                    onPress={() => setPaymentMethod(method.key)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons
                                        name={method.icon}
                                        size={24}
                                        color={paymentMethod === method.key ? '#fff' : COLORS.text.secondary}
                                    />
                                    <Text style={[
                                        styles.paymentMethodText,
                                        paymentMethod === method.key && styles.activePaymentMethodText
                                    ]}>
                                        {method.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {paymentMethod === 'digital' && userData?.YourQrCodeToMakeOnline && (
                            <View style={styles.qrContainer}>
                                <Image
                                    source={{ uri: userData.YourQrCodeToMakeOnline }}
                                    style={styles.qrImage}
                                    resizeMode="contain"
                                />
                                <Text style={styles.qrText}>Show this QR code to the rider</Text>
                            </View>
                        )}

                        <View style={styles.paymentButtons}>
                            <TouchableOpacity
                                style={styles.paymentCancelButton}
                                onPress={() => setShowPaymentModal(false)}
                            >
                                <Text style={styles.paymentCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.paymentCollectButton}
                                onPress={collectPayment}
                            >
                                <Text style={styles.paymentCollectText}>Payment Collected</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContainer: {
        paddingBottom: 120,
    },
    container: {
        padding: 16,
    },
    mapContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        elevation: 4,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },

    // Loading States
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginVertical: 16,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.text.secondary,
        textAlign: 'center',
        fontWeight: '500',
    },
    retryText: {
        marginTop: 8,
        fontSize: 14,
        color: COLORS.primary,
        fontWeight: '600',
    },

    // Error States
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginVertical: 16,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.danger,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginTop: 12,
        marginBottom: 8,
    },
    errorText: {
        color: COLORS.text.secondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 16,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Tab Navigation
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 4,
        marginBottom: 16,
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: COLORS.primary,
        elevation: 2,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    tabText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.secondary,
    },
    activeTabText: {
        color: '#fff',
    },

    // Tab Content
    tabContent: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },

    // User Tab
    userCard: {
        backgroundColor: COLORS.surface,
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: `${COLORS.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginBottom: 4,
    },
    userPhone: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    callButton: {
        backgroundColor: COLORS.success,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    // Address Section
    addressSection: {
        marginTop: 8,
    },
    addressItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    locationDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 4,
        marginRight: 16,
    },
    routeLine: {
        width: 2,
        height: 20,
        backgroundColor: COLORS.border,
        marginLeft: 5,
        marginBottom: 8,
    },
    addressContent: {
        flex: 1,
    },
    addressLabel: {
        fontSize: 12,
        color: COLORS.text.secondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    addressValue: {
        fontSize: 14,
        color: COLORS.text.primary,
        lineHeight: 20,
        fontWeight: '500',
    },

    // Ride Tab
    rideDetailsCard: {
        backgroundColor: COLORS.surface,
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    statusLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    rideMetrics: {
        marginBottom: 24,
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    metricLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontWeight: '500',
        marginLeft: 12,
        flex: 1,
    },
    metricValue: {
        fontSize: 14,
        color: COLORS.text.primary,
        fontWeight: '600',
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: `${COLORS.danger}10`,
        borderWidth: 1,
        borderColor: `${COLORS.danger}30`,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.danger,
        marginLeft: 8,
    },

    // Fare Tab
    fareCard: {
        backgroundColor: COLORS.surface,
    },
    fareTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginBottom: 20,
        textAlign: 'center',
    },
    fareItems: {
        marginBottom: 20,
    },
    fareItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    fareLabel: {
        fontSize: 14,
        color: COLORS.text.secondary,
        fontWeight: '500',
    },
    fareValue: {
        fontSize: 14,
        color: COLORS.text.primary,
        fontWeight: '600',
    },
    discountText: {
        color: COLORS.success,
    },
    fareTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: `${COLORS.primary}10`,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${COLORS.primary}20`,
    },
    fareTotalLabel: {
        fontSize: 16,
        color: COLORS.text.primary,
        fontWeight: 'bold',
    },
    fareTotalNote: {
        fontSize: 14,
        color: '#4377a2',
        marginBottom: 12,
        lineHeight: 20,
    },
    fareTotalValue: {
        fontSize: 32,
        color: COLORS.primary,
        fontWeight: 'bold',
    },

    // Bottom Button
    bottomButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.surface,
        padding: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        elevation: 8,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    bottomButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    bottomButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 8,
    },

    // No Data State
    noDataContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 64,
        paddingHorizontal: 32,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        marginVertical: 16,
    },
    noDataTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginTop: 16,
        marginBottom: 8,
    },
    noDataText: {
        fontSize: 14,
        color: COLORS.text.secondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    refreshButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    refreshButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        maxHeight: height * 0.8,
        width: width * 0.9,
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text.primary,
    },
    modalSubtitle: {
        fontSize: 16,
        color: COLORS.text.secondary,
        paddingHorizontal: 20,
        paddingVertical: 16,
        lineHeight: 22,
    },

    // Cancel Modal
    reasonsList: {
        maxHeight: height * 0.4,
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    selectedReason: {
        backgroundColor: `${COLORS.primary}10`,
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    radioSelected: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.primary,
    },
    reasonContent: {
        flex: 1,
        marginLeft: 12,
    },
    reasonName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginBottom: 4,
    },
    reasonDescription: {
        fontSize: 14,
        color: COLORS.text.secondary,
        lineHeight: 18,
    },
    modalActions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    cancelModalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        marginRight: 8,
        backgroundColor: COLORS.background,
    },
    cancelModalText: {
        fontSize: 16,
        color: COLORS.text.primary,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: COLORS.danger,
        alignItems: 'center',
        marginLeft: 8,
    },
    disabledButton: {
        backgroundColor: COLORS.text.light,
    },
    confirmButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },

    // OTP Modal
    otpModal: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 15,
        width: width * 0.9,
        maxWidth: 400,
        alignItems: 'center',
    },
    otpTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginTop: 16,
        marginBottom: 8,
    },
    otpSubtitle: {
        fontSize: 14,
        color: COLORS.text.secondary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 20,
    },
    otpInput: {
        borderWidth: 2,
        borderColor: COLORS.primary,
        borderRadius: 16,
        padding: 20,
        fontSize: 32,
        fontWeight: 'bold',
        width: '100%',
        marginBottom: 32,
        letterSpacing: 12,
        textAlign: 'center',
        backgroundColor: `${COLORS.primary}05`,
    },
    otpButtons: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    otpCancelButton: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    otpCancelText: {
        color: COLORS.text.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    otpVerifyButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginLeft: 8,
    },
    otpVerifyText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Payment Modal
    paymentModal: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 32,
        width: width * 0.9,
        maxWidth: 400,
        alignItems: 'center',
    },
    paymentTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text.primary,
        marginTop: 16,
        marginBottom: 8,
    },
    paymentAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.success,
        marginBottom: 32,
    },
    paymentMethods: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 24,
    },
    paymentMethod: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    activePaymentMethod: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    paymentMethodText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text.secondary,
    },
    fare_dCard: {
        backgroundColor: '#fff',

        borderRadius: 16,
        padding: 14,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#f44336', // red outline for alert context
    },
    fare_dTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#003873',
        // marginBottom: 16,
    },
    fare_dLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#212529',
        marginBottom: 10,
    },
    fare_dNoteContainer: {
        backgroundColor: '#ffecec',
        padding: 14,
        borderRadius: 10,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#f44336',
    },
    fare_dNote: {
        fontSize: 15,
        color: '#212529',
        lineHeight: 22,
    },
    fare_dAlert: {
        fontWeight: 'bold',
        color: '#d32f2f', // deep red
    },
    fare_dValue: {
        fontSize: 34,
        fontWeight: '900',
        color: '#d32f2f',
        textAlign: 'right',
    },
    activePaymentMethodText: {
        color: '#fff',
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 24,
        padding: 20,
        backgroundColor: COLORS.background,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    qrImage: {
        width: 160,
        height: 160,
        borderRadius: 12,
    },
    qrText: {
        marginTop: 12,
        fontSize: 12,
        color: COLORS.text.secondary,
        textAlign: 'center',
        fontWeight: '500',
    },
    paymentButtons: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    paymentCancelButton: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    paymentCancelText: {
        color: COLORS.text.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    paymentCollectButton: {
        flex: 1,
        backgroundColor: COLORS.success,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginLeft: 8,
    },
    paymentCollectText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});