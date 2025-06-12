import React from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Image,
    Linking,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const DriverCard = React.memo(({ driverData, rideDetails ,isRideStart }) => {
    return (
        <View style={styles.driverCard}>
            <View style={styles.driverProfile}>
                <View style={styles.driverImageContainer}>
                    <Image
                        source={require('../driver.png')}
                        style={styles.driverImage}
                        defaultSource={require('../driver.png')}
                    />
                    <View style={styles.onlineIndicator} />
                </View>
                <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driverData?.name || 'Driver Name'}</Text>
                    <View style={styles.ratingContainer}>
                        <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
                        <Text style={styles.rating}>{driverData?.Ratings || '4.8'}</Text>
                        <Text style={styles.trips}>• {driverData?.TotalRides || '150'} trips</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.callButton}
                    onPress={() => Linking.openURL(`tel:${'01141236767'}`)}
                >
                    <MaterialCommunityIcons name="phone" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <View style={styles.carDetails}>
                <View style={styles.carInfo}>
                    <MaterialCommunityIcons name="car" size={20} color="#6B7280" />
                    <Text style={styles.carText}>
                        {driverData?.rideVehicleInfo?.vehicleName || 'Vehicle'} • {driverData?.rideVehicleInfo?.VehicleNumber || 'XX-XX-XXXX'}
                    </Text>
                </View>
                {!isRideStart && (
                    <View style={styles.etaContainer}>
                        <MaterialCommunityIcons name="clock-outline" size={20} color="#10B981" />
                        <Text style={styles.etaText}>Arriving in {rideDetails.eta}</Text>
                    </View>
                )}


            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    driverCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    driverProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    driverImageContainer: {
        position: 'relative',
    },
    driverImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: '#C82333',
    },
    onlineIndicator: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 14,
        height: 14,
        backgroundColor: '#10B981',
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff',
    },
    driverInfo: {
        flex: 1,
        marginLeft: 12,
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
    rating: {
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
        color: '#4B5563',
    },
    trips: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 4,
    },
    callButton: {
        width: 48,
        height: 48,
        backgroundColor: '#C82333',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#C82333',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    carDetails: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 12,
    },
    carInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    carText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '500',
    },
    etaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    etaText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#10B981',
        fontWeight: '600',
    },
});