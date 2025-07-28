"use client"

import { useMemo, useEffect, useState, useRef, useCallback } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native"
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Polyline } from "react-native-maps"
import MapViewDirections from "react-native-maps-directions"
import * as Notifications from "expo-notifications"
import { Ionicons } from "@expo/vector-icons"

const GOOGLE_MAPS_APIKEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8"
const LATITUDE_DELTA = 0.015
const LONGITUDE_DELTA = 0.015
const REACH_THRESHOLD = 100
const NEARBY_THRESHOLD = 200
const DRIVER_LOCATION_UPDATE_INTERVAL = 5000 // 5 seconds

const DEFAULT_COORDINATES = {
  latitude: 40.7128,
  longitude: -74.006,
}

// Enhanced distance formatting function
const formatDistance = (distanceInMeters) => {
  if (!distanceInMeters || distanceInMeters <= 0) return "0m"
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`
  } else {
    const km = distanceInMeters / 1000
    return `${km.toFixed(1)}km`
  }
}

// Enhanced ETA calculation
const calculateETA = (distanceInMeters) => {
  if (!distanceInMeters || distanceInMeters <= 0) return "0 min"
  const averageSpeedKmh = distanceInMeters < 5000 ? 30 : 50
  const averageSpeedMs = (averageSpeedKmh * 1000) / 3600
  const etaSeconds = distanceInMeters / averageSpeedMs
  const etaMinutes = Math.ceil(etaSeconds / 60)

  if (etaMinutes < 60) {
    return `${etaMinutes} min`
  } else {
    const hours = Math.floor(etaMinutes / 60)
    const remainingMinutes = etaMinutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
}

const CarIcon = ({ color = "#2196F3", size = 35, isNearby = false }) => (
  <View style={[styles.carIconContainer, { width: size, height: size }, isNearby && styles.nearbyCarIcon]}>
    <Ionicons name="car" size={size * 0.6} color={color} />
    {isNearby && (
      <View style={styles.pulseRing}>
        <Animated.View style={[styles.pulse, { backgroundColor: color + "20" }]} />
      </View>
    )}
  </View>
)

const PersonIcon = ({ color = "#4CAF50", size = 35, isNearby = false }) => (
  <View style={[styles.personIconContainer, { width: size, height: size }, isNearby && styles.nearbyPersonIcon]}>
    <Ionicons name="person" size={size * 0.6} color={color} />
    {isNearby && (
      <View style={styles.pulseRing}>
        <Animated.View style={[styles.pulse, { backgroundColor: color + "20" }]} />
      </View>
    )}
  </View>
)

const DropOffIcon = ({ size = 40 }) => (
  <View style={[styles.dropIconContainer, { width: size, height: size }]}>
    <Ionicons name="location" size={size * 0.8} color="#FF6B35" />
    <View style={styles.dropIconShadow} />
  </View>
)

export default function NewUserAndDriverMap({
  pickupLocation,
  DropLocation,
  rideStatus,
  driver,
  routeCoordinates = [],
}) {

  const mapRef = useRef(null)
  const [notified, setNotified] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [driverDistance, setDriverDistance] = useState(null)
  const [directionsError, setDirectionsError] = useState(false)
  const [routeCoords, setRouteCoords] = useState([])
  const [driverLocation, setDriverLocation] = useState(null)
  const [mapRegion, setMapRegion] = useState(null)
  const [userScaled, setUserScaled] = useState(false)

  const pulseAnim = useRef(new Animated.Value(0)).current
  const driverUpdateTimer = useRef(null)
  const lastUpdateTime = useRef(Date.now())
  const isMounted = useRef(true)

  // Platform detection
  const isAndroid = Platform.OS === "android"
  const mapProvider = isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT

  // Safe coordinate extraction with defaults
  const getSafeCoordinates = useCallback((location, type = "object") => {
    try {
      if (!location) return null

      if (type === "array") {
        if (Array.isArray(location) && location.length >= 2) {
          const lat = Number.parseFloat(location[1])
          const lng = Number.parseFloat(location[0])
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng }
          }
        }
      } else if (type === "coords") {
        if (typeof location === "object" && location?.coords) {
          const lat = Number.parseFloat(location.coords.latitude)
          const lng = Number.parseFloat(location.coords.longitude)
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng }
          }
        }
      } else if (type === "api") {
        if (typeof location === "object" && location?.lat && location?.lng) {
          const lat = Number.parseFloat(location.lat)
          const lng = Number.parseFloat(location.lng)
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng }
          }
        }
      } else {
        if (typeof location === "object" && location?.latitude && location?.longitude) {
          const lat = Number.parseFloat(location.latitude)
          const lng = Number.parseFloat(location.longitude)
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng }
          }
        }
      }
      return null
    } catch (error) {
      console.error("Error processing coordinates:", error)
      return null
    }
  }, [])

  // Fetch driver location from API
  const fetchDriverLocation = useCallback(async () => {
    if (!driver?._id || !isMounted.current) return

    try {
      const response = await fetch(`https://appv2.olyox.com/driver/${driver._id}/location`)
      const data = await response.json()
      console.log("Driver location fetched:", data)
      if (data.success && data.riders && isMounted.current) {
        const newDriverCoords = getSafeCoordinates(data.riders.location, "api")
        if (newDriverCoords) {
          setDriverLocation(newDriverCoords)
          lastUpdateTime.current = Date.now()
        }
      }
    } catch (error) {
      console.error("Error fetching driver location:", error)
    }
  }, [driver?._id, getSafeCoordinates])

  // Setup driver location updates
  useEffect(() => {
    if (!driver?._id || rideStatus === "completed") return

    // Initial fetch
    fetchDriverLocation()

    // Setup interval for updates
    driverUpdateTimer.current = setInterval(() => {
      if (isMounted.current) {
        fetchDriverLocation()
      }
    }, DRIVER_LOCATION_UPDATE_INTERVAL)

    return () => {
      if (driverUpdateTimer.current) {
        clearInterval(driverUpdateTimer.current)
        driverUpdateTimer.current = null
      }
    }
  }, [driver?._id, rideStatus, fetchDriverLocation])

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (driverUpdateTimer.current) {
        clearInterval(driverUpdateTimer.current)
      }
    }
  }, [])


  const pickupCoords = getSafeCoordinates(pickupLocation, "array") || DEFAULT_COORDINATES

  const dropCoords = getSafeCoordinates(DropLocation, "array")
  const currentDriverCoords = driverLocation || getSafeCoordinates(pickupLocation, "array") || DEFAULT_COORDINATES

  const getDistance = useCallback((lat1, lon1, lat2, lon2) => {
    try {
      const toRad = (value) => (value * Math.PI) / 180
      const R = 6371e3 // Earth radius in meters
      const φ1 = toRad(lat1)
      const φ2 = toRad(lat2)
      const Δφ = toRad(lat2 - lat1)
      const Δλ = toRad(lon2 - lon1)
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    } catch (error) {
      console.error("Error calculating distance:", error)
      return 0
    }
  }, [])

  // Calculate offset for nearby markers to prevent overlap
  const getMarkerOffset = useCallback((distance, isDriver = false) => {
    if (!distance || distance > NEARBY_THRESHOLD) return { x: 0, y: 0 }
    const offsetDistance = 0.0001
    return isDriver ? { x: -offsetDistance, y: offsetDistance } : { x: offsetDistance, y: -offsetDistance }
  }, [])

  // Fit to markers function with scale preservation
  const fitToMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady) return

    try {
      const coordinates = []

      if (pickupCoords && pickupCoords.latitude !== DEFAULT_COORDINATES.latitude) {
        coordinates.push(pickupCoords)
      }
      if (currentDriverCoords && currentDriverCoords.latitude !== DEFAULT_COORDINATES.latitude && driverLocation) {
        coordinates.push(currentDriverCoords)
      }
      if (dropCoords && dropCoords.latitude !== DEFAULT_COORDINATES.latitude) {
        coordinates.push(dropCoords)
      }

      if (coordinates.length > 1 && !userScaled) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 250, left: 100 },
          animated: true,
        })
      } else if (coordinates.length === 1 && !userScaled) {
        mapRef.current.animateToRegion(
          {
            ...coordinates[0],
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          },
          1000,
        )
      }
    } catch (error) {
      console.error("Error fitting to markers:", error)
    }
  }, [mapReady, pickupCoords, currentDriverCoords, dropCoords, driverLocation, userScaled])

  // Calculate distance and update state
  useEffect(() => {
    if (currentDriverCoords && pickupCoords && driverLocation) {
      const distance = getDistance(
        pickupCoords.latitude,
        pickupCoords.longitude,
        currentDriverCoords.latitude,
        currentDriverCoords.longitude,
      )
      setDriverDistance(distance)

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
          ]),
        )
        animation.start()
        return () => animation.stop()
      }
    }
  }, [currentDriverCoords, pickupCoords, driverLocation, getDistance, pulseAnim])

  // Auto-fit map when driver location changes (only if user hasn't scaled)
  useEffect(() => {
    if (mapReady && driverLocation && !userScaled) {
      const timer = setTimeout(() => {
        fitToMarkers()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [mapReady, driverLocation, fitToMarkers, userScaled])

  // Enhanced notification logic
  useEffect(() => {
    if (
      typeof driverDistance === "number" &&
      driverDistance > 0 &&
      driverDistance < REACH_THRESHOLD &&
      !notified &&
      rideStatus !== "in_progress" &&
      rideStatus !== "completed"
    ) {
      try {
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Driver Nearby!",
            body: `Your driver is ${formatDistance(driverDistance)} away and approaching.`,
          },
          trigger: null,
        })
        setNotified(true)
      } catch (error) {
        console.error("Error scheduling notification:", error)
      }
    }
  }, [driverDistance, notified, rideStatus])

  // Enhanced directions error handling
  const handleDirectionsError = useCallback((errorMessage) => {
    console.warn("MapViewDirections Error:", errorMessage)
    setDirectionsError(true)
    setTimeout(() => setDirectionsError(false), 5000)
  }, [])

  // Enhanced directions ready handler
  const handleDirectionsReady = useCallback((result, routeType) => {
    console.log(`${routeType} route calculated - Distance: ${result.distance}km, Duration: ${result.duration}min`)
    if (result.coordinates && result.coordinates.length > 0) {
      setRouteCoords(result.coordinates)
    }
  }, [])

  // Handle map region change to detect user scaling
  const handleRegionChangeComplete = useCallback(
    (region) => {
      if (mapReady) {
        setMapRegion(region)
        // Detect if user manually changed the region
        const deltaThreshold = 0.005
        if (
          Math.abs(region.latitudeDelta - LATITUDE_DELTA) > deltaThreshold ||
          Math.abs(region.longitudeDelta - LONGITUDE_DELTA) > deltaThreshold
        ) {
          setUserScaled(true)
        }
      }
    },
    [mapReady],
  )

  // Enhanced iOS route coordinates processing
  const processedRouteCoords = useMemo(() => {
    if (isAndroid) return []
    const coords = routeCoordinates.length > 0 ? routeCoordinates : routeCoords
    if (coords.length === 0 && currentDriverCoords && pickupCoords && driverLocation) {
      return [currentDriverCoords, pickupCoords]
    }
    return coords
  }, [isAndroid, routeCoordinates, routeCoords, currentDriverCoords, pickupCoords, driverLocation])

  const isDriverNearby = driverDistance && driverDistance < NEARBY_THRESHOLD
  const driverOffset = getMarkerOffset(driverDistance || 0, true)
  const pickupOffset = getMarkerOffset(driverDistance || 0, false)

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={mapProvider}
        style={styles.map}
        initialRegion={{
          latitude: pickupCoords.latitude,
          longitude: pickupCoords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
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
        {/* Pickup Location Marker */}
        {pickupCoords && (
          <Marker
            coordinate={{
              latitude: pickupCoords.latitude + (isDriverNearby ? pickupOffset.x : 0),
              longitude: pickupCoords.longitude + (isDriverNearby ? pickupOffset.y : 0),
            }}
            title="Pickup Location"
            description="Your pickup point"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <PersonIcon color="#4CAF50" size={35} isNearby={isDriverNearby} />
          </Marker>
        )}

        {/* Driver Location Marker */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: currentDriverCoords.latitude + (isDriverNearby ? driverOffset.x : 0),
              longitude: currentDriverCoords.longitude + (isDriverNearby ? driverOffset.y : 0),
            }}
            title="Driver"
            description={`${formatDistance(driverDistance || 0)} away`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <CarIcon color="#2196F3" size={35} isNearby={isDriverNearby} />
          </Marker>
        )}

        {/* Drop Location Marker */}
        {dropCoords && (
          <Marker coordinate={dropCoords} title="Drop Location" description="Destination" anchor={{ x: 0.5, y: 1 }}>
            <DropOffIcon size={40} />
          </Marker>
        )}

        {/* Enhanced Route Rendering */}
        {isAndroid ? (
          <>
            {/* Route from driver to pickup - Android */}
            {driverLocation && pickupCoords && rideStatus === "driver_assigned" && !directionsError && (
              <MapViewDirections
                origin={currentDriverCoords}
                destination={pickupCoords}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#2196F3"
                optimizeWaypoints={true}
                mode="DRIVING"
                onError={handleDirectionsError}
                onReady={(result) => handleDirectionsReady(result, "Driver to Pickup")}
              />
            )}
            {/* Route from pickup to drop location - Android */}
            {pickupCoords && dropCoords && rideStatus === "in_progress" && !directionsError && (
              <MapViewDirections
                origin={pickupCoords}
                destination={dropCoords}
                apikey={GOOGLE_MAPS_APIKEY}
                strokeWidth={4}
                strokeColor="#FF6B35"
                optimizeWaypoints={true}
                mode="DRIVING"
                onError={handleDirectionsError}
                onReady={(result) => handleDirectionsReady(result, "Pickup to Drop")}
              />
            )}
          </>
        ) : (
          <>
            {/* Enhanced iOS Polyline rendering */}
            {processedRouteCoords.length > 0 && (
              <Polyline
                coordinates={processedRouteCoords}
                strokeWidth={4}
                strokeColor={rideStatus === "driver_assigned" ? "#2196F3" : "#FF6B35"}
                lineDashPattern={[0]}
                lineJoin="round"
                lineCap="round"
              />
            )}
            {/* Additional route for drop location on iOS */}
            {rideStatus === "in_progress" && pickupCoords && dropCoords && (
              <Polyline
                coordinates={[pickupCoords, dropCoords]}
                strokeWidth={4}
                strokeColor="#FF6B35"
                lineDashPattern={[5, 5]}
                lineJoin="round"
                lineCap="round"
              />
            )}
          </>
        )}
      </MapView>

      {/* Enhanced Error indicator */}
      {directionsError && (
        <View style={styles.errorIndicator}>
          <Ionicons name="warning" size={16} color="#fff" />
          <Text style={styles.errorText}>Route calculation failed. Retrying...</Text>
        </View>
      )}

      {/* Driver update indicator */}
      <View style={styles.updateIndicator}>
        <Ionicons name="refresh" size={12} color="#666" />
        <Text style={styles.updateText}>
          Driver location: {Math.round((Date.now() - lastUpdateTime.current) / 1000)}s ago
        </Text>
      </View>

      {/* Enhanced Control Buttons */}
      <View style={styles.controlButtons}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setUserScaled(false)
            fitToMarkers()
          }}
        >
          <Ionicons name="locate" size={24} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            console.log("Manual refresh triggered")
            setDirectionsError(false)
            setNotified(false)
            fetchDriverLocation()
          }}
        >
          <Ionicons name="refresh" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Enhanced Distance Card */}
      {driverDistance && driverDistance > 0 && (
        <View style={styles.distanceCard}>
          <View style={styles.distanceInfo}>
            <Ionicons name="car" size={20} color="#2196F3" />
            <Text style={styles.distanceMainText}>{formatDistance(driverDistance)}</Text>
            <Text style={styles.distanceSubText}>away</Text>
          </View>
          <View style={styles.etaInfo}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.etaText}>ETA: {calculateETA(driverDistance)}</Text>
          </View>
          {isDriverNearby && (
            <View style={styles.nearbyAlert}>
              <Ionicons name="alert-circle" size={16} color="#FF6B35" />
              <Text style={styles.nearbyText}>Driver is nearby!</Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  map: {
    flex: 1,
  },
  carIconContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
    borderColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  nearbyCarIcon: {
    backgroundColor: "#E3F2FD",
    borderColor: "#1976D2",
    borderWidth: 3,
  },
  personIconContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 2,
    borderColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
  },
  nearbyPersonIcon: {
    backgroundColor: "#E8F5E8",
    borderColor: "#388E3C",
    borderWidth: 3,
  },
  dropIconContainer: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 5,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    justifyContent: "center",
    alignItems: "center",
  },
  dropIconShadow: {
    position: "absolute",
    bottom: -5,
    left: "50%",
    marginLeft: -8,
    width: 16,
    height: 8,
    backgroundColor: "#00000020",
    borderRadius: 8,
  },
  pulseRing: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  pulse: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    opacity: 0.6,
  },
  errorIndicator: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "#ff4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 8,
    textAlign: "center",
  },
  updateIndicator: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.8,
  },
  updateText: {
    color: "#666",
    fontSize: 10,
    marginLeft: 4,
  },
  controlButtons: {
    position: "absolute",
    right: 20,
    bottom: 180,
    flexDirection: "column",
  },
  controlButton: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 12,
    marginBottom: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  distanceCard: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  distanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  distanceMainText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2196F3",
    marginLeft: 8,
    marginRight: 4,
  },
  distanceSubText: {
    fontSize: 16,
    color: "#666",
  },
  etaInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  etaText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  nearbyAlert: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  nearbyText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "600",
    marginLeft: 4,
  },
})
