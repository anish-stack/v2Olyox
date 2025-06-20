import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, Linking, Platform } from 'react-native';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import MapView, {
    Marker,
    PROVIDER_GOOGLE,
    Polyline,
    Callout,
    AnimatedRegion
} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import useLocationTracking from '../../../hooks/useLocationTracking';
import { colors } from '../../NewConstant';

const GOOGLE_MAPS_APIKEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8";
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = 0.015;
const REACH_THRESHOLD = 100; // meters

const { width, height } = Dimensions.get('window');

const status = {
    driver_assigned: 'Driver Assigned',
    driver_arrived: 'Driver Arrived',
    in_progress: 'In Progress',
    completed: 'Completed',
};

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

// Get status color based on ride status
const getStatusColor = (status) => {
    switch (status) {
        case 'driver_assigned':
            return colors.warning;
        case 'driver_arrived':
            return colors.info;
        case 'in_progress':
            return colors.red200;
        case 'completed':
            return colors.success;
        default:
            return colors.textSecondary;
    }
};

export default function NewMap({ pickup, drop, ride_status, isReached }) {
    const { currentLocation, startLocationTracking } = useLocationTracking();
    const mapRef = useRef(null);
    const [localIsReached, setLocalIsReached] = useState(isReached || false);
    const [distance, setDistance] = useState(0);
    const [duration, setDuration] = useState(0);
    const [routeCoordinates, setRouteCoordinates] = useState([]);

    // Convert pickup and drop arrays to objects
    const pickupLocation = pickup ? { latitude: pickup[1], longitude: pickup[0] } : null;
    const dropLocation = drop ? { latitude: drop[1], longitude: drop[0] } : null;

    // Initialize location tracking
    useEffect(() => {
        startLocationTracking();
    }, []);

    // Check if driver has reached pickup location
    useEffect(() => {
        if (currentLocation && pickupLocation && ride_status === 'driver_assigned') {
            const distanceToPickup = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                pickupLocation.latitude,
                pickupLocation.longitude
            );

            if (distanceToPickup <= REACH_THRESHOLD && !localIsReached) {
                setLocalIsReached(true);
                Alert.alert('Reached!', 'Driver has reached the pickup location');
            }
        }
    }, [currentLocation, pickupLocation, ride_status, localIsReached]);

    // Determine origin and destination based on status
    const getRoutePoints = useCallback(() => {
        if (!currentLocation) return { origin: null, destination: null };

        if (ride_status === 'driver_assigned' && !localIsReached) {
            // Show route from driver to pickup
            return {
                origin: currentLocation,
                destination: pickupLocation
            };
        } else if (ride_status === 'driver_arrived' || ride_status === 'in_progress' || localIsReached) {
            // Show route from pickup to drop
            return {
                origin: pickupLocation,
                destination: dropLocation
            };
        }

        return { origin: null, destination: null };
    }, [currentLocation, pickupLocation, dropLocation, ride_status, localIsReached]);

    const { origin, destination } = getRoutePoints();

    // Auto-fit map to show relevant points
    const fitMapToCoordinates = useCallback(() => {
        if (!mapRef.current) return;

        const coordinates = [];
        
        if (currentLocation) coordinates.push(currentLocation);
        if (pickupLocation) coordinates.push(pickupLocation);
        if (dropLocation && (ride_status === 'driver_arrived' || ride_status === 'in_progress' || localIsReached)) {
            coordinates.push(dropLocation);
        }

        if (coordinates.length > 0) {
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }
    }, [currentLocation, pickupLocation, dropLocation, ride_status, localIsReached]);

    // Fit map when locations change
    useEffect(() => {
        const timer = setTimeout(fitMapToCoordinates, 1000);
        return () => clearTimeout(timer);
    }, [fitMapToCoordinates]);

    // Open Google Maps for navigation
    const openGoogleMaps = (destination, label) => {
        if (!destination) {
            Alert.alert('Error', 'Destination not available');
            return;
        }

        const { latitude, longitude } = destination;
        const url = Platform.select({
            ios: `maps:0,0?q=${latitude},${longitude}`,
            android: `geo:0,0?q=${latitude},${longitude}(${label})`,
        });

        const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

        Linking.canOpenURL(url)
            .then((supported) => {
                if (supported) {
                    return Linking.openURL(url);
                } else {
                    return Linking.openURL(fallbackUrl);
                }
            })
            .catch((err) => {
                console.error('Error opening maps:', err);
                Linking.openURL(fallbackUrl);
            });
    };

    // Navigate to pickup location on map
    const navigateToPickup = () => {
        if (pickupLocation && mapRef.current) {
            mapRef.current.animateToRegion({
                ...pickupLocation,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            }, 1000);
        }
    };

    // Navigate to drop location on map
    const navigateToDrop = () => {
        if (dropLocation && mapRef.current) {
            mapRef.current.animateToRegion({
                ...dropLocation,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            }, 1000);
        }
    };

    // Handle directions ready
    const onDirectionsReady = (result) => {
        setDistance(result.distance);
        setDuration(result.duration);
        setRouteCoordinates(result.coordinates);
    };

    if (!currentLocation) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading location...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Status Bar */}
            <View style={styles.statusBar}>
                <View style={styles.statusLeft}>
                    <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(ride_status) }]} />
                    <Text style={styles.statusText}>
                        {status[ride_status] || ride_status}
                    </Text>
                </View>
                {distance > 0 && (
                    <View style={styles.statusRight}>
                        <Ionicons name="time-outline" size={16} color={colors.textLight} />
                        <Text style={styles.distanceText}>
                            {distance.toFixed(1)}km • {Math.round(duration)}min
                        </Text>
                    </View>
                )}
            </View>

            {/* Map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                }}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={true}
                rotateEnabled={true}
                pitchEnabled={true}
            >
                {/* Driver Marker */}
                {currentLocation && (
                    <Marker
                        coordinate={currentLocation}
                        title="Driver Location"
                        description="Current driver position"
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.driverMarker}>
                            <FontAwesome5 name="car" size={20} color={colors.textLight} />
                        </View>
                        <Callout style={styles.callout}>
                            <View style={styles.calloutContent}>
                                <FontAwesome5 name="car" size={16} color={colors.red200} />
                                <Text style={styles.calloutTitle}>Driver</Text>
                                <Text style={styles.calloutSubtitle}>Current Position</Text>
                            </View>
                        </Callout>
                    </Marker>
                )}

                {/* Pickup Marker */}
                {pickupLocation && (
                    <Marker
                        coordinate={pickupLocation}
                        title="Pickup Location"
                        description="Customer pickup point"
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.pickupMarker}>
                            <MaterialIcons name="person-pin-circle" size={28} color={colors.success} />
                        </View>
                        <Callout style={styles.callout}>
                            <View style={styles.calloutContent}>
                                <MaterialIcons name="location-on" size={16} color={colors.success} />
                                <Text style={styles.calloutTitle}>Pickup</Text>
                                <Text style={styles.calloutSubtitle}>Customer Location</Text>
                            </View>
                        </Callout>
                    </Marker>
                )}

                {/* Drop Marker - Show only when appropriate */}
                {dropLocation && (ride_status === 'driver_arrived' || ride_status === 'in_progress' || localIsReached) && (
                    <Marker
                        coordinate={dropLocation}
                        title="Drop Location"
                        description="Customer destination"
                        anchor={{ x: 0.5, y: 1 }}
                    >
                        <View style={styles.dropMarker}>
                            <MaterialIcons name="place" size={28} color={colors.error} />
                        </View>
                        <Callout style={styles.callout}>
                            <View style={styles.calloutContent}>
                                <MaterialIcons name="flag" size={16} color={colors.error} />
                                <Text style={styles.calloutTitle}>Destination</Text>
                                <Text style={styles.calloutSubtitle}>Drop Location</Text>
                            </View>
                        </Callout>
                    </Marker>
                )}

                {/* Directions */}
                {origin && destination && (
                    <MapViewDirections
                        origin={origin}
                        destination={destination}
                        apikey={GOOGLE_MAPS_APIKEY}
                        strokeColor={colors.red200}
                        strokeWidth={5}
                        optimizeWaypoints={true}
                        onReady={onDirectionsReady}
                        onError={(errorMessage) => {
                            console.error('Directions Error:', errorMessage);
                        }}
                    />
                )}
            </MapView>

            {/* Navigation Buttons */}
            <View style={styles.buttonContainer}>
                {/* Map Navigation Buttons */}
                {/* <View style={styles.mapButtonsRow}>
                    <TouchableOpacity
                        style={[styles.mapButton, styles.pickupMapButton]}
                        onPress={navigateToPickup}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons name="my-location" size={20} color={colors.textLight} />
                        <Text style={styles.mapButtonText}>Pickup</Text>
                    </TouchableOpacity>

                    {(ride_status === 'driver_arrived' || ride_status === 'in_progress' || localIsReached) && (
                        <TouchableOpacity
                            style={[styles.mapButton, styles.dropMapButton]}
                            onPress={navigateToDrop}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="flag" size={20} color={colors.textLight} />
                            <Text style={styles.mapButtonText}>Drop</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.mapButton, styles.fitButton]}
                        onPress={fitMapToCoordinates}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons name="center-focus-strong" size={20} color={colors.textLight} />
                        <Text style={styles.mapButtonText}>Fit</Text>
                    </TouchableOpacity>
                </View> */}

                {/* Google Maps Navigation Buttons */}
                <View style={styles.googleMapsRow}>
                    <TouchableOpacity
                        style={[styles.googleMapsButton, styles.pickupGoogleButton]}
                        onPress={() => openGoogleMaps(pickupLocation, 'Pickup Location')}
                        activeOpacity={0.8}
                    >
                        <AntDesign name="google" size={18} color={colors.textLight} />
                        <MaterialIcons name="navigation" size={18} color={colors.textLight} />
                        <Text style={styles.googleButtonText}>Navigate to Pickup</Text>
                    </TouchableOpacity>

                    {(ride_status === 'driver_arrived' || ride_status === 'in_progress' || localIsReached) && (
                        <TouchableOpacity
                            style={[styles.googleMapsButton, styles.dropGoogleButton]}
                            onPress={() => openGoogleMaps(dropLocation, 'Drop Location')}
                            activeOpacity={0.8}
                        >
                            <AntDesign name="google" size={18} color={colors.textLight} />
                            <MaterialIcons name="navigation" size={18} color={colors.textLight} />
                            <Text style={styles.googleButtonText}>Navigate to Drop</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Debug Info (remove in production) */}
           
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundDefault,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.backgroundDefault,
    },
    statusBar: {
        backgroundColor: colors.red200,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: colors.textDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        color: colors.textLight,
        fontSize: 16,
        fontWeight: '600',
    },
    statusRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    distanceText: {
        color: colors.textLight,
        fontSize: 14,
        marginLeft: 4,
        fontWeight: '500',
    },
    map: {
        flex: 1,
        width: '100%',
        height: 350,
    },
    driverMarker: {
        backgroundColor: colors.red200,
        padding: 10,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: colors.textLight,
        shadowColor: colors.textDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 8,
    },
    pickupMarker: {
        shadowColor: colors.textDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    dropMarker: {
        shadowColor: colors.textDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    callout: {
        borderRadius: 8,
        padding: 0,
    },
    calloutContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        minWidth: 120,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
        marginLeft: 6,
        marginRight: 4,
    },
    calloutSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginLeft: 4,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
    },
    mapButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 25,
        shadowColor: colors.textDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        flex: 1,
        marginHorizontal: 4,
        justifyContent: 'center',
    },
    pickupMapButton: {
        backgroundColor: colors.success,
    },
    dropMapButton: {
        backgroundColor: colors.error,
    },
    fitButton: {
        backgroundColor: colors.textSecondary,
    },
    mapButtonText: {
        color: colors.textLight,
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 12,
    },
    googleMapsRow: {
        gap: 8,
    },
    googleMapsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 30,
        shadowColor: colors.textDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
        marginBottom: 8,
    },
    pickupGoogleButton: {
        backgroundColor: colors.success,
    },
    dropGoogleButton: {
        backgroundColor: colors.error,
    },
    googleButtonText: {
        color: colors.textLight,
        fontWeight: '700',
        marginLeft: 8,
        fontSize: 15,
        letterSpacing: 0.5,
    },
    debugContainer: {
        position: 'absolute',
        top: 80,
        left: 10,
        right: 10,
        backgroundColor: colors.backgroundOverlay,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    debugText: {
        color: colors.textLight,
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 2,
    },
});