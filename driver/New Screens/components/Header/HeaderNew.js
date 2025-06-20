import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  Animated,
  BackHandler,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import {
  MaterialCommunityIcons,
  FontAwesome5,
  Ionicons,
  FontAwesome,
} from '@expo/vector-icons';
import { colors } from '../../NewConstant';
import { useFetchUserDetails } from '../../../hooks/New Hookes/RiderDetailsHooks';

const API_BASE_URL = 'http://192.168.1.6:3100/api/v1/rider';

const HeaderNew = () => {
  const navigation = useNavigation();
  const { fetchUserDetails: reCallMe } = useFetchUserDetails();

  // All state management internal
  const [user_data, setUserData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeRideData, setActiveRideData] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [refreshing, setRefreshing] = useState(false);

  // Utility function for API calls with token
  const makeAuthenticatedRequest = useCallback(async (url, options = {}) => {
    const token = await SecureStore.getItemAsync("auth_token_cab");
    if (!token) {
      throw new Error('No authentication token found');
    }
    return axios({
      ...options,
      url,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }, []);



  // Enhanced logout function with proper error handling
  const handleLogout = useCallback(
    async (retryCount = 0, maxRetries = 3) => {
      try {
        setLoading(true);

        // Always delete the token first
        await SecureStore.deleteItemAsync("auth_token_cab");

        if (!user_data?._id) {
          console.log("No user ID available", user_data);
          navigation.reset({
            index: 0,
            routes: [{ name: "Onboarding" }],
          });
          return;
        }

        // Attempt the logout API call
        const response = await axios.get(
          `${API_BASE_URL}/rider-logout/${user_data._id}`
        );

        console.log("Logout successful:", response.data);

        // Reset navigation and exit app
        navigation.reset({
          index: 0,
          routes: [{ name: "Onboarding" }],
        });

        BackHandler.exitApp();
      } catch (error) {
        console.error(`Logout Error (Attempt ${retryCount + 1}):`, error);

        if (retryCount < maxRetries) {
          console.log(`Retrying logout in 4 seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

          setTimeout(() => {
            handleLogout(retryCount + 1, maxRetries);
          }, 4000);
        } else {
          const errorMessage =
            error?.response?.data?.message && error?.response?.data?.message !== "undefined"
              ? error.response.data.message
              : "Please try again. If you have an ongoing ride, please complete it first.";

          Alert.alert("Unable to Logout", errorMessage, [
            {
              text: "Try Again",
              onPress: () => handleLogout(0, maxRetries),
            },
            {
              text: "Force Logout",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Onboarding" }],
                });
              },
            },
          ]);
        }
      } finally {
        setLoading(false);
        setMenuVisible(false);
      }
    },
    [navigation, user_data]
  );

  // Toggle online/offline status
  const toggleOnlineStatus = useCallback(async () => {
    try {
      console.log("Toggling online status, current status:", isOnline);
      setLoading(true);

      const expireDate = new Date(user_data?.RechargeData?.expireData);
      const currentDate = new Date();
      const goingOnline = !isOnline;

      console.log("Setting status to:", goingOnline, "type:", typeof goingOnline);

      // Check recharge expiry when going online
      if (goingOnline && expireDate < currentDate) {
        Alert.alert(
          "Recharge Expired",
          "You have been set to offline due to expired recharge.",
          [
            {
              text: "Recharge Now",
              style: "default",
              onPress: () => navigation.navigate("Recharge", {
                showOnlyBikePlan:
                  user_data?.rideVehicleInfo?.vehicleName === "2 Wheeler" ||
                  user_data?.rideVehicleInfo?.vehicleName === "Bike",
                role: user_data?.category,
                firstRecharge: user_data?.isFirstRechargeDone || false,
              }),
            },
            {
              text: "Cancel",
              style: "cancel",
            },
          ]
        );
        setLoading(false);
        return;
      }

      // Toggle status API call
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/toggleWorkStatusOfRider`,
        {
          method: 'POST',
          data: { status: goingOnline },
        }
      );

      // Refresh user data
      await fetchUserDetails();

      if (response.data.success) {
        const newStatus = response.data.cabRider?.status === "online";
        console.log("New status from API:", response.data.cabRider?.status);

        setIsOnline(newStatus);
        navigation.replace('Home');
        // Animate the status change
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.7,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      console.error(
        "Toggle Status Error:",
        error?.response?.data?.message || error.message
      );

      Alert.alert(
        "Toggle Status Failed",
        error?.response?.data?.message || "Something went wrong",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  }, [isOnline, user_data, navigation, makeAuthenticatedRequest, fadeAnim]);

  // Fetch user details
  const fetchUserDetails = useCallback(async () => {
    try {
      console.log("Fetching user details");

      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user-details`);

      if (response.data.partner) {
        console.log("User details fetched successfully");
        setUserData(response.data.partner);

        const isAvailable = response.data.partner.isAvailable === true;
        setIsOnline(isAvailable);
        console.log("Setting isOnline to:", isAvailable, "type:", typeof isAvailable);

        const userId = response?.data?.partner?._id ? String(response.data.partner._id) : "";
        console.log("Initializing socket with userId:", userId);

        // await initializeSocket({ userId });
        return response.data.partner;
      }
    } catch (error) {
      console.error(
        "Error fetching user details:",
        error?.response?.data?.message || error.message
      );
    }
  }, [makeAuthenticatedRequest]);

  // Fetch active ride details
  const fetchActiveRideDetails = useCallback(async () => {
    try {
      if (user_data?.on_ride_id) {
        console.log("Fetching ride details for ride ID:", user_data.on_ride_id);

        const response = await axios.get(
          `http://192.168.1.6:3100/rider/${user_data.on_ride_id}`
        );

        if (response.data) {

          setActiveRideData(response.data);
        }
      } else {
        setActiveRideData(null);
      }
    } catch (error) {
      console.error(
        "Error fetching ride details:",
        error?.response?.data || error.message
      );
      setActiveRideData(null);
    }
  }, [user_data?.on_ride_id]);

  // Refresh dashboard
  const onSoftRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchUserDetails();
      await fetchActiveRideDetails();

      // Show success feedback
      Alert.alert(
        "Dashboard Refreshed",
        "Your dashboard has been updated successfully.",
        [{ text: "OK" }]
      );
    } catch (error) {
      Alert.alert(
        "Refresh Failed",
        "Unable to refresh dashboard. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [fetchUserDetails, fetchActiveRideDetails]);

  // Initialize data on component mount
  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  // Effect to check for active rides when user data changes
useEffect(() => {
  let interval;

  if (user_data) {
    console.log("✅ User data available, starting interval to fetch active ride details");

    // Immediately fetch once
    fetchActiveRideDetails();

    // Set interval to run every 4 seconds
    interval = setInterval(() => {
      console.log("⏱️ Fetching active ride details every 4 seconds");
      fetchActiveRideDetails();
    }, 4000);
  }

  // Cleanup on unmount or when user_data changes
  return () => {
    if (interval) {
      console.log("🧹 Clearing interval");
      clearInterval(interval);
    }
  };
}, [user_data, fetchActiveRideDetails]);




  // Handle active ride button press
  const handleActiveRidePress = useCallback(() => {
    if (activeRideData) {
      // Navigate to active ride screen
      navigation.navigate('start', { rideData: user_data?.on_ride_id });
    }
  }, [activeRideData, navigation]);

  // Handle notification press
  const handleNotificationPress = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  // Menu component with enhanced styling
  const Menu = useMemo(() => {
    if (!menuVisible) return null;

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHandle} />

            <View style={styles.menuHeader}>
              <Text style={styles.menuHeaderText}>Driver Menu</Text>
              <TouchableOpacity
                onPress={() => setMenuVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("Profile");
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.red50 }]}>
                <MaterialCommunityIcons
                  name="account"
                  size={20}
                  color={colors.red400}
                />
              </View>
              <Text style={styles.menuText}>Profile</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate("Recharge", {
                  showOnlyBikePlan:
                    user_data?.rideVehicleInfo?.vehicleName === "2 Wheeler" ||
                    user_data?.rideVehicleInfo?.vehicleName === "Bike",
                  role: user_data?.category,
                  firstRecharge: user_data?.isFirstRechargeDone || false,
                });
              }}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.red50 }]}>
                <MaterialCommunityIcons
                  name="wallet"
                  size={20}
                  color={colors.red400}
                />
              </View>
              <Text style={styles.menuText}>Recharge</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                onSoftRefresh();
              }}
              disabled={refreshing}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.red50 }]}>
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.red400} />
                ) : (
                  <MaterialCommunityIcons
                    name="refresh"
                    size={20}
                    color={colors.red400}
                  />
                )}
              </View>
              <Text style={styles.menuText}>
                {refreshing ? 'Refreshing...' : 'Refresh Dashboard'}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              disabled={loading}
            >
              <View style={[styles.menuIcon, { backgroundColor: colors.red100 }]}>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.red500} />
                ) : (
                  <MaterialCommunityIcons
                    name="logout"
                    size={20}
                    color={colors.red500}
                  />
                )}
              </View>
              <Text style={[styles.menuText, { color: colors.red500 }]}>
                {loading ? 'Logging out...' : 'Logout'}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={colors.red500}
              />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    );
  }, [menuVisible, navigation, handleLogout, onSoftRefresh, user_data, loading, refreshing]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Left side - Logo/Title */}
        <View style={styles.leftSection}>
          <Text style={styles.appTitle}>Olyox</Text>
          <Text style={styles.appSubtitle}>Driver</Text>
        </View>

        {/* Center - Online/Offline Switch */}

        {!activeRideData ? (
          <Animated.View style={[styles.centerSection, { opacity: fadeAnim }]}>
            <View style={styles.statusContainer}>
              <View style={[
                styles.statusIndicator,
                { backgroundColor: isOnline ? colors.success : colors.red300 }
              ]} />
              <Text style={[
                styles.statusText,
                { color: isOnline ? colors.success : colors.red400 }
              ]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <Switch
              trackColor={{
                false: colors.red100,
                true: colors.success
              }}
              thumbColor={isOnline ? colors.backgroundPaper : colors.red200}
              ios_backgroundColor={colors.red100}
              onValueChange={toggleOnlineStatus}
              value={isOnline}
              disabled={loading}
            />
            {/* Notification Bell */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleNotificationPress}
            >
              <FontAwesome
                name="bell"
                size={18}
                color={colors.red400}
              />
            </TouchableOpacity>

            {/* Menu Button */}
            <TouchableOpacity
              style={[styles.iconButton, styles.menuButton]}
              onPress={() => setMenuVisible(true)}
            >
              <FontAwesome
                name="bars"
                size={18}
                color={colors.textLight}
              />
            </TouchableOpacity>
          </Animated.View>
        ) : (

          <View style={styles.rightSection}>
            {/* Active Ride Button */}
            {activeRideData && (
              <>
                <TouchableOpacity
                  style={styles.activeRideButton}
                  onPress={handleActiveRidePress}
                >
                  <MaterialCommunityIcons
                    name="car-speed-limiter"
                    size={16}
                    color={colors.textLight}
                  />
                  <Text style={styles.activeRideText}>Active</Text>
                  <View style={styles.pulseDot} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleNotificationPress}
                >
                  <FontAwesome
                    name="bell"
                    size={18}
                    color={colors.red400}
                  />
                </TouchableOpacity>

                {/* Menu Button */}
                <TouchableOpacity
                  style={[styles.iconButton, styles.menuButton]}
                  onPress={() => setMenuVisible(true)}
                >
                  <FontAwesome
                    name="bars"
                    size={18}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
              </>



            )}


          </View>
        )}



      </View>

      {Menu}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundPaper,

    shadowColor: colors.textDark,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4.65,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.backgroundPaper,
  },
  leftSection: {
    flex: 1,
  },
  centerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.red400,
  },
  appSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.red400,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    position: 'relative',
  },
  activeRideText: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pulseDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red200,
  },
  iconButton: {
    padding: 10,
    marginLeft: 4,
    borderRadius: 8,
  },
  menuButton: {
    backgroundColor: colors.red400,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.backgroundOverlay,
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: colors.backgroundPaper,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingBottom: 35,
    maxHeight: '70%',
  },
  menuHandle: {
    width: 50,
    height: 5,
    backgroundColor: colors.red200,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.red400,
  },
  closeButton: {
    padding: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 18,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: 25,
    marginVertical: 5,
  },
});

export default HeaderNew;