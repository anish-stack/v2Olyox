import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  Linking,
  StatusBar,
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

const API_BASE_URL = 'https://www.appv2.olyox.com/api/v1/rider';
const NOTIFICATION_SOUND_URL = 'http://olyox.in/sound/';

// Memoized components to prevent re-renders
const StatusIndicator = React.memo(({ isOnline, loading }) => (
  <View style={styles.statusContainer}>
    <View style={styles.statusWrapper}>
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor: loading ? colors.gray400 : (isOnline ? '#00C851' : '#FF4444'),
            shadowColor: loading ? colors.gray400 : (isOnline ? '#00C851' : '#FF4444'),
          },
        ]}
      />
      <Text style={[styles.statusText, { color: loading ? colors.gray600 : colors.textPrimary }]}>
        {loading ? 'Updating...' : (isOnline ? 'Online' : 'Offline')}
      </Text>
    </View>
  </View>
));

const ActiveRideButton = React.memo(({ onPress, activeRideData }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (!activeRideData ||
    (activeRideData?.data?.ride_status === 'completed' &&
      activeRideData?.data?.payment_status === 'completed')) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.activeRideButton} onPress={onPress}>
      <Animated.View style={[styles.pulseContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.activeRideContent}>
          <MaterialCommunityIcons name="car" size={16} color="#FFFFFF" />
          <Text style={styles.activeRideText}>ACTIVE RIDE</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const HeaderButton = React.memo(({ icon, onPress, style, iconColor = colors.textSecondary }) => (
  <TouchableOpacity style={[styles.headerButton, style]} onPress={onPress}>
    <FontAwesome name={icon} size={20} color={iconColor} />
  </TouchableOpacity>
));

const MenuModal = React.memo(({
  visible,
  onClose,
  onLogout,
  onRefresh,
  onNavigate,
  loading,
  refreshing,
  userData
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const menuItems = useMemo(() => [
    {
      id: 'profile',
      icon: 'account-circle',
      title: 'Profile',
      color: '#4285F4',
      onPress: () => onNavigate('Profile'),
    },
    {
      id: 'notifications',
      icon: 'bell-outline',
      title: 'Notification Settings',
      color: '#FF9800',
      onPress: async () => await Linking.openURL(NOTIFICATION_SOUND_URL),
    },
    {
      id: 'recharge',
      icon: 'wallet-outline',
      title: 'Recharge Wallet',
      color: '#4CAF50',
      onPress: () => onNavigate('Recharge', {
        showOnlyBikePlan: userData?.rideVehicleInfo?.vehicleName === "2 Wheeler" ||
          userData?.rideVehicleInfo?.vehicleName === "Bike",
        role: userData?.category,
        firstRecharge: userData?.isFirstRechargeDone || false,
      }),
    },
    {
      id: 'refresh',
      icon: 'refresh',
      title: refreshing ? 'Refreshing...' : 'Refresh Dashboard',
      color: '#2196F3',
      onPress: onRefresh,
      disabled: refreshing,
      loading: refreshing,
    },
    {
      id: 'help',
      icon: 'help-circle',
      title: 'Help',
      color: '#4285F4',
      onPress: () => onNavigate('support'),
    }
  ], [refreshing, userData, onNavigate, onRefresh]);

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.menuHandle} />

          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuContent}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, item.disabled && styles.menuItemDisabled]}
                onPress={item.onPress}
                disabled={item.disabled}
              >
                <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
                  {item.loading ? (
                    <ActivityIndicator size="small" color={item.color} />
                  ) : (
                    <MaterialCommunityIcons name={item.icon} size={22} color={item.color} />
                  )}
                </View>
                <Text style={styles.menuItemText}>{item.title}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={[styles.menuItem, styles.logoutItem]}
              onPress={onLogout}
              disabled={loading}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#FF444415' }]}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FF4444" />
                ) : (
                  <MaterialCommunityIcons name="logout" size={22} color="#FF4444" />
                )}
              </View>
              <Text style={[styles.menuItemText, { color: '#FF4444' }]}>
                {loading ? 'Logging out...' : 'Logout'}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#FF4444" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const HeaderNew = React.memo(({ isRefresh }) => {
  const navigation = useNavigation();
  const { fetchUserDetails: reCallMe } = useFetchUserDetails();

  // Consolidated state
  const [state, setState] = useState({
    userData: null,
    isOnline: false,
    activeRideData: null,
    menuVisible: false,
    loading: false,
    refreshing: false,
  });

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef(null);

  // Memoized API helper
  const makeAuthenticatedRequest = useCallback(async (url, options = {}) => {
    const token = await SecureStore.getItemAsync("auth_token_cab");
    if (!token) throw new Error('No authentication token found');

    return axios({
      ...options,
      url,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
  }, []);

  // Optimized state updater
  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Fetch user details with error handling
  const fetchUserDetails = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/user-details`);
      if (response.data.partner) {
        const userData = response.data.partner;
        const isOnline = userData.isAvailable === true;

        updateState({
          userData,
          isOnline,
          loading: false
        });

        return userData;
      }
    } catch (error) {
      console.error('Error fetching user details:', error?.response?.data?.message || error.message);
      updateState({ loading: false });
    }
  }, [makeAuthenticatedRequest, updateState]);

  // Fetch active ride details
  const fetchActiveRideDetails = useCallback(async () => {
    try {
      if (state.userData?.on_ride_id) {
        const response = await axios.get(`https://www.appv2.olyox.com/rider/${state.userData.on_ride_id}`);
        if (response.data) {
          updateState({ activeRideData: response.data });
        }
      } else {
        updateState({ activeRideData: null });
      }
    } catch (error) {
      console.error('Error fetching ride details:', error?.response?.data || error.message);
      updateState({ activeRideData: null });
    }
  }, [state.userData?.on_ride_id, updateState]);

  // Optimized refresh function
  const handleRefresh = useCallback(async () => {
    if (state.refreshing) return;

    try {
      updateState({ refreshing: true });
      await Promise.all([
        fetchUserDetails(),
        fetchActiveRideDetails(),
        reCallMe()
      ]);

      Alert.alert("Success", "Dashboard refreshed successfully", [{ text: "OK" }]);
    } catch (error) {
      Alert.alert("Error", "Failed to refresh dashboard", [{ text: "OK" }]);
    } finally {
      updateState({ refreshing: false });
    }
  }, [state.refreshing, fetchUserDetails, fetchActiveRideDetails, reCallMe, updateState]);

  // Toggle online status
  const toggleOnlineStatus = useCallback(async () => {
    if (state.loading) return;

    try {
      updateState({ loading: true });

      const expireDate = new Date(state.userData?.RechargeData?.expireData);
      const currentDate = new Date();
      const goingOnline = !state.isOnline;

      if (goingOnline && expireDate < currentDate) {
        Alert.alert("Recharge Expired", "Please recharge to go online", [
          {
            text: "Recharge Now",
            onPress: () => navigation.navigate("Recharge", {
              showOnlyBikePlan: state.userData?.rideVehicleInfo?.vehicleName === "2 Wheeler" ||
                state.userData?.rideVehicleInfo?.vehicleName === "Bike",
              role: state.userData?.category,
              firstRecharge: state.userData?.isFirstRechargeDone || false,
            }),
          },
          { text: "Cancel", style: "cancel" },
        ]);
        updateState({ loading: false });
        return;
      }

      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/toggleWorkStatusOfRider`, {
        method: 'POST',
        data: { status: goingOnline },
      });

      if (response.data.success) {
        const newStatus = response.data.cabRider?.status === "online";
        updateState({ isOnline: newStatus, loading: false });

        // Animate status change
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.7, duration: 200, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        navigation.replace('Home');
      }
    } catch (error) {
      console.error('Toggle Status Error:', error?.response?.data?.message || error.message);
      Alert.alert("Error", error?.response?.data?.message || "Failed to toggle status");
      updateState({ loading: false });
    }
  }, [state.loading, state.isOnline, state.userData, makeAuthenticatedRequest, updateState, fadeAnim, navigation]);

  // Enhanced logout with retry logic
  const handleLogout = useCallback(async (retryCount = 0, maxRetries = 3) => {
    try {
      updateState({ loading: true });

      await SecureStore.deleteItemAsync("auth_token_cab");

      if (!state.userData?._id) {
        navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
        return;
      }

      if (state.isOnline) {
        await toggleOnlineStatus();
      }

      await axios.get(`${API_BASE_URL}/rider-logout/${state.userData._id}`);

      navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
      BackHandler.exitApp();
    } catch (error) {
      console.error(`Logout Error (Attempt ${retryCount + 1}):`, error);

      if (retryCount < maxRetries) {
        setTimeout(() => handleLogout(retryCount + 1, maxRetries), 2000);
      } else {
        Alert.alert("Logout Failed", "Please try again or force logout", [
          { text: "Try Again", onPress: () => handleLogout(0, maxRetries) },
          {
            text: "Force Logout",
            onPress: () => navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] })
          },
        ]);
      }
    } finally {
      updateState({ loading: false, menuVisible: false });
    }
  }, [state.userData, state.isOnline, navigation, toggleOnlineStatus, updateState]);

  // Navigation handler
  const handleNavigation = useCallback((screen, params) => {
    updateState({ menuVisible: false });
    navigation.navigate(screen, params);
  }, [navigation, updateState]);

  // Initialize data
  useEffect(() => {
    fetchUserDetails();
  }, []);

  // Handle refresh prop
  useEffect(() => {
    if (isRefresh === true) {
      handleRefresh();
    }
  }, [isRefresh, handleRefresh]);

  // Active ride polling
  useEffect(() => {
    const currentRouteName = navigation.getState()?.routes?.[navigation.getState().index]?.name;
    const shouldPoll = state.userData?.on_ride_id && currentRouteName === 'Home';

    if (shouldPoll) {
      fetchActiveRideDetails();
      intervalRef.current = setInterval(fetchActiveRideDetails, 15000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.userData?.on_ride_id, fetchActiveRideDetails, navigation]);

  // Memoized handlers
  const handleActiveRidePress = useCallback(() => {
    if (state.activeRideData) {
      navigation.navigate('start', { rideData: state.userData?.on_ride_id });
    }
  }, [state.activeRideData, state.userData?.on_ride_id, navigation]);

  const handleNotificationPress = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.header}>
          {/* Left Section - App Branding */}
          <View style={styles.leftSection}>
            <Text style={styles.appTitle}>Olyox</Text>
            <Text style={styles.appSubtitle}>Driver</Text>
          </View>

          {/* Center/Right Section */}
          <View style={styles.rightSection}>
            {!state.activeRideData ? (
              // Online/Offline Controls
              <Animated.View style={[styles.statusSection, { opacity: fadeAnim }]}>
                <StatusIndicator isOnline={state.isOnline} loading={state.loading} />
                <Switch
                  trackColor={{ false: '#E0E0E0', true: '#00C851' }}
                  thumbColor={state.isOnline ? '#FFFFFF' : '#F4F4F4'}
                  ios_backgroundColor="#E0E0E0"
                  onValueChange={toggleOnlineStatus}
                  value={state.isOnline}
                  disabled={state.loading}
                  style={styles.switch}
                />
              </Animated.View>
            ) : (
              // Active Ride Button
              <ActiveRideButton
                onPress={handleActiveRidePress}
                activeRideData={state.activeRideData}
              />
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <HeaderButton
                icon="bell"
                onPress={handleNotificationPress}
                iconColor={colors.textSecondary}
              />
              <HeaderButton
                icon="bars"
                onPress={() => updateState({ menuVisible: true })}
                style={styles.menuButton}
                iconColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Menu Modal */}
        <MenuModal
          visible={state.menuVisible}
          onClose={() => updateState({ menuVisible: false })}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
          onNavigate={handleNavigation}
          loading={state.loading}
          refreshing={state.refreshing}
          userData={state.userData}
        />
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  leftSection: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
    marginTop: -2,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statusContainer: {
    marginRight: 12,
  },
  statusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  activeRideButton: {
    marginRight: 12,
  },
  pulseContainer: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#FF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  activeRideContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeRideText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#F8F8F8',
  },
  menuButton: {
    backgroundColor: '#1A1A1A',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  menuContent: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 24,
    marginVertical: 8,
  },
  logoutItem: {
    marginTop: 8,
  },
});

export default HeaderNew;