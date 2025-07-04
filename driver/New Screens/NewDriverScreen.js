import React, { useState, useCallback, useEffect } from 'react';
import {
  AppState,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
  Linking,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useKeepAwake } from 'expo-keep-awake';
import BackgroundService from 'react-native-background-actions';
import HeaderNew from './components/Header/HeaderNew';
import RiderDataAndRechargeInfo from './components/HomeScreen/RiderDataAndRechargeInfo';
import RideSearching from './components/HomeScreen/RideSearching';
import Report from '../screens/Report/Report';
import Bonus from '../screens/Bonus/Bonus';
import useLocationTracking from '../hooks/useLocationTracking';
import useNotificationPermission from '../hooks/notification';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { useFetchUserDetails } from '../hooks/New Hookes/RiderDetailsHooks';

const urlForUpdateFcmToken = `https://www.appv2.olyox.com/api/v1/rider/update-fcm`;
const NOTIFICATION_SOUND_URL = 'http://olyox.in/sound/'; // Replace with your sound URL

// AsyncStorage keys
const ASYNC_KEYS = {
  FCM_TOKEN: 'fcm_token',
  NOTIFICATION_SETUP_DONE: 'notification_setup_done',
  NOTIFICATION_SOUND_DOWNLOADED: 'notification_sound_downloaded',
};


// Task options
const options = {
  taskName: 'LiveLocationTracking',
  taskTitle: 'Live Tracking Enabled',
  taskDesc: 'We are tracking your ride...',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#00aaa9',
  linkingURI: 'yourSchemeHere://home',
  parameters: {
    delay: 1000,
  },
};

