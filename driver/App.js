import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, StatusBar, Platform } from 'react-native';
import { AppRegistry } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import axios from 'axios';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import './context/firebaseConfig';
import { name as appName } from './app.json';
import { store } from './redux/store';
import { SocketProvider } from './context/SocketContext';
import { LocationProvider } from './context/LocationContext';
import { RideStatusProvider } from './context/CheckRideHaveOrNot.context';

// Components
import Loading from './components/Loading';
import ErrorBoundaryWrapper from './ErrorBoundary';
import CheckAppUpdate from './context/CheckAppUpdate';

// Screens
import OnboardingScreen from './screens/onboarding/OnboardingScreen';
import RegistrationForm from './screens/onboarding/registration/RegistrationForm';
import Document from './screens/onboarding/registration/Document';
import Wait_Screen from './screens/Wait_Screen/Wait_Screen';
import HomeScreen from './screens/HomeScreen';
import MoneyPage from './screens/MoneyPage';
import AllRides from './screens/All_Rides/AllRides';
import Profile from './screens/Profile/Profile';
import SupportScreen from './screens/Support/Support';
import UploadQr from './screens/Profile/UploadQr';
import BhVerification from './screens/onboarding/BH_Re/BhVerification';
import RegisterWithBh from './screens/onboarding/BH_Re/Bh_registeration';
import BhOtpVerification from './screens/onboarding/BH_Re/BhOtpVerification';
import RechargeViaOnline from './screens/Recharge/RehcargeViaOnline';
import RechargeHistory from './screens/Profile/RechargeHistory';
import WorkingData from './screens/WorkingData/WorkingData';
import ReferalHistory from './screens/Profile/ReferalHistory';
import Withdraw from './screens/Profile/Withdraw';
import RideRequestScreen from './screens/Ride.come';
import NewParcelLive from './screens/Parcel_Screens/NewParcelLive/NewParcelLive';
import DeliveryTracking from './screens/Parcel_Screens/DeliveryTracking/DeliveryTracking';
import AvailableOrder from './screens/Parcel_Screens/Available_Orders/AvailableOrder';
import ProgressOrder from './screens/Parcel_Screens/ProgressOrder/ProgressOrder';
import UnlockCoupons from './screens/Unlock/UnlockCoupons';
import RunningRide from './New Screens/on_way_ride/RunningRide';

// Custom Hook
import useNotificationPermission from './hooks/notification';

const Stack = createNativeStackNavigator();

// Sentry Configuration
Sentry.init({
  dsn: 'https://cb37ba59c700e925974e3b36d10e8e5b@o4508691997261824.ingest.us.sentry.io/4508692015022080',
  environment: 'production',
  enableInExpoDevelopment: true,
  debug: false,
  tracesSampleRate: 1.0,
});

// Constants
const API_BASE_URL = 'https://www.appv2.olyox.com/api/v1';
const PROCESSED_MESSAGES_KEY = '@app:processedMessages';

// Global navigation reference for notifications
let globalNavigationRef = null;

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Navigation helper function
const handleNotificationNavigation = (data) => {
  if (!globalNavigationRef || !data) return;

  console.log('🧭 Navigating with data:', data);

  try {
    if (data.event === "NEW_RIDE_REQUEST" || data.action === "RIDE_REQUEST") {
      console.log('🚖 Navigating to Home with rideId:', data.rideId);
      globalNavigationRef.navigate("Home", {
        rideId: data.rideId,
        pickup: data.pickup !== "undefined" ? data.pickup : null,
        drop: data.drop !== "undefined" ? data.drop : null,
        price: data.price !== "undefined" ? data.price : null,
        fromNotification: true,
        timestamp: Date.now(),
      });
    } else if (data.type === 'Home') {
      console.log('🔄 Navigating to start screen with rideId:', data.ride_id);
      globalNavigationRef.navigate('start', {
        rideId: data.ride_id,
        fromNotification: true
      });
    } else {
      console.log('🏠 Navigating to Home screen');
      globalNavigationRef.navigate("Home");
    }
  } catch (error) {
    console.error('❌ Navigation error:', error);
    try {
      globalNavigationRef.navigate("Home");
    } catch (fallbackError) {
      console.error('❌ Fallback navigation failed:', fallbackError);
    }
  }
};

