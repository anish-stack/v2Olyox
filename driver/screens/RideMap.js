import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
  Text as RNText,
  Animated,
  ActivityIndicator,
  LogBox,
  __DEV__,
  Text
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
  Callout,
  AnimatedRegion
} from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

// Suppress specific warnings related to MapView
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Failed prop type: Invalid prop `coordinate` supplied to `Marker`'
]);

// Constants
const GOOGLE_MAPS_APIKEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8";
const LATITUDE_DELTA = 0.015;
const LONGITUDE_DELTA = 0.015;

// Custom map styles to match Uber/Ola/Rapido look
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#c9c9c9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

// Car image for marker - using the provided URLs
const CAR_IMAGE = { uri: 'https://i.ibb.co/d0df1tbh/taxi.png' };
const PICKUP_IMAGE = { uri: 'https://i.ibb.co/F4BZBrqm/green.png' };
const DROPOFF_IMAGE = { uri: 'https://i.ibb.co/7JBvx9fp/droppin.png' };

// Validate coordinates to ensure they have valid lat/lng
const isValidCoordinate = (coord) => {
  try {
    return coord &&
      typeof coord === 'object' &&
      'latitude' in coord &&
      'longitude' in coord &&
      typeof coord.latitude === 'number' &&
      typeof coord.longitude === 'number' &&
      !isNaN(coord.latitude) &&
      !isNaN(coord.longitude) &&
      Math.abs(coord.latitude) <= 90 &&
      Math.abs(coord.longitude) <= 180;
  } catch (error) {
    console.error('Error validating coordinates:', error);
    return false;
  }
};

