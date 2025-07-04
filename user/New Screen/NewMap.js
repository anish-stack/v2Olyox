import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';

const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8';
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = 0.015;
const REACH_THRESHOLD = 100;
const NEARBY_THRESHOLD = 200;
const DEFAULT_COORDINATES = {
  latitude: 40.7128,
  longitude: -74.0060
};

const CarIcon = ({ color = '#000', size = 30, isNearby = false }) => (
  <View style={[
    styles.carIconContainer, 
    { width: size, height: size },
    isNearby && styles.nearbyCarIcon
  ]}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
        fill={color}
      />
    </Svg>
    {isNearby && (
      <View style={styles.pulseRing}>
        <Animated.View style={[styles.pulse, { backgroundColor: color + '20' }]} />
      </View>
    )}
  </View>
);

const PersonIcon = ({ color = '#4CAF50', size = 30, isNearby = false }) => (
  <View style={[
    styles.personIconContainer, 
    { width: size, height: size },
    isNearby && styles.nearbyPersonIcon
  ]}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" fill={color} />
      <Path
        d="M12 14c-6.67 0-8 4-8 4v2h16v-2s-1.33-4-8-4z"
        fill={color}
      />
    </Svg>
    {isNearby && (
      <View style={styles.pulseRing}>
        <Animated.View style={[styles.pulse, { backgroundColor: color + '20' }]} />
      </View>
    )}
  </View>
);

