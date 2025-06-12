import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Platform,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import TrackMap from '../../Map/TrackMap';



export const LiveMap = React.memo(({ currentLocation, driverLocation }) => {
    const mapRef = useRef(null);

    // Request location permission if not granted
    const requestLocationPermission = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required for live tracking.');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error requesting location permission:', error);
            return false;
        }
    };

    // Update map when locations change
    useEffect(() => {
        if (mapRef.current && currentLocation && driverLocation) {
            mapRef.current.fitToCoordinates(
                [currentLocation, driverLocation],
                {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                }
            );
        }
    }, [currentLocation, driverLocation]);

    return (
        <View style={styles.mapContainer}>
            <Text style={styles.mapTitle}>Live Tracking</Text>

            {!currentLocation ? (
                <View style={styles.mapLoading}>
                    <MaterialCommunityIcons name="map-marker-question" size={32} color="#6B7280" />
                    <Text style={styles.mapLoadingText}>Getting your location...</Text>
                    <TouchableOpacity 
                        style={styles.mapPermissionButton}
                        onPress={requestLocationPermission}
                    >
                        <Text style={styles.mapPermissionButtonText}>Enable Location</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TrackMap
                    ref={mapRef}
                    origin={currentLocation} 
                    destination={driverLocation} 
                />
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    mapContainer: {
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
    mapTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    mapLoading: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapLoadingText: {
        marginTop: 8,
        color: '#6B7280',
        fontSize: 14,
        marginBottom: 12,
    },
    mapPermissionButton: {
        backgroundColor: '#C82333',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    mapPermissionButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
});