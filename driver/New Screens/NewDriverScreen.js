import React, { useState, useCallback, useEffect } from 'react';
import {
  AppState,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
  View,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useKeepAwake } from 'expo-keep-awake';

import RiderDataAndRechargeInfo from './components/HomeScreen/RiderDataAndRechargeInfo';
import RideSearching from './components/HomeScreen/RideSearching';
import Report from '../screens/Report/Report';
import Bonus from '../screens/Bonus/Bonus';
import useLocationTracking from '../hooks/useLocationTracking';
import useNotificationPermission from '../hooks/notification';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useFetchUserDetails } from '../hooks/New Hookes/RiderDetailsHooks';
import HeaderNew from './components/Header/HeaderNew';
import NotificationPermissionModal from '../NotificationPermissionModal';

const urlForUpdateFcmToken = `https://www.appv2.olyox.com/api/v1/rider/update-fcm`;

export default function NewHomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { fcmToken: currentToken, isGranted, requestPermission } = useNotificationPermission();
  const { fetchUserDetails: reCallMe } = useFetchUserDetails();

  useKeepAwake();

  // Location tracking hook
  const {
    currentLocation,
    isTracking,
    error,
    appState,
    backgroundTaskStatus,
    startLocationTracking,
    stopLocationTracking,
    testBackgroundTask,
    checkBackgroundTaskStatus,
  } = useLocationTracking();

  // Setup FCM token
  const setupFCMToken = async () => {
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab");
      if (!token || !currentToken) {
        console.log('Missing tokens - Auth:', !!token, 'FCM:', !!currentToken);
        return;
      }

      const response = await axios.post(
        urlForUpdateFcmToken,
        {
          fcmToken: currentToken,
          platform: Platform.OS,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        console.log('✅ FCM token updated successfully');
      } else {
        console.error('❌ Unexpected FCM response:', response.status);
      }
    } catch (error) {
      console.error('❌ FCM token setup error:', error?.response?.data || error.message);
    }
  };

  // Setup notification channels
  const setupNotificationChannels = async () => {
    if (Platform.OS === 'android') {
      try {
        // Default channel
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default Channel',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        // Ride channel with custom sound
        await Notifications.setNotificationChannelAsync('ride_channel', {
          name: 'Ride Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#00FF00',
          sound: 'sound.mp3', // Custom sound file
          showBadge: true,
          enableLights: true,
          enableVibrate: true,
          description: 'Notifications for new ride requests',
        });

        console.log('✅ Notification channels created successfully');
      } catch (error) {
        console.error('❌ Error creating notification channels:', error);
      }
    }
  };

  // Initialize location tracking safely
  const initializeLocationTracking = useCallback(async () => {
    if (isTracking) {
      console.log('Location tracking already active');
      return;
    }

    try {
      console.log('Starting location tracking...');
      await startLocationTracking();
      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('❌ Location tracking error:', error);
      // Only show alert if it's a critical error, not permission issues
      if (error.message && !error.message.includes('permission')) {
        Alert.alert(
          'Location Error',
          'Could not start location tracking. Please check your settings.',
          [{ text: 'OK' }]
        );
      }
    }
  }, [isTracking, startLocationTracking]);

  // Setup notification channels
  useEffect(() => {
    setupNotificationChannels();
  }, []);

  // Initialize app once on mount
  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      if (isInitialized || !mounted) return;

      try {
        console.log('Initializing app...');

        // Setup notification channels
        await setupNotificationChannels();

        // Setup FCM token
        await setupFCMToken();

        // Initialize location tracking
        await initializeLocationTracking();

        if (mounted) {
          setIsInitialized(true);
          console.log('✅ App initialized successfully');
        }
      } catch (error) {
        console.error('❌ App initialization error:', error);
        if (mounted) {
          setIsInitialized(true); // Mark as initialized even on error to prevent loops
        }
      }
    };

    initializeApp();

    return () => {
      mounted = false;
    };
  }, [isInitialized, initializeLocationTracking]);

  // Handle app state changes for location tracking
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'background') {
        console.log('App backgrounded - location tracking continues');
      } else if (nextAppState === 'active') {
        console.log('App active - checking location tracking status');
        if (!isTracking) {
          initializeLocationTracking();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isTracking, initializeLocationTracking]);

  // Pull-to-refresh handler - simplified to prevent infinite loops
  const onRefresh = useCallback(async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes

    setRefreshing(true);

    try {
      console.log('Refreshing app data...');

      // Refresh user details
      await reCallMe();

      // Refresh FCM token
      await setupFCMToken();

      // Restart location tracking if not active
      if (!isTracking) {
        await initializeLocationTracking();
      }

      console.log('✅ Refresh completed');
    } catch (error) {
      console.error('❌ Refresh error:', error);
      Alert.alert(
        'Refresh Failed',
        'Could not refresh data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, isTracking, reCallMe, initializeLocationTracking]);

  if (!isGranted) {
    return <NotificationPermissionModal visible={true} autoClose={isGranted} onRetry={requestPermission} permissionGranted={isGranted} refreshNavigation={isGranted} />
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderNew
        isRefresh={refreshing}
        isLocationTracking={isTracking}
        currentLocation={currentLocation}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0d6efd']}
          />
        }
      >
        <RideSearching
          refreshing={refreshing}
          isLocationTracking={isTracking}
          currentLocation={currentLocation}
        />
        <RiderDataAndRechargeInfo refreshing={refreshing} />
        <Report isRefresh={refreshing} />
        <Bonus />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    padding: 8,
    paddingBottom: 32,
  },
  locationContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 12,
    textAlign: 'center',
  },
  locationDetails: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 6,
    lineHeight: 20,
  },
  locationLabel: {
    fontWeight: '600',
    color: '#343a40',
  },
  errorText: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});