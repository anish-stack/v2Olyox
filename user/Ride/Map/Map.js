import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import axios from 'axios';
import PolylineDecoder from '@mapbox/polyline';

const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8'; // Replace with your key
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;

const DEFAULT_PADDING = { top: 100, right: 100, bottom: 100, left: 100 };

const INITIAL_REGION = {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0922 * ASPECT_RATIO,
};

const Map = ({ origin, destination, isFakeRiderShow = false }) => {
    console.log("Map origin ",origin)
    console.log("Map destination ",destination)
    const mapRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [fakeRiders, setFakeRiders] = useState([]);
    const [coordinates, setCoordinates] = useState([]);
    const [distance, setDistance] = useState(null);
    const [duration, setDuration] = useState(null);

    const mapStyle = useMemo(() => ({
        light: Platform.OS === 'android' ? [/* Android custom styles */] : [],
    }), []);

    // Generate fake riders if needed
    useEffect(() => {
        if (isFakeRiderShow && origin) {
            const riders = Array.from({ length: 5 }, (_, i) => ({
                id: `rider-${i}`,
                coordinate: {
                    latitude: origin.latitude + (Math.random() - 0.5) * 0.01,
                    longitude: origin.longitude + (Math.random() - 0.5) * 0.01,
                },
                type: ['car', 'suv', 'premium'][Math.floor(Math.random() * 3)],
            }));
            setFakeRiders(riders);
        }
    }, [isFakeRiderShow, origin]);

    // iOS: Fetch directions from backend API
    useEffect(() => {
        if (Platform.OS === 'ios' && origin && destination) {
            const fetchDirections = async () => {
                try {
                    console.log("Fetching directions...");
                    
                    // Prepare the pickup and dropoff data
                    const pickup = {
                        latitude: origin.latitude,
                        longitude: origin.longitude
                    };
                    const dropoff = {
                        latitude: destination.latitude,
                        longitude: destination.longitude
                    };
                    
                    // Send the pickup and dropoff coordinates to your backend API
                    const response = await axios.post('https://appapi.olyox.com/directions', { pickup, dropoff });
                    
                    const json = response.data;
                    console.log("Fetching directions json...", json);
                    
                    if (json?.polyline) {
                        const decodedCoords = PolylineDecoder.decode(json.polyline).map(([lat, lng]) => ({
                            latitude: lat,
                            longitude: lng,
                        }));
                        setCoordinates(decodedCoords);
                    }
                    
                    if (json?.distance) setDistance(json.distance);
                    if (json?.duration) setDuration(json.duration);
                } catch (err) {
                    console.error("Error fetching directions:", err?.response?.data || err.message);
                    setError('Failed to load directions. Please check your internet connection.');
                }
            };
            
            fetchDirections();
        }
    }, [origin, destination]);

    useEffect(() => {
        if (isFakeRiderShow && fakeRiders.length && mapRef.current) {
            const coords = fakeRiders.map(rider => rider.coordinate);
            mapRef.current.fitToCoordinates(coords, {
                edgePadding: DEFAULT_PADDING,
                animated: true,
            });
        }
    }, [isFakeRiderShow, fakeRiders]);

    const fitToMarkers = () => {
        if (!mapRef.current || (!origin && !destination)) return;
        
        const markersToFit = [];
        if (origin) markersToFit.push(origin);
        if (destination) markersToFit.push(destination);
        if (fakeRiders.length > 0) {
            markersToFit.push(...fakeRiders.map(r => r.coordinate));
        }
        
        if (markersToFit.length > 0) {
            mapRef.current.fitToCoordinates(markersToFit, {
                edgePadding: DEFAULT_PADDING,
                animated: true,
            });
        }
    };

    const onMapReady = () => {
        setLoading(false);
        fitToMarkers();
    };

    const renderVehicleMarker = (type) => {
        const iconMap = {
            car: 'local-taxi',
            suv: 'directions-car',
            premium: 'star',
        };
        return <MaterialIcons name={iconMap[type] || 'local-taxi'} size={24} color="#000" />;
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={INITIAL_REGION}
                customMapStyle={mapStyle.light}
                onMapReady={onMapReady}
                showsUserLocation
                showsMyLocationButton
                showsCompass
                rotateEnabled={true}
            >
                {origin && (
                    <Marker coordinate={origin} title="Pickup">
                        <View style={[styles.markerContainer]}>
                            <MaterialIcons name="trip-origin" size={24} color="#4CAF50" />
                        </View>
                    </Marker>
                )}

                {destination && (
                    <Marker coordinate={destination} title="Dropoff">
                        <View style={[styles.markerContainer]}>
                            <MaterialIcons name="place" size={24} color="#F44336" />
                        </View>
                    </Marker>
                )}

                {isFakeRiderShow && fakeRiders.map(rider => (
                    <Marker key={rider.id} coordinate={rider.coordinate}>
                        <View style={styles.vehicleMarker}>
                            {renderVehicleMarker(rider.type)}
                        </View>
                    </Marker>
                ))}
                
                {/* iOS: Use the fetched polyline coordinates */}
                {Platform.OS === 'ios' && coordinates.length > 0 && (
                    <Polyline
                        coordinates={coordinates}
                        strokeWidth={4}
                        strokeColor="#2196F3"
                    />
                )}

                {/* Android: Use MapViewDirections */}
                {Platform.OS === 'android' && origin && destination && (
                    <MapViewDirections
                        origin={origin}
                        destination={destination}
                        apikey={GOOGLE_MAPS_APIKEY}
                        strokeWidth={4}
                        strokeColor="#2196F3"
                        mode="DRIVING"
                        precision="high"
                        onReady={(result) => {
                            setDistance(result.distance);
                            setDuration(result.duration);
                            fitToMarkers();
                        }}
                        onError={(errorMessage) => {
                            setError('Failed to load directions. Please check your internet or API Key.');
                            console.warn('MapViewDirections Error:', errorMessage);
                        }}
                    />
                )}
            </MapView>

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                </View>
            )}

            <View style={styles.controls}>
                <TouchableOpacity style={styles.controlButton} onPress={fitToMarkers}>
                    <MaterialIcons name="center-focus-strong" size={24} color="#2196F3" />
                </TouchableOpacity>
            </View>

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
            
           
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    controls: {
        position: 'absolute',
        bottom: 20,
        right: 20,
    },
    controlButton: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 30,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    markerContainer: {
        backgroundColor: '#fff',
        padding: 8,
        borderRadius: 20,
    },
    vehicleMarker: {
        padding: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
    },
    errorContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    errorText: {
        color: '#F44336',
        textAlign: 'center',
    },
    infoContainer: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    infoText: {
        textAlign: 'center',
        color: '#212121',
        fontWeight: '500',
    },
});

export default React.memo(Map);