const DropOffIcon = ({ size = 35 }) => (
  <View style={[styles.dropIconContainer, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
        fill="#FF6B35"
        stroke="#FFF"
        strokeWidth="1"
      />
    </Svg>
    <View style={styles.dropIconShadow} />
  </View>
);

export default function NewUserAndDriverMap({ 
  userLocation, 
  DriverLocation, 
  DropLocation, 
  rideStatus,
  routeCoordinates = [] // For iOS polyline fallback
}) {
  const mapRef = useRef(null);
  const [notified, setNotified] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [driverDistance, setDriverDistance] = useState(null);
  const [directionsError, setDirectionsError] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [debouncedCoords, setDebouncedCoords] = useState({});
  const debounceTimer = useRef(null);
  
  // Platform detection
  const isAndroid = Platform.OS === 'android';
  const mapProvider = isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  // Safe coordinate extraction with defaults
  const getSafeCoordinates = useCallback((location, type = 'object') => {
    try {
      if (!location) return null;
      
      if (type === 'array') {
        if (Array.isArray(location) && location.length >= 2) {
          const lat = parseFloat(location[1]);
          const lng = parseFloat(location[0]);
          
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng };
          }
        }
      } else if (type === 'coords') {
        if (typeof location === 'object' && location?.coords) {
          const lat = parseFloat(location.coords.latitude);
          const lng = parseFloat(location.coords.longitude);
          
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng };
          }
        }
      } else {
        if (typeof location === 'object' && location?.latitude && location?.longitude) {
          const lat = parseFloat(location.latitude);
          const lng = parseFloat(location.longitude);
          
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error processing coordinates:', error);
      return null;
    }
  }, []);

  // Debounced coordinate processing
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const driverCoords = getSafeCoordinates(DriverLocation, 'array');
      const userCoords = getSafeCoordinates(userLocation, 'coords');
      const dropCoords = getSafeCoordinates(DropLocation, 'array');

      setDebouncedCoords({
        driver: driverCoords,
        user: userCoords,
        drop: dropCoords
      });
    }, 1000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [DriverLocation, userLocation, DropLocation, getSafeCoordinates]);

  // Use debounced coordinates or fallback
  const driverCoords = debouncedCoords.driver || getSafeCoordinates(userLocation, 'coords') || DEFAULT_COORDINATES;
  const userCoords = debouncedCoords.user || getSafeCoordinates(userLocation, 'coords') || DEFAULT_COORDINATES;
  const dropCoords = debouncedCoords.drop;

  const getDistance = useCallback((lat1, lon1, lat2, lon2) => {
    try {
      const toRad = (value) => (value * Math.PI) / 180;
      const R = 6371e3; // Earth radius in meters
      const φ1 = toRad(lat1);
      const φ2 = toRad(lat2);
      const Δφ = toRad(lat2 - lat1);
      const Δλ = toRad(lon2 - lon1);
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    } catch (error) {
      console.error('Error calculating distance:', error);
      return 0;
    }
  }, []);

  // Calculate offset for nearby markers to prevent overlap
  const getMarkerOffset = useCallback((distance, isDriver = false) => {
    if (!distance || distance > NEARBY_THRESHOLD) return { x: 0, y: 0 };
    
    const offsetDistance = 0.0001;
    return isDriver 
      ? { x: -offsetDistance, y: offsetDistance }
      : { x: offsetDistance, y: -offsetDistance };
  }, []);

  // Fit to markers function
  const fitToMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady) return;
    
    try {
      const coordinates = [];
      
      if (userCoords && userCoords.latitude !== DEFAULT_COORDINATES.latitude) {
        coordinates.push(userCoords);
      }
      
      if (driverCoords && driverCoords.latitude !== DEFAULT_COORDINATES.latitude && debouncedCoords.driver) {
        coordinates.push(driverCoords);
      }
      
      if (dropCoords && dropCoords.latitude !== DEFAULT_COORDINATES.latitude) {
        coordinates.push(dropCoords);
      }
      
      if (coordinates.length > 1) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 200, left: 100 },
          animated: true,
        });
      } else if (coordinates.length === 1) {
        mapRef.current.animateToRegion({
          ...coordinates[0],
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }, 1000);
      }
    } catch (error) {
      console.error('Error fitting to markers:', error);
    }
  }, [mapReady, userCoords, driverCoords, dropCoords, debouncedCoords]);

  // Calculate distance and update state
  useEffect(() => {
    if (debouncedCoords.driver && debouncedCoords.user) {
      const distance = getDistance(
        debouncedCoords.user.latitude,
        debouncedCoords.user.longitude,
        debouncedCoords.driver.latitude,
        debouncedCoords.driver.longitude
      );
      setDriverDistance(distance);

      // Animate pulse for nearby drivers
      if (distance < REACH_THRESHOLD) {
        const animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        );
        animation.start();
        
        return () => animation.stop();
      }
    }
  }, [debouncedCoords, getDistance, pulseAnim]);

  // Auto-fit map when coordinates change
  useEffect(() => {
    if (mapReady && debouncedCoords.user) {
      const timer = setTimeout(() => {
        fitToMarkers();
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [mapReady, debouncedCoords, fitToMarkers]);

  // Notification logic
  useEffect(() => {
    if (
      typeof driverDistance === 'number' &&
      driverDistance > 0 &&
      driverDistance < REACH_THRESHOLD &&
      !notified &&
      rideStatus !== 'in_progress' &&
      rideStatus !== 'completed'
    ) {
      try {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Driver Nearby!',
            body: `Your driver is ${Math.round(driverDistance)}m away and approaching.`,
          },
          trigger: null,
        });
        setNotified(true);
      } catch (error) {
        console.error('Error scheduling notification:', error);
      }
    }
  }, [driverDistance, notified, rideStatus]);

  // Handle directions error
  const handleDirectionsError = useCallback((errorMessage) => {
    console.warn('MapViewDirections Error:', errorMessage);
    setDirectionsError(true);
    setTimeout(() => setDirectionsError(false), 5000);
  }, []);

  const isDriverNearby = driverDistance && driverDistance < NEARBY_THRESHOLD;
  const driverOffset = getMarkerOffset(driverDistance || 0, true);
  const userOffset = getMarkerOffset(driverDistance || 0, false);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={mapProvider}
        style={styles.map}
        initialRegion={{
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        minZoomLevel={5}
        maxZoomLevel={18}
      >
        {/* User Location Marker */}
        {userCoords && (
          <Marker
            coordinate={{
              latitude: userCoords.latitude + (isDriverNearby ? userOffset.x : 0),
              longitude: userCoords.longitude + (isDriverNearby ? userOffset.y : 0),
            }}
            title="Your Location"
            description="Pickup Point"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <PersonIcon 
              color="#4CAF50" 
              size={35} 
              isNearby={isDriverNearby}
            />
          </Marker>
        )}

        {/* Driver Location Marker */}
        {debouncedCoords.driver && (
          <Marker
            coordinate={{
              latitude: debouncedCoords.driver.latitude + (isDriverNearby ? driverOffset.x : 0),
              longitude: debouncedCoords.driver.longitude + (isDriverNearby ? driverOffset.y : 0),
            }}
            title="Driver"
            description={`${Math.round(driverDistance || 0)}m away`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <CarIcon 
              color="#2196F3" 
              size={35}
              isNearby={isDriverNearby}
            />
          </Marker>
        )}

        {/* Drop Location Marker */}
        {dropCoords && (
          <Marker
            coordinate={dropCoords}
            title="Drop Location"
            description="Destination"
            anchor={{ x: 0.5, y: 1 }}
          >
            <DropOffIcon size={40} />
          </Marker>
        )}

        {/* Route from driver to user - Android only */}
        {isAndroid && 
         debouncedCoords.driver && 
         debouncedCoords.user && 
         rideStatus === 'driver_assigned' && 
         !directionsError && (
          <MapViewDirections
            origin={debouncedCoords.driver}
            destination={debouncedCoords.user}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#2196F3"
            optimizeWaypoints={true}
            mode="DRIVING"
            onError={handleDirectionsError}
            onReady={(result) => {
              console.log('Route calculated - Distance:', result.distance, 'Duration:', result.duration);
            }}
          />
        )}

        {/* Route from user to drop location - Android only */}
        {isAndroid && 
         debouncedCoords.user && 
         dropCoords && 
         rideStatus === 'in_progress' && 
         !directionsError && (
          <MapViewDirections
            origin={debouncedCoords.user}
            destination={dropCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF6B35"
            optimizeWaypoints={true}
            mode="DRIVING"
            onError={handleDirectionsError}
            onReady={(result) => {
              console.log('Route calculated - Distance:', result.distance, 'Duration:', result.duration);
            }}
          />
        )}

        {/* iOS Polyline fallback */}
        {!isAndroid && 
         routeCoordinates && 
         routeCoordinates.length > 0 && (
          <Polyline 
            coordinates={routeCoordinates} 
            strokeWidth={4} 
            strokeColor={rideStatus === 'driver_assigned' ? "#2196F3" : "#FF6B35"} 
            lineDashPattern={[0]}
          />
        )}
      </MapView>

      {/* Error indicator */}
      {directionsError && (
        <View style={styles.errorIndicator}>
          <Text style={styles.errorText}>
            Route calculation failed. Retrying...
          </Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlButtons}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={fitToMarkers}
        >
          <Ionicons name="locate" size={24} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => {
            console.log('Refreshing location...');
            setDirectionsError(false);
            setNotified(false);
          }}
        >
          <Ionicons name="refresh" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Distance Card */}
      {driverDistance && driverDistance > 0 && (
        <View style={styles.distanceCard}>
          <View style={styles.distanceInfo}>
            <Ionicons name="car" size={20} color="#2196F3" />
            <Text style={styles.distanceMainText}>
              {Math.round(driverDistance)}m
            </Text>
            <Text style={styles.distanceSubText}>away</Text>
          </View>
          <View style={styles.etaInfo}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.etaText}>
              ETA: {Math.round(driverDistance / 50)} min
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  carIconContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyCarIcon: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
    borderWidth: 3,
  },
  personIconContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nearbyPersonIcon: {
    backgroundColor: '#E8F5E8',
    borderColor: '#388E3C',
    borderWidth: 3,
  },
  dropIconContainer: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropIconShadow: {
    position: 'absolute',
    bottom: -5,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 8,
    backgroundColor: '#00000020',
    borderRadius: 8,
  },
  pulseRing: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulse: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    opacity: 0.6,
  },
  errorIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 5,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  controlButtons: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    flexDirection: 'column',
  },
  controlButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 12,
    marginBottom: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  distanceCard: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  distanceMainText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginLeft: 8,
    marginRight: 4,
  },
  distanceSubText: {
    fontSize: 16,
    color: '#666',
  },
  etaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
});