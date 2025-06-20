import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { Audio } from 'expo-av';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import useUserDetails from '../../../hooks/user/User.hook';

const API_BASE_URL = 'http://192.168.1.6:3100/api/v1';

export default function NewParcelLive() {
    const route = useRoute();
    const navigation = useNavigation();
    const { userData } = useUserDetails();
    const { parcelId } = route.params || {};
    const { isSocketReady, socket } = useSocket();

    const [parcelDetails, setParcelDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);

    const soundRef = useRef(null);
    const timerRef = useRef(null);

    // Handle socket connection and cleanup
    useEffect(() => {
        // Setup socket listeners if needed
        if (socket && isSocketReady) {
            // Listen for any updates to this parcel
            socket.on(`parcel:${parcelId}:update`, handleParcelUpdate);
        }

        // Cleanup function
        return () => {
            if (socket && isSocketReady) {
                socket.off(`parcel:${parcelId}:update`);
            }
        };
    }, [socket, isSocketReady, parcelId]);

    // Handle parcel updates from socket
    const handleParcelUpdate = (data) => {
        if (data && data.status) {
            // Update local state based on socket data
            if (data.status === 'cancelled') {
                stopSound();
                Alert.alert(
                    "Delivery Cancelled",
                    "This delivery request has been cancelled.",
                    [{ text: "OK", onPress: () => navigateToHome() }]
                );
            } else if (data.parcelDetails) {
                setParcelDetails(data.parcelDetails);
            }
        }
    };

    // Handle timer to auto-reject after 30 seconds
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setTimeLeft((prevTime) => {
                if (prevTime <= 1) {
                    clearInterval(timerRef.current);
                    handleAutoReject();
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Fetch parcel details and load sound
    useEffect(() => {
        handleFetchDetails();
        loadSound();

        return () => {
            stopSound();
        };
    }, [parcelId]);

    // Make sure to clean up when component loses focus
    useFocusEffect(
        useCallback(() => {
            return () => {
                stopSound();
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        }, [])
    );

    // Load notification sound
    async function loadSound() {
        try {
            const { sound: newSound } = await Audio.Sound.createAsync(
                require('./notification.mp3'),
                { shouldPlay: true, isLooping: true }
            );
            soundRef.current = newSound;
        } catch (error) {
            console.log('Error loading sound:', error);
        }
    }

    // Stop and unload sound
    async function stopSound() {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            } catch (error) {
                console.log('Error stopping sound:', error);
            }
        }
    }

    // Navigate to home screen
    const navigateToHome = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
        });
    };

    // Auto reject when timer runs out
    const handleAutoReject = async () => {
        try {
            // Emit socket event for rejecting ride
            if (socket && isSocketReady) {
                socket.emit('driver:reject_ride', {
                    parcelId: parcelId,
                    driverId: userData?._id || 'unknown',
                    reason: 'timeout'
                });
            }

            // Make API call to reject the ride
            await axios.post(`${API_BASE_URL}/driver/reject-ride/${parcelId}`, {
                reason: 'timeout'
            });
        } catch (error) {
            console.log("Error auto-rejecting ride:", error?.response?.data?.message || error.message);
        } finally {
            // Always navigate away
            stopSound();
            navigateToHome();
        }
    };

    // Fetch parcel details
    const handleFetchDetails = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const { data } = await axios.get(`${API_BASE_URL}/parcel/get-parcel/${parcelId}`);
            if (data?.parcelDetails) {
                setParcelDetails(data.parcelDetails);
            } else {
                throw new Error("No parcel details found");
            }
        } catch (error) {
            const errorMessage = error?.response?.data?.message || error.message || "Failed to load parcel details";
            setError(errorMessage);
            console.log("Error fetching parcel details:", errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle accept delivery
    const handleAccept = () => {
        // Ensure userData is available
        if (!userData || !userData._id) {
            Alert.alert("Error", "User information is missing. Please login again.");
            return;
        }

        Alert.alert(
            "Accept Delivery",
            "Are you sure you want to accept this delivery?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Accept",
                    onPress: async () => {
                        try {
                            // Stop alert sound
                            stopSound();

                            // Emit socket event
                            if (socket && isSocketReady) {
                                socket.emit('Parcel:accept_ride', {
                                    parcelId,
                                    driverId: userData._id
                                });
                            }

                            // Make API request
                            const response = await axios.post(
                                `${API_BASE_URL}/parcel/parcel-accept-ride/${parcelId}`,
                                { riderId: userData._id }
                            );

                            // Show success message
                            Alert.alert(
                                "Success",
                                "Delivery accepted successfully!",
                                [{ 
                                    text: "OK", 
                                    onPress: () => navigation.navigate('DeliveryTracking', { parcelId }) 
                                }]
                            );
                        } catch (error) {
                            const errorMessage = error?.response?.data?.message || 
                                "Failed to accept the delivery. Please try again.";
                            
                            Alert.alert("Error", errorMessage);
                            console.error("Error accepting ride:", {
                                message: error.message,
                                response: error.response?.data,
                                status: error.response?.status
                            });
                        }
                    }
                }
            ]
        );
    };

    // Handle reject delivery
    const handleReject = () => {
        Alert.alert(
            "Reject Delivery",
            "Are you sure you want to reject this delivery?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reject",
                    onPress: async () => {
                        try {
                            // Stop sound
                            stopSound();

                            // Emit socket event for rejecting ride
                            if (socket && isSocketReady) {
                                socket.emit('driver:reject_ride', {
                                    parcelId: parcelId,
                                    driverId: userData?._id || 'unknown',
                                    reason: 'Parcel_driver_rejected'
                                });
                            }

                            // Make API call to reject the ride
                            await axios.post(`${API_BASE_URL}/driver/reject-ride/${parcelId}`);
                            
                            // Navigate back to home
                            navigateToHome();
                        } catch (error) {
                            console.log("Error rejecting ride:", error?.response?.data?.message || error.message);
                            Alert.alert("Error", "Failed to reject the delivery");
                        }
                    }
                }
            ]
        );
    };

    // Render loading state
    if (loading) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <View style={styles.loadingCard}>
                    <MaterialIcons name="delivery-dining" size={40} color="#4a89f3" />
                    <Text style={styles.loadingText}>Loading delivery details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Render error state
    if (error || !parcelDetails) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <View style={styles.errorCard}>
                    <MaterialIcons name="error-outline" size={40} color="#e74c3c" />
                    <Text style={styles.errorText}>{error || "No parcel details found"}</Text>
                    <View style={styles.errorButtonsContainer}>
                        <TouchableOpacity style={styles.backButton} onPress={navigateToHome}>
                            <Text style={styles.backButtonText}>Go Home</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.retryButton} onPress={handleFetchDetails}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    const { customerId, locations, fares, ride_id, km_of_ride } = parcelDetails;

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Header with back button */}
            <View style={styles.headerContainer}>
                <TouchableOpacity 
                    style={styles.backButtonSmall} 
                    onPress={navigateToHome}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>New Delivery Request</Text>
                    <Text style={styles.rideId}>ID: {ride_id}</Text>
                </View>
            </View>

            {/* Timer */}
            <View style={styles.timerContainer}>
                <Text style={styles.timerText}>Auto-reject in: </Text>
                <Text style={[styles.timerCounter, timeLeft <= 10 && styles.timerWarning]}>
                    {timeLeft}s
                </Text>
            </View>

            {/* Main content */}
            <ScrollView 
                style={styles.container} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.priceCard}>
                    <Text style={styles.fareTitle}>Earnings</Text>
                    <Text style={styles.fareAmount}>₹{fares.netFare}</Text>
                    <View style={styles.fareDetails}>
                        <Text style={styles.fareSubtitle}>Base fare: ₹{fares.baseFare}</Text>
                        {fares.discount !== 0 && (
                            <Text style={styles.discountText}>Discount: ₹{fares.discount}</Text>
                        )}
                    </View>
                    <Text style={styles.noteText}>*MCD and toll charges included</Text>
                </View>

                <View style={styles.customerCard}>
                    <Text style={styles.sectionTitle}>Customer Details</Text>
                    <View style={styles.customerInfo}>
                        <Ionicons name="person" size={20} color="#555" />
                        <Text style={styles.customerText}>{customerId.name}</Text>
                    </View>
                    <View style={styles.customerInfo}>
                        <Ionicons name="call" size={20} color="#555" />
                        <Text style={styles.customerText}>{customerId.number}</Text>
                    </View>
                </View>

                <View style={styles.locationCard}>
                    <Text style={styles.sectionTitle}>Pickup Location</Text>
                    <View style={styles.locationContainer}>
                        <MaterialIcons name="my-location" size={24} color="#4a89f3" />
                        <Text style={styles.locationText}>{locations.pickup.address}</Text>
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.sectionTitle}>Drop Location</Text>
                    <View style={styles.locationContainer}>
                        <MaterialIcons name="location-on" size={24} color="#e74c3c" />
                        <Text style={styles.locationText}>{locations.dropoff.address}</Text>
                    </View>
                </View>

                <View style={styles.rideDetailsCard}>
                    <Text style={styles.sectionTitle}>Ride Details</Text>
                    <View style={styles.rideInfoRow}>
                        <View style={styles.rideInfoItem}>
                            <FontAwesome5 name="route" size={18} color="#555" />
                            <Text style={styles.rideInfoText}>{km_of_ride} km</Text>
                        </View>
                        <View style={styles.rideInfoItem}>
                            <MaterialIcons name="payment" size={20} color="#555" />
                            <Text style={styles.rideInfoText}>Cash: ₹{fares.payableAmount}</Text>
                        </View>
                    </View>
                </View>

                {/* Extra padding for bottom buttons */}
                <View style={styles.bottomPadding} />
            </ScrollView>

            {/* Fixed buttons at bottom */}
            <View style={styles.fixedButtonContainer}>
                <TouchableOpacity style={styles.rejectButton} onPress={handleReject}>
                    <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                    <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20,
    },
    loadingCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        width: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loadingText: {
        fontSize: 16,
        color: '#555',
        marginTop: 16,
        textAlign: 'center',
    },
    errorCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        width: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    errorText: {
        fontSize: 16,
        color: '#e74c3c',
        marginTop: 16,
        marginBottom: 24,
        textAlign: 'center',
    },
    errorButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    backButton: {
        backgroundColor: '#6c757d',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        marginRight: 8,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    retryButton: {
        backgroundColor: '#3498db',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        marginLeft: 8,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    backButtonSmall: {
        padding: 8,
    },
    headerTextContainer: {
        marginLeft: 8,
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    rideId: {
        fontSize: 14,
        color: '#666',
    },
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100, // Extra padding for fixed buttons
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    timerText: {
        fontSize: 14,
        color: '#666',
    },
    timerCounter: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    timerWarning: {
        color: '#e74c3c',
    },
    priceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    fareTitle: {
        fontSize: 16,
        color: '#666',
    },
    fareAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2ecc71',
        marginVertical: 8,
    },
    fareDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    fareSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    discountText: {
        fontSize: 14,
        color: '#e74c3c',
    },
    noteText: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
        marginTop: 8,
    },
    customerCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    customerText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 10,
    },
    locationCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    locationText: {
        fontSize: 14,
        color: '#333',
        marginLeft: 10,
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 12,
    },
    rideDetailsCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    rideInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rideInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rideInfoText: {
        fontSize: 14,
        color: '#333',
        marginLeft: 6,
    },
    bottomPadding: {
        height: 20,
    },
    fixedButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 10,
        zIndex: 1000,
        // Safe area padding for iOS
        paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: '#2ecc71',
        padding: 16,
        borderRadius: 8,
        marginLeft: 8,
        alignItems: 'center',
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    rejectButton: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginRight: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e74c3c',
    },
    rejectButtonText: {
        color: '#e74c3c',
        fontSize: 16,
        fontWeight: 'bold',
    },
});