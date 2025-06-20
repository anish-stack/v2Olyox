import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  BackHandler,
  Alert,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import * as Updates from "expo-updates";
import {
  MaterialCommunityIcons,
  FontAwesome5,
  Ionicons,
  Feather,
  MaterialIcons,
} from "@expo/vector-icons";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { initializeSocket } from "../context/socketService";
import { useSocket } from "../context/SocketContext";
import Bonus from "./Bonus/Bonus";
import { useLocation } from "../context/LocationContext";

// API configuration
const API_URL = "http://192.168.1.6:3100/api/v1";
const RIDER_API = `${API_URL}/rider`;

const { width, height } = Dimensions.get("window");

const ParcelHome = () => {
  // States
  const { driverLocation } = useLocation()
  const [menuVisible, setMenuVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshModalVisible, setRefreshModalVisible] = useState(false);
  const [statusBarHeight, setStatusBarHeight] = useState(0);
  const [performanceStats, setPerformanceStats] = useState({
    deliveries: { today: 0, week: 12, month: 47 },
    earnings: { today: 0, week: 1250, month: 4700 },
    inprogress: 4.8,
    acceptanceRate: 92,
  });

  // Animations - all using the same driver type
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Context and hooks
  const { isSocketReady, socket } = useSocket();
  const navigation = useNavigation();

  // Animation effects
  useEffect(() => {
    // Animate fade and scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate status bar height with state instead of animation
    setTimeout(() => {
      setStatusBarHeight(40);
    }, 800);
  }, []);

  // Normal refresh - just reload data
  const handleNormalRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshModalVisible(false);
    try {
      await fetchUserDetails();

      await new Promise((resolve) => setTimeout(resolve, 800));
      Alert.alert("Success", "Data refreshed successfully");
    } catch (error) {
      console.error("Refresh failed:", error);
      Alert.alert("Refresh Failed", "Could not refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Hard refresh - reload everything including socket connection
  const handleHardRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshModalVisible(false);
    try {
      // Reconnect socket
      if (userData?._id) {
        await initializeSocket({ userId: userData._id });
      }

      await fetchUserDetails();
      await Updates.reloadAsync();

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Home" }],
        })
      );
    } catch (error) {
      console.error("Hard refresh failed:", error);
      Alert.alert("Refresh Failed", "Could not refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, [userData]);

  // Logout handler with retry mechanism
  const handleLogout = useCallback(
    async (retryCount = 0, maxRetries = 3) => {
      try {
        // First, delete secure storage items regardless of connection state
        await SecureStore.deleteItemAsync("auth_token_cab");
        await SecureStore.deleteItemAsync("isOnline");

        if (!userData?._id) {
          console.log("No user ID available for logout");
          // Even without ID, we should reset to Onboarding since tokens are deleted
          navigation.reset({
            index: 0,
            routes: [{ name: "Onboarding" }],
          });
          return;
        }

        // Attempt the logout API call
        const response = await axios.get(
          `${RIDER_API}/rider-logout/${userData._id}`
        );

        if (response.data.success) {
          console.log("Logout successful:", response.data);

          navigation.reset({
            index: 0,
            routes: [{ name: "Onboarding" }],
          });

          BackHandler.exitApp();
        } else {
          throw new Error(response.data.message || "Logout failed");
        }
      } catch (error) {
        console.error(`Logout Error (Attempt ${retryCount + 1}):`, error);

        // If we haven't reached max retries, try again after 4 seconds
        if (retryCount < maxRetries) {
          console.log(
            `Retrying logout in 4 seconds... (Attempt ${retryCount + 1
            }/${maxRetries})`
          );

          setTimeout(() => {
            handleLogout(retryCount + 1, maxRetries);
          }, 4000);
        } else {
          // If we've reached max retries, show error and provide options
          const errorMessage =
            error?.response?.data?.message &&
              error?.response?.data?.message !== "undefined"
              ? error.response.data.message
              : "Please try again. If you have an ongoing delivery, please complete it first.";

          Alert.alert("Unable to Logout", errorMessage, [
            {
              text: "Try Again",
              onPress: () => handleLogout(0, maxRetries),
            },
            {
              text: "Force Logout",
              onPress: () => {
                // Force navigation reset even if API call failed
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Onboarding" }],
                });
              },
            },
          ]);
        }
      } finally {
        setMenuVisible(false);
      }
    },
    [navigation, userData]
  );

  // Socket reconnection handler
  const handleSocketReconnect = async (userId) => {
    if (!userId) {
      Alert.alert(
        "Error",
        "User information not available. Please try to log in again."
      );
      return;
    }

    try {
      setLoading(true);
      const isReconnected = await initializeSocket({ userId });

      if (isReconnected) {
        Alert.alert("Success", "Successfully reconnected to the server.");
      } else {
        throw new Error("Connection failed");
      }
    } catch (error) {
      console.error("Socket reconnection error:", error);
      Alert.alert(
        "Connection Error",
        "Failed to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch user details from API
  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab");

      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await axios.get(`${RIDER_API}/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success && response.data.partner) {
        const partnerData = response.data.partner;
        const dashboard = await axios.get(`http://192.168.1.6:3100/api/v1/rides/parcelDashboardData/${partnerData?._id}`);

        if (dashboard.data.data) {
          const { totalDeliveries, inProgressDeliveries, totalEarnings, ridesRejected } = dashboard.data.data;

          setPerformanceStats((prev) => ({
            ...prev,
            deliveries: {
              today: 0,
              week: 0,
              month: totalDeliveries || 0
            },
            earnings: {
              today: 0,
              week: 0,
              month: totalEarnings || 0
            },
            inprogress: inProgressDeliveries || 0,
            acceptanceRate: ridesRejected ? 100 - ridesRejected : 100,
          }));
        }

        setUserData(partnerData);
        setIsOnline(partnerData.isAvailable);

        // Initialize socket connection with user ID
        await initializeSocket({ userId: partnerData._id });

        return partnerData;
      } else {
        throw new Error(
          response.data.message || "Failed to fetch user details"
        );
      }
    } catch (error) {
      console.error(
        "Error fetching user details:",
        error?.response?.data?.message || error.message
      );

      if (error?.response?.status === 401) {
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please log in again.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Onboarding" }],
                });
              },
            },
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };



  // Initial data load
  useEffect(() => {
    fetchUserDetails();

    // Set status bar height after data loads
    setTimeout(() => {
      setStatusBarHeight(40);
    }, 800);
  }, []);

  const updateDriverLocation = useCallback(async (latitude, longitude) => {
    try {
      await axios.post('http://192.168.1.6:3100/webhook/cab-receive-location', {
        riderId: userData?._id,
        latitude,
        longitude
      });
      console.log("i am updated")
    } catch (err) {
      console.error('Error updating driver location:', err.response.data);
    }
  }, [userData]);

  useEffect(() => {
    updateDriverLocation(driverLocation?.latitude, driverLocation?.longitude)
  }, [driverLocation])

  console.log("I am Parcel Home",)

  // Toggle online/offline status
  const toggleOnlineStatus = async () => {
    if (loading) return;

    setLoading(true);

    try {
      // Check if recharge is expired before going online
      const expireDate = new Date(userData?.RechargeData?.expireData);
      const currentDate = new Date();
      const goingOnline = !isOnline;

      if (goingOnline && expireDate < currentDate) {
        Alert.alert(
          "Recharge Expired",
          "Your recharge has expired. Please recharge to go online.",
          [
            {
              text: "Recharge Now",
              onPress: () => navigation.navigate("Recharge"),
            },
          ]
        );
        return;
      }

      const token = await SecureStore.getItemAsync("auth_token_cab");

      if (!token) {
        throw new Error("Authentication token not found");
      }

      // Toggle driver availability
      const response = await axios.post(
        `${RIDER_API}/toggleWorkStatusOfRider`,
        { status: goingOnline },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to update status");
      }

      // Get latest user data
      const updatedUserData = await fetchUserDetails();

      // Update local storage with online status
      await SecureStore.setItemAsync("isOnline", goingOnline.toString());

      // Update state with new online status
      setIsOnline(response.data.cabRider?.status === "online");

      // Show success message
      Alert.alert(
        "Status Updated",
        `You are now ${goingOnline ? "online" : "offline"}.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error(
        "Toggle Status Error:",
        error?.response?.data?.message || error.message
      );

      Alert.alert(
        "Status Update Failed",
        error?.response?.data?.message ||
        error.message ||
        "Something went wrong",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Format date to Indian Standard Time
  const formatToIST = (dateString) => {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Date formatting error:", error);
      return "Invalid Date";
    }
  };

  // Memoized components for performance
  const ConnectionStatusIndicator = useMemo(
    () => (
      <Animated.View
        style={[
          styles.connectionStatus,
          {
            backgroundColor: socket?.connected
              ? "rgba(46, 213, 115, 0.15)"
              : "rgba(255, 71, 87, 0.15)",
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            height: statusBarHeight,
          },
        ]}
      >
        <Ionicons
          name={socket?.connected ? "checkmark-circle" : "alert-circle"}
          size={18}
          color={socket?.connected ? "#2ed573" : "#ff4757"}
        />
        <Text
          style={[
            styles.connectionText,
            { color: socket?.connected ? "#2ed573" : "#ff4757" },
          ]}
        >
          {socket?.connected ? "Connected to Server" : "Server Disconnected"}
        </Text>
      </Animated.View>
    ),
    [socket?.connected, fadeAnim, scaleAnim, statusBarHeight]
  );

  const RefreshModal = useMemo(
    () => (
      <Modal
        animationType="fade"
        transparent={true}
        visible={refreshModalVisible}
        onRequestClose={() => setRefreshModalVisible(false)}
      >
        <BlurView intensity={80} style={styles.modalOverlay} tint="dark">
          <View style={styles.refreshModalContainer}>
            <View style={styles.refreshModalHeader}>
              <Text style={styles.refreshModalTitle}>Refresh Options</Text>
              <TouchableOpacity
                onPress={() => setRefreshModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#718093" />
              </TouchableOpacity>
            </View>

            <View style={styles.refreshOptionsContainer}>
              <TouchableOpacity
                style={styles.refreshOption}
                onPress={handleNormalRefresh}
                disabled={refreshing}
              >
                <View style={[styles.refreshIconContainer, styles.normalRefresh]}>
                  <Feather
                    name="refresh-cw"
                    size={28}
                    color="#3498db"
                    style={refreshing ? styles.spinAnimation : null}
                  />
                </View>
                <Text style={styles.refreshOptionTitle}>Normal Refresh</Text>
                <Text style={styles.refreshOptionDescription}>
                  Reload data without reconnecting
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshOption}
                onPress={handleHardRefresh}
                disabled={refreshing}
              >
                <View style={[styles.refreshIconContainer, styles.hardRefresh]}>
                  <MaterialIcons
                    name="refresh"
                    size={28}
                    color="#e74c3c"
                    style={refreshing ? styles.spinAnimation : null}
                  />
                </View>
                <Text style={styles.refreshOptionTitle}>Hard Refresh</Text>
                <Text style={styles.refreshOptionDescription}>
                  Reconnect socket and reload everything
                </Text>
              </TouchableOpacity>
            </View>

            {refreshing && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3498db" />
                <Text style={styles.loadingText}>Refreshing...</Text>
              </View>
            )}
          </View>
        </BlurView>
      </Modal>
    ),
    [refreshModalVisible, refreshing, handleNormalRefresh, handleHardRefresh]
  );

  const MenuModal = useMemo(
    () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <BlurView intensity={80} style={styles.modalOverlay} tint="dark">
          <View style={styles.menuContainer}>
            <View style={styles.menuHandle} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("Profile");
              }}
            >
              <Ionicons name="person" size={24} color="#3498db" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("Recharge", {
                  showOnlyBikePlan:
                    userData?.rideVehicleInfo?.vehicleName === '2 Wheeler' ||
                    userData?.rideVehicleInfo?.vehicleName === 'Bike'
                      ? true
                      : false,
                  role: userData?.category,
                  firstRecharge : userData?.isFirstRechargeDone || false                  
                });
              }}
              
            >
              <Ionicons name="card" size={24} color="#3498db" />
              <Text style={styles.menuText}>Recharge</Text>
            </TouchableOpacity>




            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out" size={24} color="#e74c3c" />
              <Text style={[styles.menuText, { color: "#e74c3c" }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    ),
    [menuVisible, navigation, handleLogout]
  );

  const PerformanceCards = useMemo(() => (
    <View style={styles.performanceContainer}>
      <Text style={styles.sectionTitle}>Performance Stats</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScrollView}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: "rgba(52, 152, 219, 0.15)" }]}>
            <Feather name="package" size={20} color="#3498db" />
          </View>
          <Text style={styles.statValue}>{performanceStats.deliveries.month}</Text>
          <Text style={styles.statLabel}>Deliveries</Text>
          <Text style={styles.statPeriod}>This Week</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: "rgba(46, 204, 113, 0.15)" }]}>
            <FontAwesome5 name="rupee-sign" size={20} color="#2ecc71" />

          </View>
          <Text style={styles.statValue}>Rs {performanceStats.earnings.month}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
          <Text style={styles.statPeriod}>This Week</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('progress-order', { id: userData?._id })} style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: "rgba(241, 196, 15, 0.15)" }]}>
            <Feather name="star" size={20} color="#f1c40f" />
          </View>
          <Text style={styles.statValue}>{performanceStats.inprogress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
          <Text style={styles.statPeriod}>Orders</Text>
        </TouchableOpacity>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: "rgba(155, 89, 182, 0.15)" }]}>
            <Feather name="check-circle" size={20} color="#9b59b6" />
          </View>
          <Text style={styles.statValue}>{performanceStats.acceptanceRate}%</Text>
          <Text style={styles.statLabel}>Acceptance</Text>
          <Text style={styles.statPeriod}>Rate</Text>
        </View>
      </ScrollView>
    </View>
  ), [performanceStats]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <LinearGradient
        colors={["#3498db", "#2980b9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Parcel Driver</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setRefreshModalVisible(true)}
            style={styles.headerButton}
          >
            <Feather name="refresh-cw" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.headerButton}
          >
            <Feather name="menu" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshModalVisible(true)}
            colors={["#3498db"]}
            tintColor="#3498db"
          />
        }
      >
        {ConnectionStatusIndicator}

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(fadeAnim, -10) }],
            },
          ]}
        >
          {/* Welcome Card with Profile */}
          <LinearGradient
            colors={["#ffffff", "#f7f7f7"]}
            style={styles.welcomeCard}
          >
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                {userData?.documents?.profile ? (
                  <Image
                    source={{ uri: userData.documents.profile }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Ionicons name="person" size={40} color="#3498db" />
                  </View>
                )}
              </View>

              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeText}>
                  Welcome back,{" "}
                  {userData?.name?.split(" ")[0] || "Driver"}!
                </Text>
                {userData?.isFreeMember && (
                  <View style={{
                    backgroundColor: '#e0f7fa',
                    padding: 8,
                    borderRadius: 8,
                    marginVertical: 5,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Text style={{
                      color: '#00796b',
                      fontSize: 10,
                      fontWeight: 'bold',
                    }}>
                      You are in the Free Tier of Olyox
                    </Text>
                  </View>
                )}

              <Text style={styles.subText}>
  Recharge expires on {formatToIST(userData?.RechargeData?.expireData)}. Additionally, if your earnings reach ₹{userData?.RechargeData?.onHowManyEarning}, your recharge will also be considered expired.
</Text>

              </View>
            </View>

            {/* Online/Offline Toggle */}
            <TouchableOpacity
              style={[
                styles.onlineToggle,
                {
                  backgroundColor: loading
                    ? "#ecf0f1"
                    : isOnline
                      ? "rgba(46, 213, 115, 0.15)"
                      : userData?.on_ride_id
                        ? "rgba(241, 196, 15, 0.15)"
                        : "rgba(255, 71, 87, 0.15)",
                },
              ]}
              onPress={toggleOnlineStatus}
              disabled={loading || userData?.on_ride_id}
            >
              <Ionicons
                name={
                  loading
                    ? "time-outline"
                    : isOnline
                      ? "flash"
                      : userData?.on_ride_id
                        ? "bicycle"
                        : "power"
                }
                size={24}
                color={
                  loading
                    ? "#7f8c8d"
                    : isOnline
                      ? "#2ed573"
                      : userData?.on_ride_id
                        ? "#f1c40f"
                        : "#ff4757"
                }
              />
              <Text
                style={[
                  styles.onlineToggleText,
                  {
                    color: loading
                      ? "#7f8c8d"
                      : isOnline
                        ? "#2ed573"
                        : userData?.on_ride_id
                          ? "#f1c40f"
                          : "#ff4757",
                  },
                ]}
              >
                {loading
                  ? "Updating..."
                  : isOnline
                    ? "Go Offline"
                    : userData?.on_ride_id
                      ? "Delivery In Progress"
                      : "Go Online"}
              </Text>
            </TouchableOpacity>

            {/* Reconnect Button */}
            <TouchableOpacity
              style={[
                styles.reconnectButton,
                {
                  backgroundColor: isSocketReady
                    ? "rgba(52, 152, 219, 0.15)"
                    : "rgba(255, 71, 87, 0.15)",
                },
              ]}
              onPress={() => handleSocketReconnect(userData?._id)}
              disabled={loading}
            >
              <Ionicons
                name={isSocketReady ? "wifi" : "wifi-outline"}
                size={24}
                color={isSocketReady ? "#3498db" : "#ff4757"}
              />
              <Text
                style={[
                  styles.reconnectText,
                  { color: isSocketReady ? "#3498db" : "#ff4757" },
                ]}
              >
                {isSocketReady ? "Connected to Server" : "Reconnect to Server"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Status Cards */}
          <View style={styles.statusCardsContainer}>
            <View style={styles.statusCard}>
              <View style={[styles.statusIconBg, { backgroundColor: "rgba(52, 152, 219, 0.15)" }]}>
                <Ionicons name="cube-outline" size={24} color="#3498db" />
              </View>
              <Text style={styles.statusLabel}>Status</Text>
              <Text
                style={[
                  styles.statusValue,
                  {
                    color: userData?.isAvailable
                      ? "#2ed573"
                      : userData?.on_ride_id
                        ? "#f1c40f"
                        : "#ff4757",
                  },
                ]}
              >
                {userData?.isAvailable
                  ? "Online"
                  : userData?.on_ride_id
                    ? "On Delivery"
                    : "Offline"}
              </Text>
            </View>

            <View style={styles.statusCard}>
              <View style={[styles.statusIconBg, { backgroundColor: "rgba(46, 213, 115, 0.15)" }]}>
                <Ionicons name="wifi-outline" size={24} color="#2ed573" />
              </View>
              <Text style={styles.statusLabel}>Connection</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: socket?.connected ? "#2ed573" : "#ff4757" },
                ]}
              >
                {socket?.connected ? "Connected" : "Offline"}
              </Text>
            </View>
          </View>

          {/* Performance Cards */}
          {PerformanceCards}

          {/* Bonus Section */}
          <Bonus />

          {/* Check Available Orders Button - Sticky */}

        </Animated.View>

      </ScrollView>

      {/* Modals */}
      {RefreshModal}
      {MenuModal}
      <View style={styles.stickyButtonContainer}>
        <TouchableOpacity
          style={styles.checkOrdersButton}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("available-orders")}
        >
          <LinearGradient
            colors={["#2ed573", "#1e9c5b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Feather name="package" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Check Available Orders</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  connectionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },
  welcomeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#3498db",
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(52, 152, 219, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 4,
  },
  subText: {
    fontSize: 13,
    color: "#7f8c8d",
  },
  onlineToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  onlineToggleText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  reconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  reconnectText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  statusCardsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statusCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusIconBg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: "#7f8c8d",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  performanceContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 12,
  },
  statsScrollView: {
    marginHorizontal: -8,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    width: 140,
    marginVertical: 5,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#7f8c8d",
    marginBottom: 2,
  },
  statPeriod: {
    fontSize: 12,
    color: "#95a5a6",
  },
  stickyButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "transparent",
  },
  checkOrdersButton: {
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  menuContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
    maxHeight: height * 0.7,
  },
  menuHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 16,
    color: "#2c3e50",
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#f1f2f6",
    marginVertical: 8,
  },
  refreshModalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  refreshModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  refreshModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  closeButton: {
    padding: 4,
  },
  refreshOptionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  refreshOption: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#f8f9fa",
    marginHorizontal: 8,
  },
  refreshIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  normalRefresh: {
    backgroundColor: "rgba(52, 152, 219, 0.15)",
  },
  hardRefresh: {
    backgroundColor: "rgba(231, 76, 60, 0.15)",
  },
  refreshOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  refreshOptionDescription: {
    fontSize: 12,
    color: "#7f8c8d",
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#7f8c8d",
  },
  spinAnimation: {
    transform: [{ rotate: "45deg" }],
  },
});

export default React.memo(ParcelHome);
