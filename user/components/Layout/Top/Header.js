"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  BackHandler,
  StatusBar,
  Image,
} from "react-native"
import { MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import { useLocation } from "../../../context/LocationContext"
import axios from "axios"
import { tokenCache } from "../../../Auth/cache"
import { COLORS } from "../../../constants/colors"
import useSettings from "../../../hooks/Settings"
import Footer from "./Footer"
import { find_me } from "../../../utils/helpers"
import * as Location from "expo-location"
import { useGuest } from "../../../context/GuestLoginContext"

const { width } = Dimensions.get("window")
const LOCATION_CACHE_EXPIRY = 15 * 60 * 1000 // 15 minutes

const Header = () => {
  // State management
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [address, setAddress] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [userData, setUserData] = useState(null)
  const [locationPermission, setLocationPermission] = useState(null)
  const { isGuest } = useGuest()

  // Refs
  const locationFetchedRef = useRef(false)
  const lastLocationUpdateRef = useRef(0)
  const lastCoordsRef = useRef(null)

  // Hooks
  const { location } = useLocation()
  const { settings } = useSettings()
  const navigation = useNavigation()

  // Animations
  const slideAnim = useRef(new Animated.Value(-width)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const headerHeightAnim = useRef(new Animated.Value(70)).current

  // Menu items configuration
  const menuItems = useMemo(
    () => [
      { title: "Home", icon: "home", iconType: "FontAwesome5", screen: "Home" },
      {
        title: isGuest ? "Guest" : "Profile",
        icon: "user",
        iconType: "FontAwesome5",
        screen: isGuest ? "" : "Profile",
      },
      { title: "Parcel", icon: "box", iconType: "FontAwesome5", screen: "Parcel" },
      { title: "Orders", icon: "shopping-bag", iconType: "FontAwesome5", screen: "Orders" },
      { title: "Hotel", icon: "hotel", iconType: "FontAwesome5", screen: "Hotel" },
      { title: "Transport", icon: "car", iconType: "FontAwesome5", screen: "Transport" },
    ],
    [isGuest],
  )

  // Toggle sidebar function
  const toggleSidebar = useCallback(() => {
    if (sidebarVisible) {
      hideSidebar()
    } else {
      showSidebar()
    }
  }, [sidebarVisible])

  // Show sidebar with animation
  const showSidebar = useCallback(() => {
    setSidebarVisible(true)
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [slideAnim, fadeAnim])

  // Hide sidebar with animation
  const hideSidebar = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: -width,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setSidebarVisible(false))
  }, [slideAnim, fadeAnim])

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      const user = await find_me()
      setUserData(user.user)
    } catch (error) {
      console.log("Error fetching user data:", error)
    }
  }, [])

  // Request location permission
  const requestLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      setLocationPermission(status)
      return status === "granted"
    } catch (error) {
      console.log("Error requesting location permission:", error)
      return false
    }
  }, [])

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999 // Return large distance if any coordinate is missing

    const R = 6371 // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in km
  }, [])

  // Animate header height
  const animateHeaderHeight = useCallback(
    (targetHeight) => {
      Animated.timing(headerHeightAnim, {
        toValue: targetHeight,
        duration: 300,
        useNativeDriver: false,
      }).start()
    },
    [headerHeightAnim],
  )

  // Fetch current location with optimized caching
  const findCurrent = useCallback(async () => {
    // Skip if we're already loading or if the sidebar is visible
    if (locationLoading || sidebarVisible) return

    // Check if we have location coordinates
    if (!location?.coords) {
      return
    }

    // Check if location has changed significantly
    if (lastCoordsRef.current) {
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        lastCoordsRef.current.latitude,
        lastCoordsRef.current.longitude,
      )

      // If location hasn't changed much (less than 100 meters) and we fetched recently (within cache expiry)
      const timeSinceLastUpdate = Date.now() - lastLocationUpdateRef.current
      if (distance < 0.1 && timeSinceLastUpdate < LOCATION_CACHE_EXPIRY && address) {
        return // Skip fetching, use existing address
      }
    }

    // Check if we have permission
    if (locationPermission !== "granted") {
      const hasPermission = await requestLocationPermission()
      if (!hasPermission) return
    }

    try {
      setLocationLoading(true)

      // Try to get from cache first
      const cachedAddress = await tokenCache.get_location("cached_location")
      const cachedCoords = await tokenCache.get_location("cached_coords")

      if (cachedAddress && cachedCoords) {
        const parsedCoords = JSON.parse(cachedCoords)
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          parsedCoords.latitude,
          parsedCoords.longitude,
        )

        // If within 100 meters, use cached address
        if (distance < 0.1) {
          const addressObj = JSON.parse(cachedAddress)
          setAddress(addressObj)

          // Update refs
          lastCoordsRef.current = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }
          lastLocationUpdateRef.current = Date.now()
          locationFetchedRef.current = true

          // Animate header height based on address length
          const targetHeight = addressObj?.completeAddress?.length > 30 ? 90 : 70
          animateHeaderHeight(targetHeight)

          setLocationLoading(false)
          return
        }
      }

      // Fetch new address from API
      const { data } = await axios.post(`http://192.168.1.6:3100/Fetch-Current-Location`, {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      })

      if (data?.data?.address) {
        setAddress(data.data.address)

        // Cache the new address and coordinates
        await tokenCache.save_location("cached_location", JSON.stringify(data.data.address))
        await tokenCache.save_location(
          "cached_coords",
          JSON.stringify({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }),
        )

        // Update refs
        lastCoordsRef.current = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }
        lastLocationUpdateRef.current = Date.now()
        locationFetchedRef.current = true

        // Animate header height based on address length
        const targetHeight = data.data.address?.completeAddress?.length > 30 ? 90 : 70
        animateHeaderHeight(targetHeight)
      }
    } catch (error) {
      console.error("Error fetching location:", error.response?.data?.message || error.message)
    } finally {
      setLocationLoading(false)
    }
  }, [
    location,
    locationPermission,
    locationLoading,
    sidebarVisible,
    address,
    calculateDistance,
    requestLocationPermission,
    animateHeaderHeight,
  ])

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await axios.get("http://192.168.1.6:3100/api/v1/rider/logout", { withCredentials: true })
      await tokenCache.deleteToken("auth_token_db")
      setIsAuthenticated(false)

      navigation.reset({
        index: 0,
        routes: [{ name: "Onboarding" }],
      })

      setTimeout(() => {
        BackHandler.exitApp()
      }, 1000)
    } catch (error) {
      console.error("Error during logout:", error)
      navigation.reset({
        index: 0,
        routes: [{ name: "Onboarding" }],
      })
    }
  }, [navigation])

  // Handle login
  const handleLogin = useCallback(() => {
    navigation.navigate("Onboarding")
    hideSidebar()
  }, [navigation, hideSidebar])

  // Handle menu item click
  const handleMenuClick = useCallback(
    (screen) => {
      if (!screen) return
      navigation.navigate(screen)
      hideSidebar()
    },
    [navigation, hideSidebar],
  )

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const token = await tokenCache.getToken("auth_token_db")
      setIsAuthenticated(!!token)
    } catch (error) {
      console.error("Error checking auth status:", error)
      setIsAuthenticated(false)
    }
  }, [])

  // Render icon based on type
  const renderIcon = useCallback((item) => {
    if (item.iconType === "FontAwesome5") {
      return <FontAwesome5 name={item.icon} size={20} color={COLORS.text} />
    }
    return <MaterialCommunityIcons name={item.icon} size={20} color={COLORS.text} />
  }, [])

  // Effects
  useEffect(() => {
    // Only fetch location if we haven't already or if location has changed significantly
    if (
      !locationFetchedRef.current ||
      !lastCoordsRef.current ||
      (location?.coords &&
        calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          lastCoordsRef.current.latitude,
          lastCoordsRef.current.longitude,
        ) > 0.1)
    ) {
      findCurrent()
    }

    checkAuthStatus()

    // Handle back button press to close sidebar
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sidebarVisible) {
        hideSidebar()
        return true
      }
      return false
    })

    return () => backHandler.remove()
  }, [location, findCurrent, checkAuthStatus, sidebarVisible, hideSidebar, calculateDistance])

  // Fetch user data when authentication status changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserData()
    }
  }, [isAuthenticated, fetchUserData])

  // Memoized components for better performance
  const locationSection = useMemo(
    () => (
      <TouchableOpacity
        style={styles.locationContainer}
        onPress={() => navigation.navigate("LocationSelect")}
        activeOpacity={0.8}
      >
        <View style={styles.locationIconContainer}>
          <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.white} />
        </View>

        <View style={styles.locationTextContainer}>
          <Text style={styles.locationLabel}>{locationLoading ? "Finding location..." : "Your Location"}</Text>
          {locationLoading ? (
            <View style={styles.loadingIndicator} />
          ) : (
            <Text numberOfLines={2} style={styles.locationDetails}>
              {address?.completeAddress || "Set your location"}
              {address?.district ? `, ${address.district}` : ""}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [locationLoading, address, navigation],
  )

  // Render location permission request
  const renderLocationPermissionRequest = useMemo(() => {
    if (locationPermission === "granted" || !locationLoading) return null

    return (
      <TouchableOpacity style={styles.permissionRequest} onPress={requestLocationPermission}>
        <MaterialCommunityIcons name="map-marker-alert" size={18} color={COLORS.white} />
        <Text style={styles.permissionText}>Location access needed</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestLocationPermission}>
          <Text style={styles.permissionButtonText}>Allow</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }, [locationPermission, locationLoading, requestLocationPermission])

  // Render user profile section
  const renderUserProfile = useMemo(
    () => (
      <View style={styles.profileSection}>
        <View style={styles.profileImageContainer}>
          {isAuthenticated && userData?.profileImage?.image ? (
            <Image
              source={{ uri: userData?.profileImage?.image }}
              style={styles.profileImage}
              defaultSource={require("./logo_O.png")}
            />
          ) : (
            <FontAwesome5 name="user" size={30} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{isAuthenticated ? userData?.name : "Guest User"}</Text>
          <Text style={styles.profileEmail}>
            {isAuthenticated ? userData?.email : "Sign in to access all features"}
          </Text>
        </View>
      </View>
    ),
    [isAuthenticated, userData],
  )

  // Render auth buttons
  const renderAuthButtons = useMemo(
    () => (
      <View style={styles.authButtons}>
        {isAuthenticated ? (
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.authButtonsContainer}>
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ),
    [isAuthenticated, handleLogout, handleLogin],
  )

  // Render menu items
  const renderMenuItems = useMemo(
    () => (
      <View style={styles.menuItems}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.menuItem, index === menuItems.length - 1 && styles.lastMenuItem]}
            onPress={() => handleMenuClick(item.screen)}
            disabled={!item.screen}
          >
            <View style={styles.menuIconContainer}>{renderIcon(item)}</View>
            <Text style={styles.menuText}>{item.title}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CCCCCC" style={styles.menuArrow} />
          </TouchableOpacity>
        ))}
      </View>
    ),
    [menuItems, handleMenuClick, renderIcon],
  )

  return (
    <View>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.error} />

      {/* Main Header */}
      <Animated.View style={[styles.header, { height: headerHeightAnim }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLogoContainer}>
            <Image source={require("./logo_O.png")} style={styles.headerLogo} resizeMode="contain" />
          </View>

          {/* Location Section - Memoized */}
          {locationSection}

          {/* Menu Button */}
          <TouchableOpacity style={styles.menuButton} onPress={toggleSidebar} activeOpacity={0.7}>
            <MaterialCommunityIcons name="menu" size={28} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Location Permission Request - Memoized */}
        {renderLocationPermissionRequest}
      </Animated.View>

      {/* Sidebar Modal */}
      {sidebarVisible && (
        <Modal visible transparent onRequestClose={hideSidebar} animationType="none">
          <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={hideSidebar}>
              <Animated.View
                style={[
                  styles.sidebar,
                  {
                    transform: [{ translateX: slideAnim }],
                  },
                ]}
              >
                <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                  {/* Sidebar Header */}
                  <View style={styles.sidebarHeader}>
                    <View style={styles.logoContainer}>
                      <Image source={require("./logo_O.png")} style={styles.logo} resizeMode="contain" />
                      <Text style={styles.sidebarTitle}>Olyox</Text>
                    </View>
                    <TouchableOpacity
                      onPress={hideSidebar}
                      style={styles.closeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>

                  {/* User Profile Section - Memoized */}
                  {renderUserProfile}

                  {/* Auth Buttons - Memoized */}
                  {renderAuthButtons}

                  {/* Menu Items - Memoized */}
                  {renderMenuItems}

                  {/* Footer */}
                  <Footer />
                </TouchableOpacity>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.error,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  locationIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  locationTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  locationLabel: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    fontWeight: "500",
  },
  locationDetails: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "400",
  },
  loadingIndicator: {
    height: 14,
    width: 100,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 7,
    marginTop: 4,
  },
  headerLogoContainer: {
    width: 45,
    height: 45,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 3,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  menuButton: {
    width: 35,
    height: 35,
    marginLeft: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionRequest: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop: 8,
  },
  permissionText: {
    color: COLORS.white,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  permissionButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  permissionButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sidebar: {
    backgroundColor: COLORS.background,
    width: width * 0.85,
    height: "100%",
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  profileSection: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  profileImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: "#666",
  },
  authButtons: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  authButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  loginButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
    elevation: 2,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
  },
  loginButtonText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 14,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontWeight: "bold",
    fontSize: 14,
    marginLeft: 8,
  },
  menuItems: {
    padding: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  menuArrow: {
    marginLeft: 8,
  },
})

export default Header