export default function NewHomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [locationStarted, setLocationStarted] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [notificationSetupDone, setNotificationSetupDone] = useState(false);
  const [showNotificationSetup, setShowNotificationSetup] = useState(false);
  const { fcmToken: currentToken } = useNotificationPermission()
    const { fetchUserDetails: reCallMe } = useFetchUserDetails();
  
  useKeepAwake();

  // Check if notification setup is done
  const checkNotificationSetup = async () => {
    try {
      const setupDone = await AsyncStorage.getItem(ASYNC_KEYS.NOTIFICATION_SETUP_DONE);
      if (setupDone === 'true') {
        setNotificationSetupDone(true);
      } else {
        setShowNotificationSetup(true);
      }

    } catch (error) {
      console.error('Error checking notification setup:', error);
      setShowNotificationSetup(true);
    }
  };



  // Get FCM token and send to server
  const setupFCMToken = async () => {
    try {
    const token = await SecureStore.getItemAsync("auth_token_cab");
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('Auth Token:', token);
    console.log('FCM Token:', currentToken);

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
    } else {
      console.error('❌ Unexpected response:', response.status, response.data);
      throw new Error('Failed to update FCM token on server');
    }

  } catch (error) {
    console.error('❌ Error setting up FCM token for user:', error?.response?.data || error.message);
    // Optionally alert the user here
  }
  };

  // Download notification sound
  const downloadNotificationSound = async () => {
    try {
      // Check if sound is already downloaded
      const soundDownloaded = await AsyncStorage.getItem(ASYNC_KEYS.NOTIFICATION_SOUND_DOWNLOADED);

      if (soundDownloaded !== 'true') {
        // Open download link
        await Linking.openURL(NOTIFICATION_SOUND_URL);

        // Mark as downloaded (user will need to manually set it)
        await AsyncStorage.setItem(ASYNC_KEYS.NOTIFICATION_SOUND_DOWNLOADED, 'true');

        Alert.alert(
          'Sound Downloaded',
          'Please set this sound as your notification sound in the system settings, then return to the app.',
          [
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
            {
              text: 'Done',
              onPress: () => completeNotificationSetup(),
            },
          ]
        );
      } else {
        completeNotificationSetup();
      }
    } catch (error) {
      console.error('Error downloading notification sound:', error);
      Alert.alert(
        'Download Error',
        'Failed to download notification sound. You can set it up later in settings.',
        [
          {
            text: 'Skip',
            onPress: () => completeNotificationSetup(),
          },
          {
            text: 'Retry',
            onPress: () => downloadNotificationSound(),
          },
        ]
      );
    }
  };

  // Complete notification setup
  const completeNotificationSetup = async () => {
    try {
      await AsyncStorage.setItem(ASYNC_KEYS.NOTIFICATION_SETUP_DONE, 'true');
      setNotificationSetupDone(true);
      setShowNotificationSetup(false);

      Alert.alert(
        'Setup Complete',
        'Notification setup completed successfully!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error completing notification setup:', error);
    }
  };

  // Setup notification channel (Android)
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default Channel',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'sound.mp3',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }, []);

  // Initialize on component mount
  useEffect(() => {
    const initializeApp = async () => {
      await checkNotificationSetup();
      await setupFCMToken();

    };

    initializeApp();
  }, []);

  // Manage background task based on app state
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      try {
        if (nextAppState === 'background' && !BackgroundService.isRunning()) {
          console.log('App went to background, starting background task');
       
        } else if (nextAppState === 'active' && BackgroundService.isRunning()) {
          console.log('App returned to active, stopping background task');
          await BackgroundService.stop();
        }
      } catch (e) {
        console.warn('Background service error:', e);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      subscription.remove();
      if (BackgroundService.isRunning()) {
        BackgroundService.stop().catch((e) => console.warn('Failed to stop background task:', e));
      }
    };
  }, []);

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

  // Start location tracking on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!locationStarted && mounted) {
        try {
       
          setLocationStarted(true);
        } catch (err) {
          if (mounted) {
            Alert.alert(
              'Location Error',
              'Could not start tracking. Please check permissions.',
              [{ text: 'OK' }]
            );
          }
        }
      }
    };
    init();
    return () => {
      mounted = false;
      stopLocationTracking();
    };
  }, []);



  // Debug logs
  useEffect(() => {
    console.log('Tracking status:', isTracking ? 'ACTIVE' : 'INACTIVE');
    if (currentLocation) {
      console.log('Location:', currentLocation);
    }
  }, [isTracking, currentLocation]);

  // Pull-to-refresh handler
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    console.log('Starting complete app restart...');
    
    // Stop all services
    await stopLocationTracking();
    if (BackgroundService.isRunning()) {
      await BackgroundService.stop();
    }
    
    // Reset states
    setLocationStarted(false);
    setFcmToken(null);
    setNotificationSetupDone(false);
    setShowNotificationSetup(false);
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize everything
    await checkNotificationSetup();
    await setupFCMToken();
    await startLocationTracking();
    setLocationStarted(true);
    reCallMe()
    console.log('✅ Complete restart successful');
      setRefreshing(false);

  } catch (e) {
    console.error('❌ Restart failed:', e);
    Alert.alert(
      'Restart Failed',
      'Could not restart completely. Please try again or restart the app manually.',
      [{ text: 'OK' }]
    );
      setRefreshing(false);

  } finally {
    setRefreshing(false);
  }
}, [stopLocationTracking, startLocationTracking, checkNotificationSetup, setupFCMToken]);

  // Render notification setup section
  const renderNotificationSetup = () => {
    if (!showNotificationSetup || notificationSetupDone) return null;

    return (
      <View style={styles.notificationSetupContainer}>
        <Text style={styles.setupTitle}>🔔 Notification Setup Required</Text>
        <Text style={styles.setupDescription}>
          To receive important ride notifications with custom sound, please complete the setup below:
        </Text>

        <View style={styles.setupSteps}>
          <Text style={styles.stepText}>1. Download notification sound</Text>
          <Text style={styles.stepText}>2. Set it in your device settings</Text>
          <Text style={styles.stepText}>3. Return to complete setup</Text>
        </View>

        <View style={styles.setupButtons}>
          <TouchableOpacity
            style={[styles.setupButton, styles.primaryButton]}
            onPress={downloadNotificationSound}
          >
            <Text style={styles.primaryButtonText}>Start Setup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.setupButton, styles.secondaryButton]}
            onPress={completeNotificationSetup}
          >
            <Text style={styles.secondaryButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
        {renderNotificationSetup()}

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
  notificationSetupContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
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
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
    textAlign: 'center',
  },
  setupDescription: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  setupSteps: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  stepText: {
    fontSize: 14,
    color: '#495057',
    marginBottom: 4,
    paddingLeft: 8,
  },
  setupButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  setupButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6c757d',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  debugText: {
    fontSize: 12,
    color: '#495057',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#dc3545',
    fontWeight: 'bold',
  },
  debugButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  debugButton: {
    backgroundColor: '#007bff',
    color: 'white',
    padding: 8,
    borderRadius: 4,
    fontSize: 12,
    textAlign: 'center',
    minWidth: 80,
  },
});