import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, AppState, Vibration } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

const FCM_TOKEN_STORAGE_KEY = '@app:fcmToken';
const PROCESSED_MESSAGES_KEY = '@app:processedMessages';

// Configure expo notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const requestNotificationsPermission = async () => {
  const authStatus = await messaging().requestPermission();
  return {
    status:
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
        ? 'granted'
        : 'denied',
  };
};

const requestAndroidPermission = async (permission) => {
  try {
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Android permission error:', err);
    return false;
  }
};

const requestExpoNotificationPermission = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

const useNotificationPermission = (navigation) => {
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [isGranted, setIsGranted] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [lastNotification, setLastNotification] = useState(null);
  const [lastFcmMessage, setLastFcmMessage] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();
  const soundRef = useRef(null);
  const processedMessagesRef = useRef(new Set());
  const isInitialized = useRef(false);

  // Save FCM token to storage
  const storeFcmToken = async (token) => {
    try {
      await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    } catch (error) {
      console.error('❌ Error storing FCM token:', error);
    }
  };

  // Get stored FCM token
  const getStoredFcmToken = async () => {
    try {
      return await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('❌ Error retrieving FCM token:', error);
      return null;
    }
  };

  // Setup audio for notifications
  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.log('❌ Error setting up audio:', error);
    }
  };

  // Play notification sound with proper error handling
  const playNotificationSound = useCallback(async () => {
    // Only play sound when app is in foreground
    if (AppState.currentState !== 'active') {
      console.log('🔇 App in background, using vibration instead');
      Vibration.vibrate([0, 250, 250, 250]);
      return;
    }

    try {
      // Setup audio first
      await setupAudio();

      // Clean up any existing sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log('Warning: Error unloading previous sound');
        }
        soundRef.current = null;
      }

      // Create and play new sound
      const { sound } = await Audio.Sound.createAsync(
        require('./sound.mp3'),
        {
          shouldPlay: true,
          volume: 0.8,
          rate: 1.0,
        }
      );

      soundRef.current = sound;
      console.log('🔊 Playing notification sound');

      // Auto cleanup after 3 seconds
      setTimeout(async () => {
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          } catch (e) {
            console.log('Warning: Error in sound cleanup');
          }
        }
      }, 3000);

    } catch (error) {
      console.log('❌ Error playing sound:', error.message);
      // Fallback to vibration
      Vibration.vibrate([0, 250, 250, 250]);

      // Clean up on error
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignore cleanup errors
        }
        soundRef.current = null;
      }
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      // Request permissions for Firebase Messaging
      const status = await Platform.select({
        ios: async () => {
          const { status } = await requestNotificationsPermission();
          return status;
        },
        android: async () => {
          if (Platform.Version >= 33) {
            const granted = await requestAndroidPermission('android.permission.POST_NOTIFICATIONS');
            return granted ? 'granted' : 'denied';
          }
          return 'granted';
        },
        default: async () => 'not-determined',
      })();

      // Request permissions for Expo Notifications
      const expoPermissionGranted = await requestExpoNotificationPermission();

      const granted = status === 'granted' && expoPermissionGranted;
      setPermissionStatus(granted ? 'granted' : 'denied');
      setIsGranted(granted);

      if (granted) {
        // Get FCM token
        const token = await messaging().getToken();
        console.log('🔥 FCM Token:', token);
        setFcmToken(token);
        await storeFcmToken(token);
      }

      return granted;
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return false;
    }
  }, []);

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        const storedToken = await getStoredFcmToken();
        if (storedToken) {
          setFcmToken(storedToken);
        }

        // Setup audio
        await setupAudio();

        // Load processed messages
        const processedMessages = await AsyncStorage.getItem(PROCESSED_MESSAGES_KEY);
        if (processedMessages) {
          const processed = JSON.parse(processedMessages);
          processedMessagesRef.current = new Set(processed);
        }

        isInitialized.current = true;
      } catch (error) {
        console.error('❌ Error initializing data:', error);
      }
    };

    initializeData();
  }, []);

  // Handle notification navigation
  const handleNotificationNavigation = useCallback((remoteMessage) => {
    if (!navigation || !remoteMessage?.data) return;

    const { data } = remoteMessage;

    try {
      if (data.event === "NEW_RIDE_REQUEST" || data.action === "RIDE_REQUEST") {
        // Navigate to Home with ride details
        navigation.navigate("Home", {
          rideId: data.rideId,
          pickup: data.pickup !== "undefined" ? data.pickup : null,
          drop: data.drop !== "undefined" ? data.drop : null,
          price: data.price !== "undefined" ? data.price : null,
          fromNotification: true,
          timestamp: Date.now(),
        });
      } else {
        // Default navigation to Home
        navigation.navigate("Home", {
          fromNotification: true,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Fallback navigation
      try {
        navigation.navigate("Home");
      } catch (fallbackError) {
        console.error('❌ Fallback navigation failed:', fallbackError);
      }
    }
  }, [navigation]);

  // Set up FCM listeners
  useEffect(() => {
    if (!isInitialized.current) return;

    let mounted = true;

    const setupListeners = async () => {
      try {
        // Request permissions
        await requestPermission();

        // Token refresh listener
        const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
          if (!mounted) return;
          console.log('🔄 FCM Token refreshed:', token);
          setFcmToken(token);
          await storeFcmToken(token);
        });

        // Foreground message listener
        const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
          if (!mounted) return;
          console.log('📩 FCM Message in foreground:', remoteMessage);

          // Prevent duplicate processing
          const messageId = remoteMessage.messageId;
          if (messageId && processedMessagesRef.current.has(messageId)) {
            console.log('📩 Duplicate message ignored:', messageId);
            return;
          }

          if (messageId) {
            processedMessagesRef.current.add(messageId);
          }

          setLastFcmMessage(remoteMessage);

          // Play sound and vibration for foreground messages
          await playNotificationSound();



        });

      
        const unsubscribeOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
          if (!mounted) return;
          console.log('🔄 App opened from background notification:', remoteMessage);
          setLastFcmMessage(remoteMessage);
          handleNotificationNavigation(remoteMessage);
        });

        // App launched from quit state
        messaging().getInitialNotification().then((remoteMessage) => {
          if (!mounted || !remoteMessage) return;
          console.log('🚀 App launched from quit state via notification:', remoteMessage);
          setLastFcmMessage(remoteMessage);
          handleNotificationNavigation(remoteMessage);
        });

        // App state change listener
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
          if (!mounted || !isGranted) return;

          if (nextAppState === 'active') {
            try {
              const token = await messaging().getToken();
              if (token && token !== fcmToken) {
                console.log('🔄 FCM Token updated on app foregrounding:', token);
                setFcmToken(token);
                await storeFcmToken(token);
              }
            } catch (error) {
              console.error('❌ Error refreshing token:', error);
            }
          }
        });

        // Cleanup function
        return () => {
          mounted = false;
          unsubscribeForeground();
          unsubscribeOpenedApp();
          unsubscribeTokenRefresh();
          subscription.remove();
        };

      } catch (error) {
        console.error('❌ Error setting up FCM listeners:', error);
      }
    };

    const cleanup = setupListeners();

    return () => {
      mounted = false;
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, [isInitialized.current, isGranted, fcmToken, requestPermission, playNotificationSound, handleNotificationNavigation]);

  // Set up Expo Notification listeners
  useEffect(() => {
    // Notification received listener
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {

      setLastNotification(notification);
    });

    // Notification response listener (when user taps notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('📱 Notification tapped:', response);
      const data = response.notification.request.content.data;
      setLastNotification(response.notification);

      // Handle navigation based on notification data
      handleNotificationNavigation({ data });
    });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => { });
      }
    };
  }, [handleNotificationNavigation]);

  // Helper function to show custom notifications
  const showNotification = async (title, body, data = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  };

  return {
    permissionStatus,
    isGranted,
    requestPermission,
    fcmToken,
    getToken: async () => fcmToken || await getStoredFcmToken(),
    showNotification,
    lastNotification,
    lastFcmMessage,
    playNotificationSound,
  };
};

export default useNotificationPermission;