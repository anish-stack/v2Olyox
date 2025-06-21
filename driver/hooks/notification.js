import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
const FCM_TOKEN_STORAGE_KEY = '@app:fcmToken';

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

// Request permission for Expo Notifications
const requestExpoNotificationPermission = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

// Function to show notification using expo-notifications
const showExpoNotification = async (title, body, data = {}) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      vibrate: true,
      sticky: true,
      sound: 'default'
    },
    trigger: null, // Show immediately
  });
};

const useNotificationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState('not-determined');
  const [isGranted, setIsGranted] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [lastNotification, setLastNotification] = useState(null);
  const [lastFcmMessage, setLastFcmMessage] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();

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

  useEffect(() => {
    const initializeData = async () => {
      const storedToken = await getStoredFcmToken();
      if (storedToken) {
        setFcmToken(storedToken);
      }
    };

    initializeData();
  }, []);
  const playSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('./sound.mp3')
      );
      console.log('🔊 Playing notification sound');
      await sound.playAsync();
    } catch (error) {
      console.log('❌ Error playing sound:', error);
    }
  };
  useEffect(() => {
    requestPermission();

    // Token refresh listener
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
      console.log('🔄 FCM Token refreshed:', token);
      setFcmToken(token);
      await storeFcmToken(token);
    });

    // Foreground listener - using Expo notifications instead of Alert
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('📩 FCM Message in foreground:', remoteMessage);
      setLastFcmMessage(remoteMessage);

      // Show notification using Expo Notifications
      await showExpoNotification(
        remoteMessage.notification?.title || 'New Notification',
        remoteMessage.notification?.body || '',
        remoteMessage.data
      );
    });

    // When app opened from background
    const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('🔄 App opened from background notification:', remoteMessage);
      setLastFcmMessage(remoteMessage);
    });

    // App launched from quit state
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('🚀 App launched from quit state via notification:', remoteMessage);
        setLastFcmMessage(remoteMessage);
      }
    });

    // Set background handler (only once globally)
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📩 Message handled in background:', remoteMessage);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New Message',
          body: remoteMessage.notification?.body || '',
         sound: 'sound',
        },
        trigger: null,
      });
      // Note: this won't update state directly as the app is in background
      return remoteMessage;
    });

    // App state change listener to refresh token when app comes to foreground
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && isGranted) {
        const token = await messaging().getToken();
        if (token !== fcmToken) {
          console.log('🔄 FCM Token updated on app foregrounding:', token);
          setFcmToken(token);
          await storeFcmToken(token);
        }
      }
    });

    // Set up Expo Notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Expo Notification received:', notification);
      const playSound = async () => {
        try {
          const { sound } = await Audio.Sound.createAsync(
            require('./sound.mp3') // make sure the path is correct
          );
          await sound.playAsync();
        } catch (error) {
          console.log('❌ Error playing sound:', error);
        }
      };
      if (AppState.currentState === 'active') {
        playSound(); // ✅ only in foreground
      } else {
        playSound(); // ✅ only in background
      }
      setLastNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 User tapped on notification:', response);
      setLastNotification(response.notification);
    });

    // Cleanup
    return () => {
      unsubscribeForeground();
      unsubscribeOpenedApp();
      unsubscribeTokenRefresh();
      subscription.remove();
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [requestPermission, isGranted, fcmToken]);

  // Helper function to display notifications using Expo
  const showNotification = async (title, body, data = {}) => {
    return showExpoNotification(title, body, data);
  };

  return {
    permissionStatus,
    isGranted,
    requestPermission,
    fcmToken,
    getToken: async () => fcmToken || await getStoredFcmToken(),
    showNotification,
    // Return notification data so it can be used in other components
    lastNotification,
    lastFcmMessage
  };
};

export default useNotificationPermission;