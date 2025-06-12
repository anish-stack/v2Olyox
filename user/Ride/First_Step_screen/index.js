import { useState, useEffect, useRef } from "react"
import { View, StatusBar, Text, Keyboard } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Location from "expo-location"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNavigation } from "@react-navigation/native"
import { useGuest } from "../../context/GuestLoginContext"

import LocationHeader from "./LocationHeader"
import LocationInputs from "./LocationInputs"
import LocationSuggestions from "./LocationSuggestions"
import MapSelector from "./MapSelector"
import MapPreview from "./MapPreview"
import FindRidersButton from "./FindRidersButton"
import {
  fetchCurrentLocationAddress,
  fetchLocationCoordinates,
  fetchPastRidesData,
  fetchDirectionsPolyline,
} from "./api"
import {  INDIA_REGION } from "./constants"
import styles from "./Styles"
import { useLocation } from "../../context/LocationContext"

const RideLocationSelector = () => {
  const navigation = useNavigation()
  const { isGuest } = useGuest()
  const [coordinates, setCoordinates] = useState([])

  const [pastRides, setPastRides] = useState([])
  const { location } = useLocation()
  const [pastRideSuggestions, setPastRideSuggestions] = useState({
    pickup: [],
    dropoff: [],
  })

  const directionsTimerRef = useRef(null)
  const isMapSelectionModeRef = useRef(false)
  // Add ref to track if pickup was set via map selection
  const isPickupSetViaMapRef = useRef(false)

  const [state, setState] = useState({
    pickup: "",
    dropoff: "",
    suggestions: [],
    loading: false,
    error: "",
    activeInput: null,
    showMap: false,
    mapType: null,
    isFetchingLocation: false,
    locationPermissionGranted: false,
  })

  const [rideData, setRideData] = useState({
    pickup: { latitude: 0, longitude: 0, description: "" },
    dropoff: { latitude: 0, longitude: 0, description: "" },
  })

  // Initialize region with user's current location or default to India
  const [region, setRegion] = useState({
    latitude: INDIA_REGION.center.latitude,
    longitude: INDIA_REGION.center.longitude,
    latitudeDelta: 20,
    longitudeDelta: 20,
  })

  useEffect(() => {
    checkLocationPermission()
    fetchPastRides()
  }, [location])

  // Process past rides to extract unique locations
  useEffect(() => {
    if (pastRides.length > 0) {
      try {
        // Extract unique pickup locations
        const uniquePickups = [
          ...new Map(
            pastRides.map((ride) => [
              ride.pickup_desc,
              {
                description: ride.pickup_desc,
                coordinates: ride.pickupLocation?.coordinates || [],
              },
            ]),
          ).values(),
        ].filter((item) => item.description && item.coordinates.length === 2)

        // Extract unique dropoff locations
        const uniqueDropoffs = [
          ...new Map(
            pastRides.map((ride) => [
              ride.drop_desc,
              {
                description: ride.drop_desc,
                coordinates: ride.dropLocation?.coordinates || [],
              },
            ]),
          ).values(),
        ].filter((item) => item.description && item.coordinates.length === 2)

        // Limit to 3 suggestions each
        setPastRideSuggestions({
          pickup: uniquePickups.slice(0, 3),
          dropoff: uniqueDropoffs.slice(0, 3),
        })
      } catch (error) {
        console.error("Error processing past rides:", error)
      }
    }
  }, [pastRides])

  // Update isMapSelectionModeRef when showMap changes
  useEffect(() => {
    isMapSelectionModeRef.current = state.showMap
  }, [state.showMap])

  useEffect(() => {
    // Clear any existing timer
    if (directionsTimerRef.current) {
      clearTimeout(directionsTimerRef.current)
    }

    const getDirections = async () => {
      try {
        // Only fetch directions if both locations are set AND we're not in map selection mode
        if (
          !isMapSelectionModeRef.current &&
          rideData?.pickup?.latitude &&
          rideData?.pickup?.longitude &&
          rideData?.dropoff?.latitude &&
          rideData?.dropoff?.longitude
        ) {
          console.log("Fetching directions")
          const { polylineCoordinates, distanceValue, durationValue } = await fetchDirectionsPolyline(
            rideData.pickup,
            rideData.dropoff,
          )

          setCoordinates(polylineCoordinates)
          // setDistance(distanceValue)
          // setDuration(durationValue)
        }
      } catch (error) {
        console.error("Error fetching directions:", error)
      }
    }

    // Set a debounce timer to prevent rapid consecutive API calls
    directionsTimerRef.current = setTimeout(getDirections, 500)

    // Cleanup on unmount
    return () => {
      if (directionsTimerRef.current) {
        clearTimeout(directionsTimerRef.current)
      }
    }
  }, [rideData.pickup, rideData.dropoff])

 const checkLocationPermission = async () => {
    try {
      setState((prev) => ({ ...prev, isFetchingLocation: true, error: null }));

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setState((prev) => ({
          ...prev,
          locationPermissionGranted: false,
          isFetchingLocation: false,
          error: '📍 Location permission denied.',
        }));
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!location) {
        setState((prev) => ({
          ...prev,
          isFetchingLocation: false,
          error: '⚠️ Could not retrieve location.',
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        location,
        locationPermissionGranted: true,
        isFetchingLocation: false,
      }));

      console.log('✅ Location obtained:', location);
    } catch (error) {
      // console.error('❌ Location error:', error);
      setState((prev) => ({
        ...prev,
        isFetchingLocation: false,
        error: 'Something went wrong while fetching location.',
      }));
    }
  };

  const updateLocationData = async () => {
    console.log("Updating location data with:", location)
    
    // FIXED: Don't auto-update pickup if it was set via map selection
    if (isPickupSetViaMapRef.current) {
      console.log("Skipping auto-update because pickup was set via map")
      return
    }
    
    try {
      const address = await fetchCurrentLocationAddress(location.coords.latitude, location.coords.longitude)

      // Ensure coordinates are within India
      const latitude = Math.min(Math.max(location.coords.latitude, INDIA_REGION.minLat), INDIA_REGION.maxLat)
      const longitude = Math.min(Math.max(location.coords.longitude, INDIA_REGION.minLng), INDIA_REGION.maxLng)

      // Update region to center on user's location
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01, 
        longitudeDelta: 0.01,
      })

      setState((prev) => ({
        ...prev,
        pickup: address,
        isFetchingLocation: false,
      }))

      setRideData((prev) => ({
        ...prev,
        pickup: {
          latitude,
          longitude,
          description: address,
        },
      }))
    } catch (error) {
      console.error("Address fetch error:", error)
      setState((prev) => ({
        ...prev,
        isFetchingLocation: false,
        error: "Failed to get address. Please enter manually.",
      }))
    }
  }

  useEffect(() => {
    if (location.coords) {
      updateLocationData()
    }
  }, [location.coords])

  const handleMapRegionChange = async (newRegion) => {
    try {
      // Constrain to India's boundaries
      const constrainedRegion = {
        ...newRegion,
        latitude: Math.min(Math.max(newRegion.latitude, INDIA_REGION.minLat), INDIA_REGION.maxLat),
        longitude: Math.min(Math.max(newRegion.longitude, INDIA_REGION.minLng), INDIA_REGION.maxLng),
      }

      setRegion(constrainedRegion)
      const { latitude, longitude } = constrainedRegion

      setState((prev) => ({ ...prev, loading: true }))
      const address = await fetchCurrentLocationAddress(latitude, longitude)

      if (state.mapType === "pickup") {
        // FIXED: Mark that pickup was set via map
        isPickupSetViaMapRef.current = true
        
        setState((prev) => ({ ...prev, pickup: address, loading: false }))
        setRideData((prev) => ({
          ...prev,
          pickup: { latitude, longitude, description: address },
        }))
      } else {
        setState((prev) => ({ ...prev, dropoff: address, loading: false }))
        setRideData((prev) => ({
          ...prev,
          dropoff: { latitude, longitude, description: address },
        }))
      }
    } catch (error) {
      console.error("Region change error:", error)
      setState((prev) => ({ ...prev, loading: false }))
    }
  }

  const fetchPastRides = async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }))
      const ridesData = await fetchPastRidesData()
      if (ridesData) {
        setPastRides(ridesData)
      }
    } catch (error) {
      console.error("Error fetching past rides:", error)
    } finally {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleLocationSelect = async (location, coordinates = null) => {
    try {
      // Dismiss keyboard first on iOS
      Keyboard.dismiss()
      
      setState((prev) => ({ ...prev, loading: true }))

      let latitude, longitude

      // If coordinates are provided (from past rides), use them directly
      if (coordinates && coordinates.length === 2) {
        ;[longitude, latitude] = coordinates
      } else {
        // Otherwise, geocode the address
        const coords = await fetchLocationCoordinates(location)
        latitude = coords.latitude
        longitude = coords.longitude
      }

      if (state.activeInput === "pickup") {
        // FIXED: Mark that pickup was set manually (not via current location)
        isPickupSetViaMapRef.current = true
        
        setState((prev) => ({ 
          ...prev, 
          pickup: location, 
          suggestions: [], 
          loading: false,
          activeInput: null // Clear active input to dismiss keyboard
        }))
        setRideData((prev) => ({
          ...prev,
          pickup: {
            latitude,
            longitude,
            description: location,
          },
        }))
      } else {
        setState((prev) => ({ 
          ...prev, 
          dropoff: location, 
          suggestions: [], 
          loading: false,
          activeInput: null // Clear active input to dismiss keyboard
        }))
        setRideData((prev) => ({
          ...prev,
          dropoff: {
            latitude,
            longitude,
            description: location,
          },
        }))
      }
    } catch (error) {
      console.error("Location select error:", error)
      setState((prev) => ({ ...prev, loading: false, error: "Failed to get location coordinates" }))
    }
  }

  const handleSubmit = () => {
    if (isGuest) {
      alert("To book a ride, please create an account.")
      navigation.navigate("Onboarding")
      return
    }

    if (!rideData.pickup.latitude || !rideData.dropoff.latitude) {
      alert("Please select both pickup and drop-off locations")
      return
    }

    navigation.navigate("second_step_of_booking", { data: rideData })
  }

  const handleShowMap = (type) => {
    // Dismiss keyboard before showing map
    Keyboard.dismiss()
    
    // Set region to current user location if available for pickup
    if (type === "pickup" && rideData.pickup.latitude && rideData.pickup.longitude) {
      setRegion({
        latitude: rideData.pickup.latitude,
        longitude: rideData.pickup.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      })
    }
    
    setState((prev) => ({ 
      ...prev, 
      showMap: true, 
      mapType: type,
      activeInput: null // Clear active input
    }))
  }

  const handleBackFromMap = () => {
    setState((prev) => ({ ...prev, showMap: false }))
    
    // After exiting map selection mode, calculate directions if both points are set
    if (rideData?.pickup?.latitude && rideData?.dropoff?.latitude) {
      // The useEffect for directions will handle this once showMap is updated
    }
  }

  // FIXED: Add function to reset pickup to current location
  const resetPickupToCurrentLocation = () => {
    isPickupSetViaMapRef.current = false
    if (location?.coords) {
      updateLocationData()
    }
  }

  if (state.showMap) {
    return (
      <MapSelector
        region={region}
        mapType={state.mapType}
        address={state.mapType === "pickup" ? state.pickup : state.dropoff}
        loading={state.loading}
        onRegionChangeComplete={handleMapRegionChange}
        onBack={handleBackFromMap}
      />
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <LocationHeader onBack={() => navigation.goBack()} />

      <LocationInputs
        state={state}
        setState={setState}
        rideData={rideData}
        isFetchingLocation={state.isFetchingLocation}
        onMapSelect={handleShowMap}
        onLocationSelect={handleLocationSelect} // Pass the handler
        onResetPickupToCurrentLocation={resetPickupToCurrentLocation} // Add this prop if needed
      />

      {state.error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      ) : null}

      {state.suggestions.length > 0 && (
        <LocationSuggestions
          state={state}
          pastRideSuggestions={pastRideSuggestions}
          onSelectLocation={handleLocationSelect}
        />
      )}

      {rideData?.pickup?.latitude && !state.suggestions.length && !state.activeInput && (
        <MapPreview rideData={rideData} coordinates={coordinates} region={region} setRegion={setRegion} />
      )}

      {rideData.pickup.latitude && rideData.dropoff.latitude && !state.suggestions.length && (
        <FindRidersButton onPress={handleSubmit} />
      )}
    </SafeAreaView>
  )
}

export default RideLocationSelector