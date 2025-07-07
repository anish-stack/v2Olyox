"use client"

import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react"
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
import { useRideSearching } from "../../context/ride_searching"

const { width, height } = Dimensions.get("window")
const API_BASE_URL = "https://www.appv2.olyox.com/api/v1/new/new-price-calculations"

// Haptic feedback utility
const hapticFeedback = () => {
  if (Platform.OS === "android") {
    Vibration.vibrate(50)
  }
}

// Toast utility for Android
const showToast = (message) => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT)
  }
}

// Memoized Header Component
const Header = memo(({ onBack }) => (
  <View style={styles.header}>
    <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
      <AntDesign name="arrowleft" size={24} color="#000" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Choose Your Ride</Text>
    <TouchableOpacity style={styles.notificationButton} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={22} color="#000" />
    </TouchableOpacity>
  </View>
))

// Memoized Map Controls Component
const MapControls = memo(({ mapExpanded, onToggle }) => (
  <View style={styles.mapControls}>
    <TouchableOpacity style={styles.mapControlButton} onPress={onToggle} activeOpacity={0.7}>
      <MaterialIcons name={mapExpanded ? "fullscreen-exit" : "fullscreen"} size={22} color="#000" />
    </TouchableOpacity>
  </View>
))

// Memoized Location Section Component
const LocationSection = memo(({ pickup, dropoff, routeInfo }) => (
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
        <Text style={styles.timeText}>{routeInfo ? `${routeInfo.distanceInKm.toFixed(1)} km` : "Calculating..."}</Text>
      </View>
    </View>
    {routeInfo && (
      <View style={styles.routeInfoContainer}>
        <View style={styles.routeInfoItem}>
          <Feather name="clock" size={14} color="#666" />
          <Text style={styles.routeInfoText}>{Math.round(routeInfo.durationInMinutes)} min</Text>
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
))

// Memoized Ride Option Component
const RideOption = memo(({ ride, isSelected, onSelect, formatPrice, getVehicleIcon, settings }) => {
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
        }),
      ]).start()
    }
  }, [isSelected, scaleAnim])

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.rideOption, isSelected && styles.selectedRide]}
        onPress={() => onSelect(ride)}
        activeOpacity={0.8}
      >
        <View style={styles.rideLeft}>
          {ride.vehicleImage && ride.vehicleImage.startsWith("https") ? (
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
            {ride.conditions?.rain && (
              <View style={styles.pricingDetails}>
                <View style={styles.surchargeItem}>
                  <Ionicons name="rainy" size={12} color="#2196F3" />
                  <Text style={styles.surchargeText}>Rain surcharge</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={styles.rideRight}>
          {ride?.totalPrice && settings?.ride_percentage_off && (
            <Text style={styles.originalPrice}>
              {formatPrice(ride.totalPrice * (1 + Number(settings.ride_percentage_off) / 100))}
            </Text>
          )}
          <Text style={styles.ridePrice}>{formatPrice(ride.totalPrice)}</Text>
          <View style={[styles.selectIndicator, isSelected && styles.selectedIndicator]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
})

// Memoized Searching Status Component
const SearchingStatus = memo(({ currentRide, onViewRide }) => (
  <View style={styles.searchingContainer}>
    <View style={styles.searchingCard}>
      <View style={styles.searchingHeader}>
        <ActivityIndicator size="small" color="#1976d2" />
        <Text style={styles.searchingTitle}>Finding your ride...</Text>
      </View>
      <Text style={styles.searchingSubtitle}>We're connecting you with a {currentRide?.vehicleName || "driver"}</Text>
      <TouchableOpacity style={styles.viewRideButton} onPress={onViewRide} activeOpacity={0.8}>
        <Text style={styles.viewRideButtonText}>View Ride</Text>
        <AntDesign name="arrowright" size={16} color="#1976d2" />
      </TouchableOpacity>
    </View>
  </View>
))

// Memoized Loading Screen Component
const LoadingScreen = memo(() => (
  <View style={styles.loadingContainer}>
    <View style={styles.loaderCard}>
      <ActivityIndicator size="large" color="#000" />
      <Text style={styles.loadingText}>Finding the best rides for you...</Text>
      <Text style={styles.loadingSubText}>This may take a few seconds</Text>
    </View>
  </View>
))

// Memoized Error Screen Component
const ErrorScreen = memo(({ error, onRetry }) => (
  <View style={styles.errorContainer}>
    <Ionicons name="alert-circle-outline" size={48} color="#F44336" />
    <Text style={styles.errorText}>{error}</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
      <Text style={styles.retryButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
))

export default function ShowMap() {
  const { currentRide, rideStatus } = useRideSearching()
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

  // Extract data from route params - memoized
  const routeData = useMemo(() => {
    const data = route?.params?.data || {}
    return {
      dropoff: data.dropoff,
      pickup: data.pickup,
    }
  }, [route?.params?.data])

  const { dropoff, pickup } = routeData

  // Memoized coordinates
  const coordinates = useMemo(() => {
    const origin =
      pickup?.latitude && pickup?.longitude
        ? { latitude: pickup.latitude, longitude: pickup.longitude }
        : { latitude: 28.7161663, longitude: 77.1240672 }

    const destination =
      dropoff?.latitude && dropoff?.longitude
        ? { latitude: dropoff.latitude, longitude: dropoff.longitude }
        : { latitude: 28.70406, longitude: 77.102493 }

    return { origin, destination }
  }, [pickup, dropoff])

  const { origin, destination } = coordinates

  // Check if ride is being searched
  const isRideSearching = useMemo(() => {
    return currentRide && (rideStatus === "searching" || rideStatus === "pending")
  }, [currentRide, rideStatus])

  // Memoized utility functions
  const formatPrice = useCallback((price) => {
    return `₹${Math.round(price)}`
  }, [])

  const getVehicleIcon = useCallback((vehicleType) => {
    const icons = {
      SUV: "🚙",
      Sedan: "🚗",
      "XL/Prime": "🚘",
      Auto: "🛺",
      Bike: "🏍️",
    }
    return icons[vehicleType] || "🚗"
  }, [])

  // Memoized handlers
  const handleBack = useCallback(() => {
    hapticFeedback()
    navigation.goBack()
  }, [navigation])

  const toggleMapSize = useCallback(() => {
    hapticFeedback()
    Animated.timing(mapHeightAnimation, {
      toValue: mapExpanded ? height * 0.35 : height * 0.6,
      duration: 300,
      useNativeDriver: false,
    }).start()
    setMapExpanded(!mapExpanded)
  }, [mapExpanded, mapHeightAnimation])

  const handleRideSelection = useCallback((ride) => {
    hapticFeedback()
    setSelectedRide(ride)
    showToast(`${ride.vehicleName} selected`)
  }, [])

  const handleViewRide = useCallback(() => {
    hapticFeedback()
    // Navigate to current ride view
    navigation.navigate("current_ride_screen")
  }, [navigation])

  // Calculate fare using the new API - memoized
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
            "Content-Type": "application/json",
          },
        },
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
  }, [origin, destination, fadeAnim])

  const handleRetry = useCallback(() => {
    hapticFeedback()
    calculateFareTwo()
  }, [calculateFareTwo])

  // Handle booking - memoized
  const handleBookNow = useCallback(() => {
    if (!selectedRide) {
      showToast("Please select a ride option")
      console.log("❌ Book Now blocked: No ride selected")
      return
    }

    if (isRideSearching) {
      showToast("Please wait, your current ride is being processed")
      return
    }

    hapticFeedback()
    navigation.navigate("confirm_screen", {
      origin,
      destination,
      selectedRide,
      routeInfo,
      dropoff,
      pickup,
    })
  }, [selectedRide, navigation, origin, destination, routeInfo, dropoff, pickup, isRideSearching])

  // Initial load effect
  useEffect(() => {
    calculateFareTwo()
  }, [calculateFareTwo])

  // Cleanup effect
  useEffect(() => {
    return () => {
      setVehiclePrices([])
      setRouteInfo(null)
      setSelectedRide(null)
      setError(null)
    }
  }, [])

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Header onBack={handleBack} />
        <LoadingScreen />
      </SafeAreaView>
    )
  }

  if (error && vehiclePrices.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <Header onBack={handleBack} />
        <ErrorScreen error={error} onRetry={handleRetry} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Header onBack={handleBack} />

      <Animated.View style={[styles.mapWrapper, { height: mapHeightAnimation }]}>
        <Map isFakeRiderShow={true} origin={origin} destination={destination} useRealDriverIcons={true} />
        <MapControls mapExpanded={mapExpanded} onToggle={toggleMapSize} />
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
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false} scrollEventThrottle={16}>
          <LocationSection pickup={pickup} dropoff={dropoff} routeInfo={routeInfo} />

          {isRideSearching && <SearchingStatus currentRide={currentRide} onViewRide={handleViewRide} />}

          <View style={styles.ridesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Rides</Text>
              <Text style={styles.sectionSubtitle}>
                {vehiclePrices.length} option{vehiclePrices.length !== 1 ? "s" : ""} found
              </Text>
            </View>
            {vehiclePrices.map((ride) => (
              <RideOption
                key={ride.vehicleId}
                ride={ride}
                isSelected={selectedRide?.vehicleId === ride.vehicleId}
                onSelect={handleRideSelection}
                formatPrice={formatPrice}
                getVehicleIcon={getVehicleIcon}
                settings={settings}
              />
            ))}
          </View>
          <View style={{ height: 120 }} />
        </ScrollView>
      </Animated.View>

      {/* Book button */}
      <View style={styles.bookButtonContainer}>
        <TouchableOpacity
          onPress={handleBookNow}
          style={[styles.bookButton, (!selectedRide || isRideSearching) && styles.disabledButton]}
          activeOpacity={0.9}
          disabled={!selectedRide || isRideSearching}
        >
          <Text style={styles.bookButtonText}>
            {isRideSearching
              ? "Ride in Progress..."
              : selectedRide
                ? `Book ${selectedRide.vehicleName} • ${formatPrice(selectedRide.totalPrice)}`
                : "Select a Ride"}
          </Text>
          {!isRideSearching && <AntDesign name="arrowright" size={20} color="#fff" />}
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
    borderBottomColor: "#f5f5f5",
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
    position: "relative",
  },
  mapControls: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 4,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  contentWrapper: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    backgroundColor: "#fff",
  },
  contentContainer: {
    flex: 1,
  },
  locationContainer: {
    margin: 16,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 16,
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
  searchingContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  searchingCard: {
    backgroundColor: "#f0f8ff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3f2fd",
  },
  searchingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  searchingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1976d2",
    marginLeft: 12,
  },
  searchingSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  viewRideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1976d2",
  },
  viewRideButtonText: {
    color: "#1976d2",
    fontWeight: "600",
    marginRight: 8,
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
  originalPrice: {
    fontSize: 14,
    color: "#888",
    textDecorationLine: "line-through",
  },
})
