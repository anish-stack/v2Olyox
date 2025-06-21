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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HeaderNew from "../components/Header/HeaderNew";
import React, { useEffect, useState, useCallback } from "react";
import { CommonActions, useNavigation, useRoute, useFocusEffect, useNavigationState } from "@react-navigation/native";
import axios from "axios";
import { useFetchUserDetails } from "../../hooks/New Hookes/RiderDetailsHooks";
import NewMap from "../components/running-ride/NewMap";
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL, colors } from "../NewConstant";

const { width ,height } = Dimensions.get('window');

export default function RunningRide() {
    const route = useRoute();
    const { rideData } = route.params || {};
    const navigate = useNavigation()
    const { fetchUserDetails, userData } = useFetchUserDetails();
    const [isReached, setIsReached] = useState(false);
    const [activeRideData, setActiveRideData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userLoading, setUserLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [cancelReasons, setCancelReasons] = useState([])
    const [showCancelModal, setCancelModal] = useState(false)
    const [selectedReason, setSelectedReason] = useState(null)
    const [cancelling, setCancelling] = useState(false)
    // New states for enhanced functionality
    const [rideStep, setRideStep] = useState('pickup'); // pickup, otp, drop, payment
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('user'); // user, ride, fare
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash');

    // Fetch user details with loading state
    const handleFetchUserDetails = useCallback(async () => {
        try {
            setUserLoading(true);
            await fetchUserDetails();
        } catch (error) {
            console.error("❌ Error fetching user details:", error);
            setError("Failed to fetch user details");
        } finally {
            setUserLoading(false);
        }
    }, [fetchUserDetails]);

    // Fetch ride details with proper error handling and retry
    const fetchActiveRideDetails = useCallback(async (isRetry = false) => {
        if (!isRetry) {
            setLoading(true);
        }
        setError(null);

        try {
            if (userData?.on_ride_id) {
                console.log("📦 Fetching ride details for ride ID:", userData.on_ride_id);

                const response = await axios.get(
                    `http://192.168.1.6:3100/rider/${userData.on_ride_id}`,
                    {
                        timeout: 10000,
                    }
                );

                if (response.data?.data) {
                    setActiveRideData(response.data.data);
                    setRetryCount(0);
                    // console.log("✅ Ride details fetched successfully", response.data.data);

                    // Set ride step based on ride status
                    const status = response.data.data.ride_status;
                    if (status === 'driver_assigned') {
                        setRideStep('pickup');
                    } else if (status === 'driver_arrived') {
                        setRideStep('otp');
                    } else if (status === 'in_progress') {
                        setRideStep('drop');
                    } else if (status === 'completed') {
                        setRideStep('payment');
                    }
                } else {
                    throw new Error("No ride data received");
                }
            } else {
                setActiveRideData(null);
                console.log("ℹ️ No on_ride_id found in userData");
            }
        } catch (error) {
            console.error("❌ Error fetching ride details:", error?.response?.data || error.message);
            const errorMessage = error?.response?.data?.error ||
                error?.code === 'ECONNABORTED' ? "Request timeout" :
                "Failed to fetch ride details";
            setError(errorMessage);
            setActiveRideData(null);

            if (retryCount < 3 && userData?.on_ride_id) {
                console.log(`🔄 Auto retry ${retryCount + 1}/3 in 2 seconds...`);
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                    fetchActiveRideDetails(true);
                }, 2000);
            }
        } finally {
            if (!isRetry) {
                setLoading(false);
            }
        }
    }, [userData?.on_ride_id, retryCount]);


    const fetchCancelReasons = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/cancel-reasons?active=active`)
            if (response.data?.data) {
                setCancelReasons(response.data.data)
            }
        } catch (err) {
            Alert.alert("Error", "Failed to fetch cancel reasons")
        }
    }, [])


    // 1. Fix the handleCancel function - use activeRideData._id instead of undefined ride_id
    const handleCancel = useCallback(async () => {
        if (!selectedReason || !activeRideData?._id) return

        setCancelling(true)
        try {
            // Use activeRideData._id instead of ride_id
            await axios.post(`${API_BASE_URL}/new/ride/cancel`, {
                ride: activeRideData._id,
                cancelBy: 'driver',
                reason_id: selectedReason._id,
                reason: selectedReason.name,
            })

            Alert.alert("Success", "Ride cancelled successfully", [
                {
                    text: "OK",
                    onPress: () => {
                        setCancelModal(false)
                        setSelectedReason(null) // Reset selected reason
                        // Navigate back or to appropriate screen
                        navigate.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: 'Home' }],
                            })
                        );
                    },
                },
            ])
        } catch (err) {
            console.error("Cancel ride error:", err.response?.data || err.message)
            Alert.alert("Error", err.response?.data?.message || "Failed to cancel ride. Please try again.")
        } finally {
            setCancelling(false)
        }
    }, [selectedReason, activeRideData?._id])


    // Manual retry function
    const handleRetry = useCallback(() => {
        setRetryCount(0);
        fetchActiveRideDetails();
    }, [fetchActiveRideDetails]);

    // Refresh function for pull-to-refresh
    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setRetryCount(0);
        try {
            await handleFetchUserDetails();
            setTimeout(async () => {
                await fetchActiveRideDetails();
                setRefreshing(false);
            }, 500);
        } catch (error) {
            setRefreshing(false);
        }
    }, [handleFetchUserDetails, fetchActiveRideDetails]);

    // Initial data fetch
    useEffect(() => {
        if (rideData) {
            console.log("🚀 Starting initial data fetch...");
            handleFetchUserDetails();
        }
    }, [rideData, handleFetchUserDetails]);



    useFocusEffect(
        useCallback(() => {
            const currentRouteName = navigate.getState()?.routes?.[navigate.getState().index]?.name;
            console.log("🔍 Current route name:", currentRouteName);

            if (currentRouteName !== 'start') {
                console.log("🔕 Current route is not 'Start'. Skipping polling.");
                return;
            }

            console.log("📡 Ride status polling started At Screen Start");

            const pollingInterval =
                activeRideData?.ride_status === 'in_progress' ? 20000 : 5000;

            console.log(`⏱️ Setting polling interval to ${pollingInterval / 1000} seconds`);

            const interval = setInterval(async () => {
                console.log("⏱️ Checking ride status...", activeRideData?.ride_status);

                try {
                    await fetchActiveRideDetails();
                    console.log("✅ Ride details refreshed");

                    const rideStatus = activeRideData?.ride_status;
                    const paymentStatus = activeRideData?.payment_status;

                    const isCancelled = rideStatus === 'cancelled';
                    const isCompletedWithPayment =
                        rideStatus === 'completed' && paymentStatus === 'completed';

                    if (isCancelled || isCompletedWithPayment) {
                        console.log(`🚨 Ride status is ${rideStatus}. Showing alert and resetting navigation.`);

                        Alert.alert(
                            "Ride Status",
                            isCancelled
                                ? "Your ride has been cancelled."
                                : "Your ride has been completed successfully.",
                            [
                                {
                                    text: "OK",
                                    onPress: () => {
                                        console.log("🔄 Navigating to Home screen...");
                                        navigate.dispatch(
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

                        clearInterval(interval);
                        console.log("🛑 Polling stopped after ride status was handled");
                    }
                } catch (err) {
                    console.error("❌ Error while polling ride status:", err);
                }
            }, pollingInterval);

            return () => {
                console.log("🧹 Cleanup: clearing ride status polling interval");
                clearInterval(interval);
            };
        }, [activeRideData?.ride_status, activeRideData?.payment_status, navigate])
    );
    // Fetch ride details when userData is available
    useEffect(() => {
        if (userData && !userLoading) {
            console.log("👤 User data available, fetching ride details...");
            fetchActiveRideDetails();
        }
    }, [userData, userLoading, fetchActiveRideDetails]);

    // Handle isReached callback
    const handleIsReached = useCallback(() => {

        setIsReached(true);
    }, []);

    // API calls
    const markReached = async () => {
        try {
            const data = {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                status: 'driver_arrived'
            }


            const response = await axios.post(`${API_BASE_URL}/new/change-ride-status`, data);
            if (response.data.success) {
                setRideStep('otp');
                setShowOtpModal(true);
                await onRefresh()
                Alert.alert('Success', 'Pickup location reached!', [
                    {
                        text: 'OK',
                        onPress: () => {
                            navigate.replace(route.name, route.params); // Reloads screen
                        },
                    },
                ]);
            }
        } catch (error) {
            console.log(error.response.data)
            Alert.alert('Error', 'Failed to mark as reached');
        }
    };

    const verifyOtp = async () => {
        if (!otp || otp.length !== 4) {
            Alert.alert('Error', 'Please enter a valid 4-digit OTP');
            return;
        }
        const data = {
            riderId: userData?._id,
            rideId: activeRideData?._id,
            otp: otp
        }
        setOtpLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/new/verify-ride-otp`, data);

            if (response.data.success) {
                setOtp('');
                setShowOtpModal(false);
                setRideStep('drop');
                  Alert.alert('Success', 'OTP verified! Ride started!', [
                    {
                        text: 'OK',
                        onPress: () => {
                            navigate.replace(route.name, route.params); // Reloads screen
                        },
                    },
                ]);
            
                fetchActiveRideDetails();
            }
        } catch (error) {
            Alert.alert('Error', error.response.data.message);
        } finally {
            setOtpLoading(false);
        }
    };

    const markDrop = async () => {
        try {

            const data = {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                status: 'completed'
            }
            const response = await axios.post(`${API_BASE_URL}/new/change-ride-status`, data);
            if (response.data.success) {
                setRideStep('payment');
                await onRefresh()

                setShowPaymentModal(true);
                Alert.alert('Success', 'Ride completed!');
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to mark as dropped');
        }
    };

    const collectPayment = async () => {
        try {
            const data = {
                riderId: userData?._id,
                rideId: activeRideData?._id,
                amount: activeRideData?.pricing?.total_fare,
                mode: paymentMethod
            }
            const response = await axios.post(`${API_BASE_URL}/new/collect-payment`, data);

            if (response.data.success) {
                setShowPaymentModal(false);
                Alert.alert('Success', 'Payment collected successfully!');
                fetchActiveRideDetails();

                navigate.reset({
                    index: 0,
                    routes: [{ name: 'Home' }], // or 'Home' if that's your route name
                });

            }
        } catch (error) {
            console.log(error.response.data.message)
            Alert.alert('Error', error.response.data.message);
        }
    };

    // Helper functions
    const makePhoneCall = (phoneNumber) => {
        Linking.openURL(`tel:${phoneNumber}`);
    };

    const getBottomButtonText = () => {
        switch (rideStep) {
            case 'pickup':
                return 'Mark Reached';
            case 'otp':
                return 'Enter OTP';
            case 'drop':
                return 'Mark Drop';
            case 'payment':
                return 'Payment';
            default:
                return 'Mark Reached';
        }
    };

    const handleBottomButtonPress = () => {
        switch (rideStep) {
            case 'pickup':
                markReached();
                break;
            case 'otp':
                setShowOtpModal(true);
                break;
            case 'drop':
                markDrop();
                break;
            case 'payment':
                setShowPaymentModal(true);
                break;
        }
    };





    // Render tab content
    const renderTabContent = () => {
        if (!activeRideData) return null;

        switch (activeTab) {
            case 'user':
                return (
                    <View style={styles.tabContent}>
                        <View style={styles.userCard}>
                            <View style={styles.userHeader}>
                                <MaterialIcons name="person" size={24} color="#0d6efd" />
                                <Text style={styles.userName}>{activeRideData.user?.name || 'N/A'}</Text>
                                <TouchableOpacity
                                    style={styles.callButton}
                                    onPress={() => makePhoneCall(activeRideData.user?.number)}
                                >
                                    <MaterialIcons name="phone" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* <View style={styles.userDetails}>
                                <Text style={styles.userPhone}>{activeRideData.user?.number || 'N/A'}</Text>
                                <Text style={styles.userEmail}>{activeRideData.user?.email || 'N/A'}</Text>
                            </View> */}

                            <View style={styles.addressSection}>
                                <View style={styles.addressItem}>
                                    <MaterialIcons name="my-location" size={20} color="#28a745" />
                                    <View style={styles.addressText}>
                                        <Text style={styles.addressLabel}>Pickup</Text>
                                        <Text style={styles.addressValue}>
                                            {activeRideData.pickup_address?.formatted_address || 'N/A'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.addressItem}>
                                    <MaterialIcons name="location-on" size={20} color="#f44336" />
                                    <View style={styles.addressText}>
                                        <Text style={styles.addressLabel}>Drop</Text>
                                        <Text style={styles.addressValue}>
                                            {activeRideData.drop_address?.formatted_address || 'N/A'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                );

            case 'ride':
                return (
                    <View style={styles.tabContent}>
                        <View style={styles.rideDetailsCard}>

                            {/* <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Status:</Text>
                                <View style={[styles.statusBadge, getStatusBadgeStyle(activeRideData.ride_status)]}>
                                    <Text style={styles.statusText}>{activeRideData.ride_status}</Text>
                                </View>
                            </View> */}

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Distance:</Text>
                                <Text style={styles.detailValue}>{activeRideData.route_info?.distance} km</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Duration:</Text>
                                <Text style={styles.detailValue}>{activeRideData.route_info?.duration} min</Text>
                            </View>

                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Payment Method:</Text>
                                <Text style={styles.detailValue}>{activeRideData.payment_method}</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    fetchCancelReasons()
                                    setCancelModal(true) // Add this line to show the modal
                                }}
                            >
                                <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
                                <Text style={[styles.menuText, { color: "#FF3B30" }]}>Cancel Ride</Text>
                            </TouchableOpacity>

                        </View>
                    </View>
                );

            case 'fare':
                return (
                    <View style={styles.tabContent}>
                        <View style={styles.fareCard}>
                            <Text style={styles.fareTitle}>Fare Breakdown</Text>

                            <View style={styles.fareItem}>
                                <Text style={styles.fareLabel}>Base Fare</Text>
                                <Text style={styles.fareValue}>₹{activeRideData.pricing?.base_fare}</Text>
                            </View>
                            <View style={styles.fareItem}>
                                <Text style={styles.fareLabel}>Distance Fare</Text>
                                <Text style={styles.fareValue}>₹{activeRideData.pricing?.distance_fare?.toFixed(2)}</Text>
                            </View>
                            <View style={styles.fareItem}>
                                <Text style={styles.fareLabel}>Time Fare</Text>
                                <Text style={styles.fareValue}>₹{activeRideData.pricing?.time_fare?.toFixed(2)}</Text>
                            </View>
                            <View style={styles.fareItem}>
                                <Text style={styles.fareLabel}>Extra Earning Fee</Text>
                                <Text style={styles.fareValue}>₹{activeRideData.pricing?.platform_fee?.toFixed(2)}</Text>
                            </View>
                            <View style={styles.fareItem}>
                                <Text style={styles.fareLabel}>Night Charge</Text>
                                <Text style={styles.fareValue}>₹{activeRideData.pricing?.night_charge?.toFixed(2)}</Text>
                            </View>
                            {activeRideData.pricing?.rain_charge > 0 && (
                                <View style={styles.fareItem}>
                                    <Text style={styles.fareLabel}>Rain Charge</Text>
                                    <Text style={styles.fareValue}>₹{activeRideData.pricing.rain_charge}</Text>
                                </View>
                            )}

                            {activeRideData.pricing?.toll_charge > 0 && (
                                <View style={styles.fareItem}>
                                    <Text style={styles.fareLabel}>Toll Charge</Text>
                                    <Text style={styles.fareValue}>₹{activeRideData.pricing.toll_charge}</Text>
                                </View>
                            )}

                            {activeRideData.pricing?.discount > 0 && (
                                <View style={styles.fareItem}>
                                    <Text style={styles.fareLabel}>Discount</Text>
                                    <Text style={[styles.fareValue, styles.discountText]}>
                                        -₹{activeRideData.pricing.discount}
                                    </Text>
                                </View>
                            )}


                            <View style={styles.fareTotal}>
                                <Text style={styles.fareTotalLabel}>Total Fare</Text>
                                <Text style={styles.fareTotalValue}>₹{activeRideData.pricing?.total_fare?.toFixed(2)}</Text>
                            </View>
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };



    const showLoading = userLoading || loading;
    const showRetryButton = error && !showLoading && retryCount >= 3;

    return (
        <SafeAreaView style={styles.safeArea}>
            <HeaderNew />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#0d6efd']}
                        tintColor="#0d6efd"
                    />
                }
            >
                <View style={styles.container}>
                    {/* Map Component */}
                    {(activeRideData?.pickup_location && activeRideData?.drop_location) && (
                        <NewMap
                            ride_status={activeRideData?.ride_status}
                            pickup={activeRideData?.pickup_location?.coordinates}
                            drop={activeRideData?.drop_location?.coordinates}
                            isReached={handleIsReached}
                        />
                    )}


                    {/* Loading State */}
                    {showLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#0d6efd" />
                            <Text style={styles.loadingText}>
                                {userLoading ? "Loading user details..." : "Loading ride details..."}
                            </Text>
                            {retryCount > 0 && (
                                <Text style={styles.retryText}>
                                    Retry attempt: {retryCount}/3
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Error State with Retry */}
                    {error && !showLoading && (
                        <View style={styles.errorContainer}>
                            <MaterialIcons name="error-outline" size={24} color="#f44336" />
                            <Text style={styles.errorText}>Error: {error}</Text>
                            {showRetryButton && (
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    onPress={handleRetry}
                                    activeOpacity={0.8}
                                >
                                    <MaterialIcons name="refresh" size={20} color="#fff" />
                                    <Text style={styles.retryButtonText}>Retry</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Success State - Tabs and Content */}
                    {!showLoading && !error && activeRideData && (
                        <>
                            {/* Tab Navigation */}
                            <View style={styles.tabContainer}>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'user' && styles.activeTab]}
                                    onPress={() => setActiveTab('user')}
                                >
                                    <MaterialIcons name="person" size={20} color={activeTab === 'user' ? '#fff' : '#6c757d'} />
                                    <Text style={[styles.tabText, activeTab === 'user' && styles.activeTabText]}>User</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'ride' && styles.activeTab]}
                                    onPress={() => setActiveTab('ride')}
                                >
                                    <MaterialIcons name="directions-car" size={20} color={activeTab === 'ride' ? '#fff' : '#6c757d'} />
                                    <Text style={[styles.tabText, activeTab === 'ride' && styles.activeTabText]}>Ride</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'fare' && styles.activeTab]}
                                    onPress={() => setActiveTab('fare')}
                                >
                                    <MaterialIcons name="attach-money" size={20} color={activeTab === 'fare' ? '#fff' : '#6c757d'} />
                                    <Text style={[styles.tabText, activeTab === 'fare' && styles.activeTabText]}>Fare</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Tab Content */}
                            {renderTabContent()}
                        </>
                    )}

                    {/* No Data State */}
                    {!showLoading && !error && !activeRideData && (
                        <View style={styles.noDataContainer}>
                            <MaterialIcons name="info-outline" size={48} color="#6c757d" />
                            <Text style={styles.noDataText}>No active ride found</Text>
                            <Text style={styles.noDataSubtext}>
                                Pull down to refresh or check back later
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Fixed Bottom Button */}
            {!showLoading && !error && activeRideData && (
                <View style={styles.bottomButtonContainer}>
                    <TouchableOpacity
                        style={styles.bottomButton}
                        onPress={handleBottomButtonPress}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.bottomButtonText}>{getBottomButtonText()}</Text>
                    </TouchableOpacity>
                </View>
            )}
            <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Cancel Ride</Text>
                            <TouchableOpacity onPress={() => {

                                fetchCancelReasons()
                                setCancelModal(true)
                            }}>
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

            {/* OTP Modal */}
            <Modal
                visible={showOtpModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowOtpModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.otpModal}>
                        <Text style={styles.otpTitle}>Enter OTP</Text>
                        <Text style={styles.otpSubtitle}>Enter the 4-digit OTP provided by the rider</Text>

                        <TextInput
                            style={styles.otpInput}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="numeric"
                            maxLength={4}
                            placeholder="0000"
                            textAlign="center"
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
                                disabled={otpLoading}
                            >
                                {otpLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.otpVerifyText}>Verify</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Payment Modal */}
            <Modal
                visible={showPaymentModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.paymentModal}>
                        <Text style={styles.paymentTitle}>Collect Payment</Text>
                        <Text style={styles.paymentAmount}>₹{activeRideData?.pricing?.total_fare?.toFixed(2)}</Text>

                        {/* Payment Method Selection */}
                        <View style={styles.paymentMethods}>
                            <TouchableOpacity
                                style={[styles.paymentMethod, paymentMethod === 'cash' && styles.activePaymentMethod]}
                                onPress={() => setPaymentMethod('cash')}
                            >
                                <MaterialIcons name="money" size={24} color={paymentMethod === 'cash' ? '#fff' : '#6c757d'} />
                                <Text style={[styles.paymentMethodText, paymentMethod === 'cash' && styles.activePaymentMethodText]}>Cash</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.paymentMethod, paymentMethod === 'digital' && styles.activePaymentMethod]}
                                onPress={() => setPaymentMethod('digital')}
                            >
                                <MaterialIcons name="qr-code" size={24} color={paymentMethod === 'digital' ? '#fff' : '#6c757d'} />
                                <Text style={[styles.paymentMethodText, paymentMethod === 'digital' && styles.activePaymentMethodText]}>Digital</Text>
                            </TouchableOpacity>
                        </View>

                        {/* QR Code for Digital Payment */}
                        {paymentMethod === 'digital' && userData?.YourQrCodeToMakeOnline && (
                            <View style={styles.qrContainer}>
                                <Image
                                    source={{ uri: userData.YourQrCodeToMakeOnline }}
                                    style={{ width: 150, height: 150, borderRadius: 8 }}
                                    resizeMode="contain"
                                />
                                <Text style={styles.qrText}>Show this QR code to the user</Text>
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
        backgroundColor: "#f8f9fa",
    },
    scrollContainer: {
        paddingBottom: 100, // Space for fixed bottom button
    },
    container: {
        padding: 16,
    },
    heading: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#212529",
        marginBottom: 16,
        marginTop: 12,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: "#6c757d",
        textAlign: 'center',
    },
    retryText: {
        marginTop: 8,
        fontSize: 14,
        color: "#0d6efd",
        fontWeight: '500',
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginVertical: 8,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
    },
    errorText: {
        color: "#f44336",
        fontSize: 16,
        marginVertical: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d6efd',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },

    // Tab Styles
    tabContainer: {
        marginTop: 8,
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: colors.red400,
    },
    tabText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#6c757d',
    },
    activeTabText: {
        color: '#fff',
    },

    // Tab Content Styles
    tabContent: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
    },

    // User Tab Styles
    userCard: {
        backgroundColor: '#fff',
    },
    userHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f3f5',
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#212529',
        marginLeft: 8,
        flex: 1,
    },
    callButton: {
        backgroundColor: '#28a745',
        padding: 8,
        borderRadius: 20,
    },
    userDetails: {
        marginBottom: 16,
    },
    userPhone: {
        fontSize: 16,
        color: '#0d6efd',
        fontWeight: '600',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#6c757d',
    },
    addressSection: {
        marginTop: 8,
    },
    addressItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    addressText: {
        marginLeft: 12,
        flex: 1,
    },
    addressLabel: {
        fontSize: 12,
        color: '#6c757d',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    addressValue: {
        fontSize: 14,
        color: '#212529',
        lineHeight: 20,
    },

    // Ride Tab Styles
    rideDetailsCard: {
        backgroundColor: '#fff',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 4,
    },
    detailLabel: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
        flex: 1,
    },
    detailValue: {
        fontSize: 14,
        color: '#212529',
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    otpText: {
        fontSize: 18,
        color: '#0d6efd',
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: 'flex-end',
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },

    // Fare Tab Styles
    fareCard: {
        backgroundColor: '#fff',
    },
    fareTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 16,
        textAlign: 'center',
    },
    fareItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f8f9fa',
    },
    fareLabel: {
        fontSize: 14,
        color: '#6c757d',
        fontWeight: '500',
    },
    fareValue: {
        fontSize: 14,
        color: '#212529',
        fontWeight: '600',
    },
    discountText: {
        color: '#28a745',
    },
    fareTotal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
        borderTopWidth: 2,
        borderTopColor: '#0d6efd',
    },
    fareTotalLabel: {
        fontSize: 16,
        color: '#212529',
        fontWeight: 'bold',
    },
    fareTotalValue: {
        fontSize: 18,
        color: '#0d6efd',
        fontWeight: 'bold',
    },

    // Bottom Button Styles
    bottomButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: '#f1f3f5',
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 6,
        elevation: 5,
    },
    bottomButton: {
        backgroundColor: colors.activeRed,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bottomButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },

    // OTP Modal Styles
    otpModal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: width * 0.9,
        maxWidth: 400,
        alignItems: 'center',
    },
    otpTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    otpSubtitle: {
        fontSize: 14,
        color: '#6c757d',
        textAlign: 'center',
        marginBottom: 24,
    },
    otpInput: {
        borderWidth: 2,
        borderColor: '#0d6efd',
        borderRadius: 12,
        padding: 16,
        fontSize: 24,
        fontWeight: 'bold',
        width: 120,
        marginBottom: 24,
        letterSpacing: 8,
    },
    otpButtons: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    otpCancelButton: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 8,
    },
    otpCancelText: {
        color: '#6c757d',
        fontSize: 16,
        fontWeight: '600',
    },
    otpVerifyButton: {
        flex: 1,
        backgroundColor: '#0d6efd',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginLeft: 8,
    },
    otpVerifyText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Payment Modal Styles
    paymentModal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: width * 0.9,
        maxWidth: 400,
        alignItems: 'center',
    },
    paymentTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#212529',
        marginBottom: 8,
    },
    paymentAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0d6efd',
        marginBottom: 24,
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
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        marginHorizontal: 4,
    },
    activePaymentMethod: {
        backgroundColor: '#0d6efd',
    },
    paymentMethodText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
        color: '#6c757d',
    },
    activePaymentMethodText: {
        color: '#fff',
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
    },
    qrText: {
        marginTop: 12,
        fontSize: 12,
        color: '#6c757d',
        textAlign: 'center',
    },
    paymentButtons: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
    },
    paymentCancelButton: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 8,
    },
    paymentCancelText: {
        color: '#6c757d',
        fontSize: 16,
        fontWeight: '600',
    },
    paymentCollectButton: {
        flex: 1,
        backgroundColor: '#28a745',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginLeft: 8,
    },
    paymentCollectText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    noDataContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    noDataText: {
        fontSize: 18,
        color: "#6c757d",
        marginTop: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    noDataSubtext: {
        fontSize: 14,
        color: "#adb5bd",
        marginTop: 8,
        textAlign: 'center',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ffe5e5',
        marginBottom: 10,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 10,
        color: '#333',
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
})