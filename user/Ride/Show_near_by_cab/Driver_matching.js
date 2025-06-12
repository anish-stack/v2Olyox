import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Dimensions,
    Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Map from '../Map/Map';
import { useRoute } from '@react-navigation/native';
import { useSocket } from '../../context/SocketContext';

const { width } = Dimensions.get('window');

export function DriverMatching({ navigation }) {
    const { socket, isConnected } = useSocket();
    const [matchingState, setMatchingState] = useState('found');
    const [timeLeft, setTimeLeft] = useState(2);
    const route = useRoute();
    const { origin, destination, ride } = route.params || {};
    const [selectedDriver] = useState({
        name: ride?.rider?.name || 'Driver', // Rider's name
        rating: ride?.rider?.Ratings || 4.8, // Rider's ratings
        trips: ride?.rider?.TotalRides || 0, // Total rides completed by the rider
        carNumber: ride?.rider?.rideVehicleInfo?.VehicleNumber || 'N/A', // Vehicle number
        carModel: ride?.rider?.rideVehicleInfo?.vehicleName || 'N/A', // Vehicle model
        vehicleType: ride?.vehicleType || 'N/A', // Vehicle type (e.g., SEDAN)
        eta: ride?.eta || 'N/A', // Estimated time of arrival
        otp: ride?.RideOtp || 'N/A', // OTP for the ride
        pickup_desc: ride?.pickup_desc || 'N/A', // Pickup description
        drop_desc: ride?.drop_desc || 'N/A', // Drop-off description
        price: ride?.kmOfRide || 'N/A', // Price of the ride
        distance: ride?.kmOfRide || 'N/A', // Distance of the ride
        rideStatus: ride?.rideStatus || 'N/A', // Current ride status
    });

    useEffect(() => {
        const countdownInterval = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, []);

    const handleRideAccept = () => {
        setMatchingState('success');
        if (socket()) {
            socket().emit('rideAccepted_by_user', {
                ride: ride,
                driver: selectedDriver
            });
        }
        setTimeout(() => {
            navigation.navigate('RideStarted', { driver: selectedDriver, ride: ride });
        }, 1500);



    };

    useEffect(()=>{
        setTimeout(()=>{
            handleRideAccept()
        },2623)
    },[])

    const RideInfo = () => (
        <View style={styles.rideInfoContainer}>
            <View style={styles.locationInfo}>
                <View style={styles.locationItem}>
                    <Icon name="map-marker" size={24} color="#2563EB" />
                    <View style={styles.locationText}>
                        <Text style={styles.locationLabel}>Pickup</Text>
                        <Text numberOfLines={1} style={styles.locationValue}>
                            {ride?.pickup_desc}
                        </Text>
                    </View>
                </View>
                <View style={styles.locationDivider} />
                <View style={styles.locationItem}>
                    <Icon name="map-marker-radius" size={24} color="#2563EB" />
                    <View style={styles.locationText}>
                        <Text style={styles.locationLabel}>Drop-off</Text>
                        <Text numberOfLines={1} style={styles.locationValue}>
                            {ride?.drop_desc}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const DriverCard = () => (
        <View style={styles.driverCard}>
            <View style={styles.driverHeader}>
                <View style={styles.driverInfo}>
                    <View style={styles.driverAvatar}>
                        <Icon name="account" size={32} color="#fff" />
                    </View>
                    <View>
                        <Text style={styles.driverName}>{selectedDriver.name}</Text>
                        <View style={styles.ratingContainer}>
                            <Icon name="star" size={16} color="#FCD34D" />
                            <Text style={styles.ratingText}>{selectedDriver.rating}</Text>
                            <Text style={styles.tripCount}>• {selectedDriver.trips} trips</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity style={styles.callButton}>
                    <Icon name="phone" size={20} color="#2563EB" />
                </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.vehicleInfo}>
                <View style={styles.vehicleDetails}>
                    <Icon name="car" size={24} color="#2563EB" />
                    <View style={styles.vehicleText}>
                        <Text style={styles.vehicleModel}>{selectedDriver.carModel}</Text>
                        <Text style={styles.vehicleNumber}>{selectedDriver.carNumber}</Text>
                    </View>
                </View>
                <View style={styles.etaContainer}>
                    <Icon name="clock-outline" size={20} color="#059669" />
                    <Text style={styles.etaText}>{selectedDriver.eta}</Text>
                </View>
            </View>

            <View style={styles.rideStats}>
                <View style={styles.statItem}>
                    <Icon name="map-marker-distance" size={20} color="#6B7280" />
                </View>
                <View style={styles.statItem}>
                    <Icon name="clock-outline" size={20} color="#6B7280" />
                    <Text style={styles.statText}>{ride?.EtaOfRide || "no"}</Text>
                </View>
                <View style={styles.statItem}>
                    <Icon name="currency-inr" size={20} color="#6B7280" />
                    <Text style={styles.statText}>₹{selectedDriver.price}</Text>
                </View>
            </View>

           
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Icon name="arrow-left" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Ride</Text>
                <View style={styles.placeholder} />
            </View>

            <View style={styles.mapContainer}>
                <Map origin={origin} destination={destination} />
            </View>

            <View style={styles.bottomSheet}>
                <RideInfo />
                <DriverCard />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    backButton: {
        padding: 8,
    },
    placeholder: {
        width: 40,
    },
    mapContainer: {
        flex: 1,
    },
    bottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    rideInfoContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    locationInfo: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 12,
    },
    locationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    locationText: {
        marginLeft: 12,
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    locationValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    locationDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    driverCard: {
        padding: 16,
        backgroundColor: '#fff',
    },
    driverHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    driverInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    driverAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    driverName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4B5563',
        marginLeft: 4,
    },
    tripCount: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 8,
    },
    callButton: {
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 16,
    },
    vehicleInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    vehicleDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    vehicleText: {
        marginLeft: 12,
    },
    vehicleModel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#111827',
    },
    vehicleNumber: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    etaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    etaText: {
        marginLeft: 4,
        color: '#059669',
        fontWeight: '600',
    },
    rideStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '500',
        color: '#4B5563',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    acceptButton: {
        flex: 1,
        backgroundColor: '#2563EB',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#2563EB',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#FEE2E2',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#DC2626',
        fontSize: 16,
        fontWeight: '600',
    },
});