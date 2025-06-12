import React, { useEffect, useState, useRef, forwardRef } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8';

const TrackMap = forwardRef(({ origin, destination }, ref) => {

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const [directionsReady, setDirectionsReady] = useState(false);

    const internalMapRef = useRef(null);
    const mapRef = ref || internalMapRef;

    const validDestination = Array.isArray(destination) && destination.length === 2
        ? destination
        : [77.1507, 28.6922]; 

    const destinationCoord = {
        latitude: validDestination[1],
        longitude: validDestination[0],
    };


    const [region, setRegion] = useState({
        latitude: (origin?.latitude + destination[1]) / 2,
        longitude: (origin?.longitude + destination[0]) / 2,
        latitudeDelta: Math.abs(origin?.latitude - destination[1]) * 1.5,
        longitudeDelta: Math.abs(origin?.longitude - destination[0]) * 1.5,
    });



    useEffect(() => {
        if (mapReady && directionsReady) {
            setLoading(false);
        }
    }, [mapReady, directionsReady]);

    useEffect(() => {
        if (loading) {
            const timer = setTimeout(() => {
                if (!mapReady || !directionsReady) {
                    setError('Map loading timed out. Please check your internet connection.');
                    setLoading(false);
                }
            }, 15000);

            return () => clearTimeout(timer);
        }
    }, [loading, mapReady, directionsReady]);

    const handleRetry = () => {
        setError(null);
        setRetryCount(prev => prev + 1);
        setMapReady(false);
        setDirectionsReady(false);
        setLoading(true);
    };

    const zoomIn = () => {
        if (mapRef.current) {
            const newRegion = {
                ...region,
                latitudeDelta: region.latitudeDelta / 2,
                longitudeDelta: region.longitudeDelta / 2,
            };
            mapRef.current.animateToRegion(newRegion, 200);
            setRegion(newRegion);
        }
    };

    const zoomOut = () => {
        if (mapRef.current) {
            const newRegion = {
                ...region,
                latitudeDelta: region.latitudeDelta * 2,
                longitudeDelta: region.longitudeDelta * 2,
            };
            mapRef.current.animateToRegion(newRegion, 200);
            setRegion(newRegion);
        }
    };

    const fitToCoordinates = (result) => {
        if (mapRef.current && result?.coordinates?.length > 0) {
            const edgePadding = {
                top: Platform.OS === 'ios' ? 100 : 80,
                right: Platform.OS === 'ios' ? 100 : 80,
                bottom: Platform.OS === 'ios' ? 100 : 80,
                left: Platform.OS === 'ios' ? 100 : 80
            };

            mapRef.current.fitToCoordinates(result.coordinates, {
                edgePadding,
                animated: true,
            });
            setDirectionsReady(true);
        }
    };

    return (
        <View style={styles.container}>
            {loading &&
                <ActivityIndicator
                    size="large"
                    color="#23527C"
                    style={styles.loader}
                />
            }

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            <MapView
                ref={mapRef}
                key={`map-${retryCount}`}
                provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={region}
                showsUserLocation={true}
                showsMyLocationButton={Platform.OS === 'android'}
                showsCompass={true}
                showsScale={true}
                onMapReady={() => setMapReady(true)}
                onError={() => setError('Failed to load map.')}
            >
                <Marker coordinate={origin} title="Pickup">
                    <Icon
                        name={Platform.OS === 'ios' ? 'human-greeting' : 'nature-people'}
                        size={40}
                        color="#23527C"
                    />
                </Marker>

                <Marker coordinate={destination} title="Dropoff">
                    <Icon
                        name="map-marker"
                        size={40}
                        color="#F44336"
                    />
                </Marker>

                <MapViewDirections
                    origin={origin}
                    destination={destinationCoord}
                    apikey={GOOGLE_MAPS_APIKEY}
                    strokeWidth={5}
                    strokeColor={Platform.OS === 'ios' ? '#0066CC' : '#23527C'}
                    onReady={fitToCoordinates}
                    onError={() => setError('Failed to load directions.')}
                />
            </MapView>

            {Platform.OS === 'android' && (
                <View style={styles.zoomControls}>
                    <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
                        <Icon name="plus" size={24} color="#23527C" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
                        <Icon name="minus" size={24} color="#23527C" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
});

export default TrackMap;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    map: {
        flex: 1,
        ...Platform.select({
            ios: {
                borderRadius: 10,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    loader: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: -15,
        marginTop: -15,
        zIndex: 1,
    },
    errorContainer: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: [{ translateX: -100 }, { translateY: -50 }],
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        width: 200,
        zIndex: 2,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    errorText: {
        textAlign: 'center',
        marginBottom: 10,
        color: '#D32F2F',
    },
    retryButton: {
        backgroundColor: '#23527C',
        padding: 10,
        borderRadius: 5,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    zoomControls: {
        position: 'absolute',
        right: 16,
        bottom: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 8,
        padding: 4,
        ...Platform.select({
            android: {
                elevation: 3,
            },
        }),
    },
    zoomButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 4,
    },
});