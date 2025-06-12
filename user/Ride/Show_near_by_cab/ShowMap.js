import React, { useEffect, useState, useRef, useCallback, useMemo } from "react"
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Animated,
  StatusBar,
  ToastAndroid,
  Vibration,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import Map from "../Map/Map"
import axios from "axios"
import { AntDesign, MaterialIcons, Ionicons, Feather } from "@expo/vector-icons"
import useSettings from "../../hooks/Settings"

const { width, height } = Dimensions.get("window")
const API_BASE_URL = "http://192.168.1.6:3100/api/v1/new/new-price-calculations"

// Haptic feedback utility
const hapticFeedback = () => {
  if (Platform.OS === 'android') {
    Vibration.vibrate(50)
  }
}

// Toast utility for Android
const showToast = (message) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT)
  }
}

export default function ShowMap() {
  // Navigation and route
  const route = useRoute()
  const navigation = useNavigation()

  // State management
  const [loading, setLoading] = useState(true)
  const [selectedRide, setSelectedRide] = useState(null)
  const [vehiclePrices, setVehiclePrices] = useState([])
  const [routeInfo, setRouteInfo] = useState(null)
  const [error, setError] = useState(null)
  const [mapExpanded, setMapExpanded] = useState(false)

  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current
  const mapHeightAnimation = useRef(new Animated.Value(height * 0.35)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  // Settings
  const { settings } = useSettings()

  // Extract data from route params
  const data = route?.params?.data || {}
  const { dropoff, pickup } = data || {}

  const origin = useMemo(() => {
    return pickup?.latitude && pickup?.longitude
      ? { latitude: pickup.latitude, longitude: pickup.longitude }
      : { latitude: 28.7161663, longitude: 77.1240672 }
  }, [pickup])

  const destination = useMemo(() => {
    return dropoff?.latitude && dropoff?.longitude
      ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
      : { latitude: 28.70406, longitude: 77.102493 }
  }, [dropoff])

  // Cleanup function to prevent memory leaks
  const cleanup = useCallback(() => {
    setVehiclePrices([])
    setRouteInfo(null)
    setSelectedRide(null)
    setError(null)
  }, [])

  // Toggle map size with haptic feedback
  const toggleMapSize = useCallback(() => {
    hapticFeedback()
    Animated.timing(mapHeightAnimation, {
      toValue: mapExpanded ? height * 0.35 : height * 0.6,
      duration: 300,
      useNativeDriver: false,
    }).start()
    setMapExpanded(!mapExpanded)
  }, [mapExpanded])

  // Calculate fare using the new API
  const calculateFareTwo = useCallback(async () => {
    if (!origin || !destination) {
      setError("Missing location information")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await axios.post(
        API_BASE_URL,
        {
          origin,
          destination,
          waitingTimeInMinutes: 0,
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )

      if (response.data && response.data.success) {
        setVehiclePrices(response.data.vehiclePrices || [])
        setRouteInfo(response.data.routeInfo || null)

        // Auto-select first vehicle if available
        if (response.data.vehiclePrices?.length > 0) {
          setSelectedRide(response.data.vehiclePrices[0])
        }

        showToast("Rides loaded successfully!")

        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start()
      } else {
        throw new Error("Invalid response format")
      }
    } catch (err) {
      console.error("❌ Error fetching fare:", err?.response?.data?.message || err.message)
      setError("Unable to load rides. Please check your connection and try again.")
      showToast("Failed to load rides")
    } finally {
      setLoading(false)
    }
  }, [origin, destination])

  // Initial load
  useEffect(() => {
    calculateFareTwo()

    // Cleanup on unmount
    return cleanup
  }, [calculateFareTwo, cleanup])

  // Handle ride selection with haptic feedback
  const handleRideSelection = useCallback((ride) => {
    hapticFeedback()
    setSelectedRide(ride)
    showToast(`${ride.vehicleName} selected`)
  }, [])

  // Handle booking
const handleBookNow = useCallback(() => {
  if (!selectedRide) {
    showToast("Please select a ride option");
    console.log("❌ Book Now blocked: No ride selected");
    return;
  }

  hapticFeedback();

  // Log all data before navigating
  console.log("✅ Proceeding to confirm_screen with the following data:");
  console.log("Origin:", origin);
  console.log("Destination:", destination);
  console.log("Selected Ride:", selectedRide);
  console.log("Route Info:", routeInfo);
  console.log("Dropoff:", dropoff);
  console.log("Pickup:", pickup);

  navigation.navigate("confirm_screen", {
    origin,
    destination,
    selectedRide,
    routeInfo,
    dropoff,
    pickup,
  });
}, [selectedRide, navigation, origin, destination, routeInfo, dropoff, pickup]);

  // Format price
  const formatPrice = useCallback((price) => {
    return `₹${Math.round(price)}`
  }, [])

  // Get vehicle icon
  const getVehicleIcon = useCallback((vehicleType) => {
    const icons = {
      'SUV': '🚙',
      'Sedan': '🚗',
      'XL/Prime': '🚘',
      'Auto': '🛺',
      'Bike': '🏍️',
    }
    return icons[vehicleType] || '🚗'
  }, [])

  // Header component
  const Header = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          hapticFeedback()
          navigation.goBack()
        }}
        activeOpacity={0.7}
      >
        <AntDesign name="arrowleft" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Choose Your Ride</Text>
      <TouchableOpacity style={styles.notificationButton} activeOpacity={0.7}>
        <Ionicons name="notifications-outline" size={22} color="#000" />
      </TouchableOpacity>
    </View>
  ), [navigation])

  // Map controls component
  const MapControls = useCallback(() => (
    <View style={styles.mapControls}>
      <TouchableOpacity
        style={styles.mapControlButton}
        onPress={toggleMapSize}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name={mapExpanded ? "fullscreen-exit" : "fullscreen"}
          size={22}
          color="#000"
        />
      </TouchableOpacity>
    </View>
  ), [mapExpanded, toggleMapSize])

  // Location section component
  const LocationSection = useCallback(() => (
    <View style={styles.locationContainer}>
      <View style={styles.locationItem}>
        <View style={styles.greenDot} />
        <Text style={styles.locationText} numberOfLines={1}>
          {pickup?.description || "Current Location"}
        </Text>
        <View style={styles.timeBox}>
          <MaterialIcons name="access-time" size={12} color="#666" />
          <Text style={styles.timeText}>Now</Text>
        </View>
      </View>

      <View style={styles.locationDivider} />

      <View style={styles.locationItem}>
        <View style={styles.redDot} />
        <Text style={styles.locationText} numberOfLines={1}>
          {dropoff?.description || "Destination"}
        </Text>
        <View style={styles.distanceBox}>
          <MaterialIcons name="directions" size={12} color="#666" />
          <Text style={styles.timeText}>
            {routeInfo ? `${routeInfo.distanceInKm.toFixed(1)} km` : "Calculating..."}
          </Text>
        </View>
      </View>

      {/* Route info */}
      {routeInfo && (
        <View style={styles.routeInfoContainer}>
          <View style={styles.routeInfoItem}>
            <Feather name="clock" size={14} color="#666" />
            <Text style={styles.routeInfoText}>
              {Math.round(routeInfo.durationInMinutes)} min
            </Text>
          </View>

          {routeInfo.conditions?.isNightTime && (
            <View style={styles.conditionBadge}>
              <Ionicons name="moon" size={12} color="#4A90E2" />
              <Text style={styles.conditionText}>Night</Text>
            </View>
          )}

          {routeInfo.conditions?.rain && (
            <View style={styles.conditionBadge}>
              <Ionicons name="rainy" size={12} color="#2196F3" />
              <Text style={styles.conditionText}>Rain</Text>
            </View>
          )}
        </View>
      )}
    </View>
  ), [pickup, dropoff, routeInfo])

  // Ride option component
  const RideOption = useCallback(({ ride }) => {
    const isSelected = selectedRide?.vehicleId === ride.vehicleId
    const scaleAnim = useRef(new Animated.Value(1)).current

    useEffect(() => {
      if (isSelected) {
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          })
        ]).start()
      }
    }, [isSelected, scaleAnim])

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.rideOption, isSelected && styles.selectedRide]}
          onPress={() => handleRideSelection(ride)}
          activeOpacity={0.8}
        >
          <View style={styles.rideLeft}>
            {ride.vehicleImage && ride.vehicleImage.startsWith('https') ? (
              <Image
                source={{ uri: ride.vehicleImage }}
                style={[styles.rideIconContainer, isSelected && styles.selectedRideIcon]}
                resizeMode="contain"
              />
            ) : (
              <View style={[styles.rideIconContainer, isSelected && styles.selectedRideIcon]}>
                <Text style={styles.rideIcon}>{getVehicleIcon(ride.vehicleType)}</Text>
              </View>
            )}



            <View style={styles.rideInfo}>
              <Text style={styles.rideName}>{ride.vehicleName}</Text>
              <Text style={styles.rideDescription}>
                {ride.vehicleType} • {Math.round(ride.durationInMinutes)} min
              </Text>

              {/* Pricing breakdown */}
              <View style={styles.pricingDetails}>




                {ride.conditions?.rain && (
                  <View style={styles.surchargeItem}>
                    <Ionicons name="rainy" size={12} color="#2196F3" />
                    <Text style={styles.surchargeText}>Rain surcharge</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.rideRight}>
            <Text style={styles.ridePrice}>{formatPrice(ride.totalPrice)}</Text>
            <View style={[styles.selectIndicator, isSelected && styles.selectedIndicator]}>
              {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    )
  }, [selectedRide, handleRideSelection, getVehicleIcon, formatPrice])

  // Loading screen component
  const LoadingScreen = useCallback(() => (
    <View style={styles.loadingContainer}>
      <View style={styles.loaderCard}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Finding the best rides for you...</Text>
        <Text style={styles.loadingSubText}>This may take a few seconds</Text>
      </View>
    </View>
  ), [])

  // Error screen component
  const ErrorScreen = useCallback(() => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => {
          hapticFeedback()
          calculateFareTwo()
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  ), [error, calculateFareTwo])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Header />
        <LoadingScreen />
      </SafeAreaView>
    )
  }

  if (error && vehiclePrices.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Header />
        <ErrorScreen />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Header />

      <Animated.View style={[styles.mapWrapper, { height: mapHeightAnimation }]}>
        <Map
          isFakeRiderShow={true}
          origin={origin}
          destination={destination}
          useRealDriverIcons={true}
        />
        <MapControls />
      </Animated.View>

      <Animated.View
        style={[
          styles.contentWrapper,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: scrollY.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, -20],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView
          style={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}

        >
          <LocationSection />

          <View style={styles.ridesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Rides</Text>
              <Text style={styles.sectionSubtitle}>
                {vehiclePrices.length} option{vehiclePrices.length !== 1 ? 's' : ''} found
              </Text>
            </View>

            {vehiclePrices.map((ride) => (
              <RideOption key={ride.vehicleId} ride={ride} />
            ))}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>

      {/* Book button */}
      <View style={styles.bookButtonContainer}>
        <TouchableOpacity
          onPress={handleBookNow}
          style={[styles.bookButton, !selectedRide && styles.disabledButton]}
          activeOpacity={0.9}
          disabled={!selectedRide}
        >
          <Text style={styles.bookButtonText}>
            {selectedRide
              ? `Book ${selectedRide.vehicleName} • ${formatPrice(selectedRide.totalPrice)}`
              : "Select a Ride"
            }
          </Text>
          <AntDesign name="arrowright" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
  },
  notificationButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
  },
  mapWrapper: {
    height: height * 0.35,
    backgroundColor: "#f0f0f0",
    position: 'relative',
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  mapControlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  contentWrapper: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    backgroundColor: "#fff",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  contentContainer: {
    flex: 1,
  },
  locationContainer: {
    margin: 16,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  locationDivider: {
    height: 20,
    width: 2,
    backgroundColor: "#ddd",
    marginLeft: 4,
    borderRadius: 1,
  },
  greenDot: {
    width: 12,
    height: 12,
    backgroundColor: "#4CAF50",
    borderRadius: 6,
    marginRight: 12,
  },
  redDot: {
    width: 12,
    height: 12,
    backgroundColor: "#F44336",
    borderRadius: 6,
    marginRight: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  timeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  distanceBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3e0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  timeText: {
    fontSize: 12,
    marginLeft: 4,
    color: "#666",
    fontWeight: "500",
  },
  routeInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  routeInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  routeInfoText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
    fontWeight: "500",
  },
  conditionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  conditionText: {
    fontSize: 11,
    color: "#1976d2",
    marginLeft: 4,
    fontWeight: "500",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  ridesSection: {
    flex: 1,
  },
  rideOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#fbfbfb",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  selectedRide: {
    backgroundColor: "#f0f8ff",
    borderColor: "#1976d2",
    borderWidth: 2,
  },
  rideLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rideIconContainer: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 24,
    marginRight: 12,
  },
  selectedRideIcon: {
    backgroundColor: "#e3f2fd",
  },
  rideIcon: {
    fontSize: 24,
  },
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  rideDescription: {
    color: "#666",
    fontSize: 14,
    marginTop: 2,
  },
  pricingDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  surchargeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  surchargeText: {
    fontSize: 11,
    color: "#666",
    marginLeft: 4,
    fontWeight: "500",
  },
  rideRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  ridePrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  selectIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedIndicator: {
    borderColor: "#1976d2",
    backgroundColor: "#1976d2",
  },
  bookButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  bookButton: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  bookButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loaderCard: {
    backgroundColor: "#fff",
    padding: 32,
    borderRadius: 20,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
    width: width * 0.8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    textAlign: "center",
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#1976d2",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
})