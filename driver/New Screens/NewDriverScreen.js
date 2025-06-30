import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
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
import * as Updates from 'expo-updates';
import { useKeepAwake } from 'expo-keep-awake';
import BackgroundService from 'react-native-background-actions';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';

import HeaderNew from './components/Header/HeaderNew';
import RiderDataAndRechargeInfo from './components/HomeScreen/RiderDataAndRechargeInfo';
import RideSearching from './components/HomeScreen/RideSearching';
import Report from '../screens/Report/Report';
import Bonus from '../screens/Bonus/Bonus';
import useLocationTracking from '../hooks/useLocationTracking';
import useNotificationPermission from '../hooks/notification';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const urlForUpdateFcmToken = `https://www.appv2.olyox.com/api/v1/rider/update-fcm`;

// AsyncStorage keys
const ASYNC_KEYS = {
  FCM_TOKEN: 'fcm_token',
  NOTIFICATION_SETUP_DONE: 'notification_setup_done',
  BACKGROUND_TASK_SETUP: 'background_task_setup',
};

// Background task configuration
const veryIntensiveTask = async (taskDataArguments) => {
  const { delay } = taskDataArguments;
  await new Promise(async (resolve) => {
    for (let i = 0; BackgroundService.isRunning(); i++) {
      console.log('🔄 Background task running:', i);
      
      // Perform background operations here
      // For example: location updates, API calls, etc.
      
      await BackgroundService.updateNotification({
        taskName: 'Ride Tracking',
        taskTitle: 'Tracking your location...',
        taskDesc: `Background task running: ${i}`,
        taskIcon: {
          name: 'ic_launcher',
          type: 'mipmap',
        },
        progressBar: {
          max: 100,
          value: (i % 100),
          indeterminate: false,
        },
      });
      
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  });
};

const backgroundOptions = {
  taskName: 'RideTracking',
  taskTitle: 'Ride Tracking Active',
  taskDesc: 'Tracking your location for ride requests',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#ff00ff',
  linkingURI: 'yourSchemeHere://chat/jane',
  parameters: {
    delay: 10000, // 10 seconds
  },
};

export default function NewHomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [locationStarted, setLocationStarted] = useState(false);
  const [notificationSetupDone, setNotificationSetupDone] = useState(false);
  
  // Refs to prevent re-rendering
  const fcmTokenSentRef = useRef(false);
  const backgroundTaskInitialized = useRef(false);
  const notifeeInitialized = useRef(false);
  
  const { fcmToken: currentToken, isGranted } = useNotificationPermission();
  
  useKeepAwake();

  // Memoize location tracking hook to prevent re-initialization
  const locationTracking = useLocationTracking();
  const {
    currentLocation,
    isTracking,
    error,
    appState,
    startLocationTracking,
    stopLocationTracking,
  } = locationTracking;

  // Setup Notifee (replace Expo Notifications)
  const setupNotifee = useCallback(async () => {
    if (notifeeInitialized.current) return;
    
    try {
      // Request permissions
      await notifee.requestPermission();

      // Create notification channel
      await notifee.createChannel({
        id: 'ride-requests',
        name: 'Ride Requests',
        description: 'High priority ride request notifications',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
      });

      console.log('✅ Notifee setup completed');
      notifeeInitialized.current = true;
      setNotificationSetupDone(true);
      
      // Store setup completion
      await AsyncStorage.setItem(ASYNC_KEYS.NOTIFICATION_SETUP_DONE, 'true');
    } catch (error) {
      console.error('❌ Error setting up Notifee:', error);
    }
  }, []);

  // Setup FCM token (memoized to prevent re-execution)
  const setupFCMToken = useCallback(async () => {
    if (!currentToken || fcmTokenSentRef.current) return;
    
    try {
      const token = await SecureStore.getItemAsync("auth_token_cab");
      if (!token) {
        throw new Error('No authentication token found');
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
        console.log('✅ FCM token updated successfully on server');
        fcmTokenSentRef.current = true;
        await AsyncStorage.setItem(ASYNC_KEYS.FCM_TOKEN, currentToken);
      } else {
        throw new Error('Failed to update FCM token on server');
      }
    } catch (error) {
      console.error('❌ Error setting up FCM token:', error?.response?.data || error.message);
      fcmTokenSentRef.current = false;
    }
  }, [currentToken]);

  // Initialize background service
  const initializeBackgroundService = useCallback(async () => {
    if (backgroundTaskInitialized.current) return;
    
    try {
      // Check if already setup
      const setupDone = await AsyncStorage.getItem(ASYNC_KEYS.BACKGROUND_TASK_SETUP);
      if (setupDone === 'true') {
        backgroundTaskInitialized.current = true;
        return;
      }

      console.log('🔧 Initializing background service...');
      backgroundTaskInitialized.current = true;
      await AsyncStorage.setItem(ASYNC_KEYS.BACKGROUND_TASK_SETUP, 'true');
    } catch (error) {
      console.error('❌ Error initializing background service:', error);
    }
  }, []);

  // Handle app state changes (optimized)
  const handleAppStateChange = useCallback(async (nextAppState) => {
    try {
      if (nextAppState === 'background' && !BackgroundService.isRunning()) {
        console.log('📱 App went to background, starting background task');
        await BackgroundService.start(veryIntensiveTask, backgroundOptions);
      } else if (nextAppState === 'active' && BackgroundService.isRunning()) {
        console.log('📱 App returned to active, stopping background task');
        await BackgroundService.stop();
      }
    } catch (error) {
      console.warn('❌ Background service error:', error);
    }
  }, []);

  // Initialize app (run once)
  useEffect(() => {
    let mounted = true;
    
    const initializeApp = async () => {
      if (!mounted) return;
      
      try {
        await setupNotifee();
        await initializeBackgroundService();
        
        // Setup FCM token when available
        if (currentToken && isGranted) {
          await setupFCMToken();
        }
      } catch (error) {
        console.error('❌ App initialization error:', error);
      }
    };

    initializeApp();
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - run once

  // Handle FCM token updates
  useEffect(() => {
    if (currentToken && isGranted && !fcmTokenSentRef.current) {
      setupFCMToken();
    }
  }, [currentToken, isGranted, setupFCMToken]);

  // App state listener (optimized)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      if (BackgroundService.isRunning()) {
        BackgroundService.stop().catch((e) => 
          console.warn('❌ Failed to stop background task:', e)
        );
      }
    };
  }, [handleAppStateChange]);

  // Location tracking initialization (optimized)
  useEffect(() => {
    let mounted = true;

    const initLocationTracking = async () => {
      if (!locationStarted && mounted && isGranted) {
        try {
          await startLocationTracking();
          setLocationStarted(true);
          console.log('✅ Location tracking started');
        } catch (err) {
          if (mounted) {
            console.error('❌ Location tracking error:', err);
            Alert.alert(
              'Location Error',
              'Could not start tracking. Please check permissions.',
              [{ text: 'OK' }]
            );
          }
        }
      }
    };

    initLocationTracking();

    return () => {
      mounted = false;
    };
  }, [isGranted]); // Only depend on permission status

  // Handle location tracking state changes
  useEffect(() => {
    if (appState === 'active' && locationStarted && !isTracking) {
      console.log('🔄 Restarting location tracking...');
      startLocationTracking().catch(console.error);
    }
  }, [appState, isTracking, locationStarted, startLocationTracking]);

  // Handle location errors
  useEffect(() => {
    if (error) {
      Alert.alert('Location Issue', error, [
        {
          text: 'Retry',
          onPress: () => startLocationTracking().catch(console.error),
        },
        { text: 'Cancel' },
      ]);
    }
  }, [error, startLocationTracking]);

  // Pull-to-refresh handler (memoized)
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await stopLocationTracking();
      await Updates.reloadAsync();
    } catch (e) {
      console.error('❌ Reload failed:', e);
      if (locationStarted) {
        await startLocationTracking();
      }
    } finally {
      setRefreshing(false);
    }
  }, [locationStarted, stopLocationTracking, startLocationTracking]);

  // Memoize header props to prevent re-renders
  const headerProps = useMemo(() => ({
    isRefresh: refreshing,
    isLocationTracking: isTracking,
    currentLocation: currentLocation,
  }), [refreshing, isTracking, currentLocation]);

  // Memoize ride searching props
  const rideSearchingProps = useMemo(() => ({
    refreshing,
    isLocationTracking: isTracking,
    currentLocation,
  }), [refreshing, isTracking, currentLocation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <HeaderNew {...headerProps} />
      
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
        <RideSearching {...rideSearchingProps} />
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
  debugInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 8,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
});