const RideMap = React.memo(({
  mapRef,
  driverCoordinates,
  pickupCoordinates,
  dropCoordinates,
  currentLocation,
  rideStarted,
  mapReady,
  socketConnected,
  handleMapReady,
  openGoogleMapsDirectionsPickup,
  openGoogleMapsDirections,
  pickup_desc,
  drop_desc,
  updateState,
}) => {
  // console.log("Rendering RideMap with enhanced style");

  // Local state
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const markerRefs = useRef({
    driver: null,
    pickup: null,
    dropoff: null
  }).current;

  // Refs to prevent excessive re-renders
  const lastRegionChangeTime = useRef(0);
  const regionChangeThrottle = 100; // milliseconds

  // Use valid coordinates or fallbacks
  const validCurrentLocation = useMemo(() => {
    const result = isValidCoordinate(currentLocation) ? currentLocation :
      isValidCoordinate(driverCoordinates) ? driverCoordinates :
        { latitude: 28.7041, longitude: 77.1025 };

    // console.log('Valid current location:', result);
    return result;
  }, [currentLocation, driverCoordinates]);

  const validPickupCoords = useMemo(() => {
    const result = isValidCoordinate(pickupCoordinates) ? pickupCoordinates :
      { latitude: 28.7041, longitude: 77.1025 };

    // console.log('Valid pickup coords:', result);
    return result;
  }, [pickupCoordinates]);

  const validDropCoords = useMemo(() => {
    const result = isValidCoordinate(dropCoordinates) ? dropCoordinates :
      { latitude: 28.6139, longitude: 77.2090 };

    // console.log('Valid drop coords:', result);
    return result;
  }, [dropCoordinates]);

  // Determine destination based on ride state
  const destination = useMemo(() =>
    rideStarted ? validDropCoords : validPickupCoords,
    [rideStarted, validDropCoords, validPickupCoords]
  );

  // Route color based on ride state
  const routeColor = useMemo(() =>
    rideStarted ? '#FF3B30' : '#4CAF50',
    [rideStarted]
  );

  // Safe map ready handler
  const onMapReady = useCallback(() => {
    try {
      console.log('Map is ready');
      setMapLoaded(true);

      // Fade in map
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Notify parent component
      if (handleMapReady && typeof handleMapReady === 'function') {
        handleMapReady();
      }

      // Fit map to markers after a short delay
      setTimeout(() => {
        fitMapToMarkers();
      }, 1000);
    } catch (error) {
      console.error("Error in map ready handler:", error);
      setMapError("Map initialization error");
    }
  }, [handleMapReady, fadeAnim]);

  // Safely fit map to markers
  const fitMapToMarkers = useCallback(() => {
    try {
      if (mapRef.current && mapLoaded) {
        // Filter out invalid coordinates
        const coordinates = [
          validCurrentLocation,
          ...(isValidCoordinate(validPickupCoords) && !rideStarted ? [validPickupCoords] : []),
          ...(isValidCoordinate(validDropCoords) ? [validDropCoords] : [])
        ].filter(coord => isValidCoordinate(coord));

        if (coordinates.length > 1) {
          console.log('Fitting map to coordinates:', coordinates);

          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 100, bottom: 150, left: 100 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error("Error fitting to coordinates:", error);
      setMapError("Failed to adjust map view");
    }
  }, [mapRef, mapLoaded, validCurrentLocation, validPickupCoords, validDropCoords, rideStarted]);

  // Handle route calculation completion
  const onRouteReady = useCallback((result) => {
    try {
      setIsCalculating(false);
      const { distance, duration, coordinates } = result;

      // Store route coordinates for custom rendering
      setRouteCoordinates(coordinates || []);

      // Format distance and duration
      const formattedDistance = distance.toFixed(1);
      const formattedDuration = Math.round(duration);

      console.log(`Route calculated: ${formattedDistance} km, ${formattedDuration} min`);

      if (updateState && typeof updateState === 'function') {
        updateState({
          distanceToPickup: formattedDistance,
          timeToPickup: formattedDuration,
        });
      }
    } catch (error) {
      console.error("Error processing route data:", error);
    }
  }, [updateState]);

  // Optimized region change handler with throttling
  const onRegionChange = useCallback((region) => {
    const now = Date.now();
    if (now - lastRegionChangeTime.current < regionChangeThrottle) {
      return; // Skip if called too frequently
    }
    lastRegionChangeTime.current = now;


  }, []);

  // Optimized pan drag handler - no state updates
  const onPanDrag = useCallback(() => {

  }, []);

  // Zoom to current location
  const zoomToCurrentLocation = useCallback(() => {
    try {
      if (mapRef.current && isValidCoordinate(validCurrentLocation)) {
        mapRef.current.animateToRegion({
          ...validCurrentLocation,
          latitudeDelta: LATITUDE_DELTA / 2,
          longitudeDelta: LONGITUDE_DELTA / 2,
        }, 500);
      }
    } catch (error) {
      console.error("Error zooming to current location:", error);
    }
  }, [mapRef, validCurrentLocation]);

  // Zoom to destination
  const zoomToDestination = useCallback(() => {
    try {
      if (mapRef.current && isValidCoordinate(destination)) {
        mapRef.current.animateToRegion({
          ...destination,
          latitudeDelta: LATITUDE_DELTA / 2,
          longitudeDelta: LONGITUDE_DELTA / 2,
        }, 500);
      }
    } catch (error) {
      console.error("Error zooming to destination:", error);
    }
  }, [mapRef, destination]);

  // Handle initial region
  const initialRegion = useMemo(() => ({
    ...validCurrentLocation,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  }), [validCurrentLocation]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mapContainer, { opacity: fadeAnim }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          customMapStyle={mapStyle}
          onMapReady={onMapReady}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsTraffic={true}
          showsBuildings={true}
          showsIndoors={false}
          pitchEnabled={true}
          rotateEnabled={true}
          zoomEnabled={true}
          scrollEnabled={true}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          loadingEnabled={true}
          loadingIndicatorColor="#FF3B30"
          loadingBackgroundColor="rgba(255, 255, 255, 0.8)"
          maxZoomLevel={20}
          minZoomLevel={10}
          onRegionChange={onRegionChange}
          onPanDrag={onPanDrag}
          stopPropagation={true}
        >
          {/* Custom Route Polyline */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={5}
              strokeColor={routeColor}
              lineDashPattern={[0]}
              lineCap="round"
              lineJoin="round"
              zIndex={1}
            />
          )}

          {/* Dashed Route Outline */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={8}
              strokeColor="rgba(255, 255, 255, 0.8)"
              lineDashPattern={[1, 8]}
              zIndex={0}
            />
          )}

          {/* Driver/Current Location Marker */}
          {isValidCoordinate(validCurrentLocation) && (
            <Marker
              ref={ref => markerRefs.driver = ref}
              coordinate={validCurrentLocation}
              tracksViewChanges={true}
              onPress={() => {
                if (rideStarted) {
                  openGoogleMapsDirections(validCurrentLocation, dropCoordinates);
                } else {
                  openGoogleMapsDirectionsPickup(validCurrentLocation, pickupCoordinates);
                }
              }}

              zIndex={5}
            >
              <View style={styles.markerContainer}>
                <Image
                  source={CAR_IMAGE}
                  style={styles.carImage}
                  resizeMode="contain"
                />
                {/* <View style={styles.markerPulse} /> */}
              </View>
            </Marker>
          )}

          {/* Pickup Location Marker */}
          {!rideStarted && isValidCoordinate(validPickupCoords) && (
            <Marker
              ref={ref => markerRefs.pickup = ref}
              coordinate={validPickupCoords}
              tracksViewChanges={true}
              zIndex={2}
            >
              <View style={styles.pickupMarkerContainer}>
                <Image
                  source={PICKUP_IMAGE}
                  style={styles.locationImage}
                  resizeMode="contain"
                />
              </View>

              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <RNText style={styles.calloutTitle}>Pickup Location</RNText>
                  <RNText style={styles.calloutDescription}>{pickup_desc}</RNText>
                </View>
              </Callout>
            </Marker>
          )}

          {/* Drop Location Marker */}
          {isValidCoordinate(validDropCoords) && (
            <Marker
              coordinate={validDropCoords}
              tracksViewChanges={true}
              zIndex={3}
            >
              <View style={styles.dropMarkerContainer}>
                <Image
                  source={DROPOFF_IMAGE}
                  style={styles.locationImage}
                  resizeMode="contain"
                />
              </View>

              <Callout tooltip>
                <View style={styles.calloutContainer}>
                  <RNText style={styles.calloutTitle}>Drop Location</RNText>
                  <RNText style={styles.calloutDescription}>{drop_desc}</RNText>
                </View>
              </Callout>
            </Marker>
          )}

          {/* Hidden MapViewDirections for route calculation */}
          {mapReady &&
            isValidCoordinate(validCurrentLocation) &&
            isValidCoordinate(destination) && (
              <MapViewDirections
                origin={validCurrentLocation}
                destination={destination}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={0} // Hidden, we use our own polyline
                mode="DRIVING"
                precision="high"
                timePrecision="now"
                optimizeWaypoints={true}
                onStart={() => {
                  console.log("Route calculation started");
                  setIsCalculating(true);
                }}
                onReady={onRouteReady}
                onError={(error) => {
                  console.error("Directions error: ", error);
                  setIsCalculating(false);
                }}
              />
            )}
        </MapView>
      </Animated.View>


      {/* Connection Status Indicator */}
      {/* <View style={styles.connectionStatus}>
        <View style={[
          styles.connectionIndicator,
          { backgroundColor: socketConnected ? '#4CAF50' : '#F44336' }
        ]}>
          <MaterialIcons
            name={socketConnected ? "wifi" : "wifi-off"}
            size={16}
            color="white"
          />
          <RNText style={styles.connectionText}>
            {socketConnected ? "Connected" : "Disconnected"}
          </RNText>
        </View>
      </View> */}

      {/* Map Controls */}
     <View style={{ 
  flexDirection: 'row', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  position: 'absolute', 
  top: 10, 
  left: 10, 
  right: 10 
}}>
  
  {/* Left side (Pickup/Drop icon) */}
  <View>
    <TouchableOpacity
      style={styles.mapControlButton}
      onPress={openGoogleMapsDirectionsPickup}
    >
      <MaterialIcons name="location-on" size={24} color="#4CAF50" />
    </TouchableOpacity>
  </View>

  {/* Right side (Other icons) */}
  <View style={{ flexDirection: 'row', gap: 10 }}>
    <TouchableOpacity
      style={styles.mapControlButton}
      onPress={zoomToCurrentLocation}
    >
      <MaterialIcons name="my-location" size={24} color="#333" />
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.mapControlButton}
      onPress={zoomToDestination}
    >
      <MaterialIcons name="location-searching" size={24} color="#333" />
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.mapControlButton}
      onPress={openGoogleMapsDirections}
    >
      <MaterialIcons name="flag" size={24} color="#F44336" />
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.mapControlButton}
      onPress={fitMapToMarkers}
    >
      <MaterialIcons name="fit-screen" size={24} color="#333" />
    </TouchableOpacity>
  </View>
</View>


      {/* Loading Indicator */}
      {isCalculating && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FF3B30" />
          <RNText style={styles.loadingText}>Calculating route...</RNText>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {


  },
  pickupMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImage: {
    width: 30,  // smaller than container
    height: 30,
    resizeMode: 'contain',
    position: 'relative',
    zIndex: 10,
  },
  locationImage: {
    width: 36,
    height: 36,
  },
  markerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    top: -5,
    left: -5,
  },
  calloutContainer: {
    width: 160,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  calloutDescription: {
    fontSize: 12,
    color: '#666',
  },
  connectionStatus: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  connectionText: {
    color: 'white',
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    top: 10,
    zIndex: 10,
  },
  mapControlButton: {
    backgroundColor: 'white',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
});

export default RideMap;