// Show local notification using Expo Notifications
const showLocalNotification = async (title, body, data = {}) => {
  try {
    const rideId = data?.rideId;

    if (!rideId) {
      console.warn("⚠️ rideId not found in notification data.");
    } else {
      console.log("🔍 rideId for local check:", rideId);
    }

    // Check for duplicates
    const existingNotifications = await Notifications.getPresentedNotificationsAsync();

    if (rideId) {
      const isDuplicate = existingNotifications.some(notification => {
        const existingRideId = notification.request?.content?.data?.rideId;
        return existingRideId === rideId;
      });

      if (isDuplicate) {
        console.log(`🔄 Duplicate local notification prevented for ride: ${rideId}`);
        return;
      }
    }

    // Schedule new notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || '🚕 New Ride Request',
        body: body || 'You have a new ride request',
        data,
        sound: 'sound.mp3',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        categoryIdentifier: 'RIDE_REQUEST',
        badge: 1,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null, // Show immediately
    });

    console.log(`✅ Local notification scheduled for ride: ${rideId || 'unknown'}`);
  } catch (error) {
    console.error('❌ Error showing local notification:', error.message || error);
  }
};

// Set up notification categories with actions
const setupNotificationCategories = async () => {
  try {
    await Notifications.setNotificationCategoryAsync('RIDE_REQUEST', [
      {
        identifier: 'ACCEPT',
        buttonTitle: 'Accept',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'DECLINE',
        buttonTitle: 'Decline',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    console.log('✅ Notification categories set up');
  } catch (error) {
    console.error('❌ Error setting up notification categories:', error);
  }
};

// Background Message Handler
let backgroundHandlerInitialized = false;
if (!backgroundHandlerInitialized) {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('📩 Background message received:', remoteMessage);
    const messageId = remoteMessage.messageId || `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const rideId = remoteMessage.data?.rideId || remoteMessage.data?.ride_id;

    if (!messageId) return;

    try {
      // Prevent duplicate processing using both messageId and rideId
      const processedMessages = await AsyncStorage.getItem(PROCESSED_MESSAGES_KEY);
      const processed = processedMessages ? JSON.parse(processedMessages) : [];

      // Check for duplicate message ID or ride ID
      const isDuplicate = processed.some(item =>
        item.messageId === messageId ||
        (rideId && item.rideId === rideId && (Date.now() - item.timestamp) < 30000) // 30 seconds window
      );

      if (isDuplicate) {
        console.log('📩 Duplicate message detected, skipping:', messageId, rideId);
        return;
      }

      // Add to processed list with timestamp
      processed.push({
        messageId,
        rideId,
        timestamp: Date.now()
      });

      // Keep only last 50 and remove old entries (older than 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const filteredProcessed = processed
        .filter(item => item.timestamp > fiveMinutesAgo)
        .slice(-50);

      await AsyncStorage.setItem(PROCESSED_MESSAGES_KEY, JSON.stringify(filteredProcessed));

      // Store the notification data for when app opens
      await AsyncStorage.setItem('@app:pendingNotification', JSON.stringify({
        data: remoteMessage.data,
        timestamp: Date.now(),
        messageId: messageId
      }));

      // Show notification using Expo Notifications (this handles sound better than custom audio)
      await showLocalNotification(
        remoteMessage.notification?.title,
        remoteMessage.notification?.body,
        {
          ...remoteMessage.data,
          fromBackground: true,
          messageId: messageId
        }
      );

      console.log('✅ Background notification sent for ride:', rideId);

    } catch (error) {
      console.error('❌ Background handler error:', error);
    }
  });
  backgroundHandlerInitialized = true;
}

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [isInitialized, setIsInitialized] = useState(false);

  // Use refs to track initialization state
  const initializationRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const notificationListener = useRef();
  const responseListener = useRef();

  const navigationRef = useNavigationContainerRef();
  const {
    isGranted,
    fcmToken,
    lastNotification,
    lastFcmMessage,
    requestPermission,
    showNotification
  } = useNotificationPermission(navigationRef);

  // Set global navigation reference
  useEffect(() => {
    globalNavigationRef = navigationRef.current;
  }, [navigationRef]);

  // Memoize API base URL to prevent recreating axios calls
  const apiConfig = useMemo(() => ({
    baseURL: API_BASE_URL,
    timeout: 10000,
  }), []);

  // Configure Firebase and Notifications
  const configureNotifications = useCallback(async () => {
    try {
      // Request Expo notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Notification permission denied');
        return;
      }

      // Set up notification categories
      await setupNotificationCategories();

      // Configure notification channel for Android with better sound handling
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('ride_channel', {
          name: 'Ride Notifications',
          description: 'Notifications for ride requests',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'sound.mp3', // Custom sound file
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true, // Bypass Do Not Disturb
        });
      }

      // Request Firebase messaging permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Firebase messaging permission granted');

        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
      }
    } catch (error) {
      console.error('❌ Notification configuration error:', error);
    }
  }, []);

  // Check authentication and user status
  const checkAuthToken = useCallback(async () => {
    if (initializationRef.current) {
      console.log('🔒 Auth check already in progress, skipping...');
      return;
    }

    try {
      initializationRef.current = true;
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        setInitialRoute('Onboarding');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/rider/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const { partner } = response.data;

      if (!partner?.isDocumentUpload) {
        setInitialRoute('UploadDocuments');
      } else if (!partner?.DocumentVerify) {
        setInitialRoute('Wait_Screen');
      } else {
        setInitialRoute('Home');
      }
    } catch (error) {
      console.error('Auth error:', error?.response?.data?.message || error.message);
      setInitialRoute('Onboarding');
    } finally {
      setIsLoading(false);
      initializationRef.current = false;
    }
  }, []);

  // Handle notification navigation
  const handleNotificationNavigationCallback = useCallback((data) => {
    handleNotificationNavigation(data);
  }, []);

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState) => {
    const previousAppState = appStateRef.current;
    appStateRef.current = nextAppState;

    if (previousAppState !== nextAppState) {
      console.log(`AppState changed from ${previousAppState} to ${nextAppState}`);

      if (nextAppState === 'active' && previousAppState === 'background') {
        console.log('App returned to foreground');
        if (isInitialized) {
          requestPermission();
        }
      }
    }
  }, [requestPermission, isInitialized]);

  // Check for pending notifications when app starts
  const checkPendingNotifications = useCallback(async () => {
    try {
      const pendingNotification = await AsyncStorage.getItem('@app:pendingNotification');
      if (pendingNotification) {
        const notification = JSON.parse(pendingNotification);
        console.log('📱 Found pending notification:', notification);

        // Clear the pending notification
        await AsyncStorage.removeItem('@app:pendingNotification');

        // Handle navigation after a small delay to ensure app is ready
        setTimeout(() => {
          handleNotificationNavigationCallback(notification.data);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error checking pending notifications:', error);
    }
  }, [handleNotificationNavigationCallback]);

  // Initialize app
  useEffect(() => {
    if (isInitialized) return;

    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        await configureNotifications();
        await checkAuthToken();
        await requestPermission();
        await checkPendingNotifications();
        setIsInitialized(true);
        console.log('✅ App initialization complete');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [isInitialized, configureNotifications, checkAuthToken, requestPermission, checkPendingNotifications]);

  // Handle FCM message navigation
  useEffect(() => {
    if (isInitialized && lastFcmMessage?.data) {
      console.log('Handling FCM message navigation:', lastFcmMessage.data);
      handleNotificationNavigationCallback(lastFcmMessage.data);
    }
  }, [lastFcmMessage, handleNotificationNavigationCallback, isInitialized]);

  // Handle foreground notifications and notification interactions
  useEffect(() => {
    if (!isInitialized) return;

    // Handle foreground FCM messages
    const unsubscribeFCM = messaging().onMessage(async (remoteMessage) => {
      console.log('📱 Foreground FCM message received:', remoteMessage);

      // Show notification even in foreground
      await showLocalNotification(
        remoteMessage.notification?.title,
        remoteMessage.notification?.body,
        {
          ...remoteMessage.data,
          fromForeground: true,
        }
      );
    });

    // Handle notification received while app is running
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received:', notification);
    });

    // Handle notification tapped
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification response received:', response);

      const { notification, actionIdentifier } = response;
      const data = notification.request.content.data;

      if (actionIdentifier === 'ACCEPT') {
        console.log('✅ User accepted ride');
        handleNotificationNavigationCallback(data);
      } else if (actionIdentifier === 'DECLINE') {
        console.log('❌ User declined ride');
        // Handle decline action
      } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        console.log('👆 User tapped notification');
        handleNotificationNavigationCallback(data);
      }
    });

    return () => {
      unsubscribeFCM();
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isInitialized, handleNotificationNavigationCallback]);

  // App state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription?.remove();
    };
  }, [handleAppStateChange]);

  // Memoize screen options to prevent recreation
  const screenOptions = useMemo(() => ({
    headerShown: false
  }), []);

  // Show loading screen
  if (isLoading) {
    return <Loading />;
  }

  return (
    <Provider store={store}>
      <PaperProvider>
        <SocketProvider>
          <LocationProvider>
            <RideStatusProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                  <NavigationContainer ref={navigationRef}>
                    <StatusBar barStyle="dark-content" />
                    <Stack.Navigator
                      initialRouteName={initialRoute}
                      screenOptions={screenOptions}
                    >
                      <Stack.Screen
                        name="Onboarding"
                        component={OnboardingScreen}
                      />
                      <Stack.Screen
                        name="register"
                        component={RegistrationForm}
                        options={{
                          headerShown: true,
                          title: 'Complete Profile'
                        }}
                      />
                      <Stack.Screen
                        name="UploadDocuments"
                        component={Document}
                      />
                      <Stack.Screen
                        name="Wait_Screen"
                        component={Wait_Screen}
                      />
                      <Stack.Screen
                        name="Home"
                        component={HomeScreen}
                      />
                      <Stack.Screen
                        name="start"
                        component={RunningRide}
                      />
                      <Stack.Screen
                        name="support"
                        component={SupportScreen}
                      />
                      <Stack.Screen
                        name="collect_money"
                        component={MoneyPage}
                      />
                      <Stack.Screen
                        name="AllRides"
                        component={AllRides}
                      />
                      <Stack.Screen
                        name="NewRideScreen"
                        component={RideRequestScreen}
                      />
                      <Stack.Screen
                        name="UnlockCoupons"
                        component={UnlockCoupons}
                      />
                      <Stack.Screen
                        name="Profile"
                        component={Profile}
                      />
                      <Stack.Screen
                        name="upload-qr"
                        component={UploadQr}
                      />
                      <Stack.Screen
                        name="enter_bh"
                        component={BhVerification}
                      />
                      <Stack.Screen
                        name="Register"
                        component={RegisterWithBh}
                      />
                      <Stack.Screen
                        name="OtpVerify"
                        component={BhOtpVerification}
                      />
                      <Stack.Screen
                        name="Recharge"
                        component={RechargeViaOnline}
                      />
                      <Stack.Screen
                        name="recharge-history"
                        component={RechargeHistory}
                      />
                      <Stack.Screen
                        name="WorkingData"
                        component={WorkingData}
                      />
                      <Stack.Screen
                        name="referral-history"
                        component={ReferalHistory}
                      />
                      <Stack.Screen
                        name="withdraw"
                        component={Withdraw}
                      />
                      <Stack.Screen
                        name="ParcelDetails"
                        component={NewParcelLive}
                      />
                      <Stack.Screen
                        name="DeliveryTracking"
                        component={DeliveryTracking}
                        options={{ headerShown: false }}
                      />
                      <Stack.Screen
                        name="available-orders"
                        component={AvailableOrder}
                        options={{
                          headerShown: false,
                          title: "Available Orders"
                        }}
                      />
                      <Stack.Screen
                        name="progress-order"
                        component={ProgressOrder}
                        options={{
                          headerShown: true,
                          title: "Progress Orders"
                        }}
                      />
                    </Stack.Navigator>
                  </NavigationContainer>
                </SafeAreaProvider>
              </GestureHandlerRootView>
            </RideStatusProvider>
          </LocationProvider>
        </SocketProvider>
      </PaperProvider>
    </Provider>
  );
};

// Wrap with Sentry
const WrappedApp = React.memo(Sentry.wrap(App));

// Root App Component
const RootApp = React.memo(() => (
  <ErrorBoundaryWrapper>
    <CheckAppUpdate>
      <WrappedApp />
    </CheckAppUpdate>
  </ErrorBoundaryWrapper>
));

// Register the app
AppRegistry.registerComponent(appName, () => RootApp);

export default RootApp;