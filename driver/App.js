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

// Constants
const API_BASE_URL = 'https://www.appv2.olyox.com/api/v1';
const PROCESSED_MESSAGES_KEY = '@app:processedMessages';
const PENDING_NOTIFICATION_KEY = '@app:pendingNotification';

// Sentry Configuration
Sentry.init({
  dsn: 'https://cb37ba59c700e925974e3b36d10e8e5b@o4508691997261824.ingest.us.sentry.io/4508692015022080',
  environment: 'production',
  enableInExpoDevelopment: true,
  debug: false,
  tracesSampleRate: 1.0,
});

const Stack = createNativeStackNavigator();

// Global navigation reference
let globalNavigationRef = null;

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Notification Service Class
class NotificationService {
  static instance = null;
  
  static getInstance() {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notification configuration
  async initialize() {
    try {
      await this.requestPermissions();
      await this.setupNotificationCategories();
      await this.configureNotificationChannel();
    } catch (error) {
      console.error('❌ Notification initialization error:', error);
    }
  }

  // Request notification permissions
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('❌ Notification permission denied');
      return false;
    }

    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                   authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
    }

    return enabled;
  }

  // Setup notification categories
  async setupNotificationCategories() {
    await Notifications.setNotificationCategoryAsync('RIDE_REQUEST', [
      {
        identifier: 'ACCEPT',
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'DECLINE',
        buttonTitle: 'Decline',
        options: { opensAppToForeground: false },
      },
    ]);
  }

  // Configure Android notification channel
  async configureNotificationChannel() {
    if (Platform.OS === 'android') {
      // Main ride notifications channel
      await Notifications.setNotificationChannelAsync('ride_channel', {
        name: 'Ride Notifications',
        description: 'Notifications for ride requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'sound.mp3',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
      });

      // Default channel for other notifications
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Notifications',
        description: 'General app notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'sound.mp3',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }

  // Check for duplicate notifications
  async isDuplicateNotification(rideId, messageId) {
    if (!rideId && !messageId) return false;

    try {
      const processedMessages = await AsyncStorage.getItem(PROCESSED_MESSAGES_KEY);
      const processed = processedMessages ? JSON.parse(processedMessages) : [];

      const isDuplicate = processed.some(item =>
        item.messageId === messageId ||
        (rideId && item.rideId === rideId && (Date.now() - item.timestamp) < 30000)
      );

      if (!isDuplicate) {
        // Add to processed list
        processed.push({
          messageId: messageId || `local-${Date.now()}`,
          rideId,
          timestamp: Date.now()
        });

        // Keep only recent entries
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const filteredProcessed = processed
          .filter(item => item.timestamp > fiveMinutesAgo)
          .slice(-50);

        await AsyncStorage.setItem(PROCESSED_MESSAGES_KEY, JSON.stringify(filteredProcessed));
      }

      return isDuplicate;
    } catch (error) {
      console.error('Error checking duplicate notification:', error);
      return false;
    }
  }

  // Show local notification
  async showLocalNotification(title, body, data = {}) {
    try {
      const rideId = data?.rideId || data?.ride_id;
      const messageId = data?.messageId || `local-${Date.now()}`;

      // Check for duplicates
      const isDuplicate = await this.isDuplicateNotification(rideId, messageId);
      if (isDuplicate) {
        console.log(`🔄 Duplicate notification prevented for ride: ${rideId}`);
        return;
      }

      // For background messages, store the data for later navigation
      if (data?.fromBackground) {
        await this.storePendingNotification(data);
      }

      // Determine if this is a ride request notification (has actions)
      const isRideRequest = data?.event === 'RIDE_REQUEST' || 
                           data?.event === 'DEFAULT_EVENT' ||
                           rideId !== 'undefined';

      // Choose category and channel based on notification type
      const categoryIdentifier = isRideRequest ? 'RIDE_REQUEST' : null;
      const channelId = isRideRequest ? 'ride_channel' : 'default';

      const notificationContent = {
        title: title || '🚕 New Ride Request',
        body: body || 'You have a new ride request from test',
        data: {
          ...data,
          screen: 'Home',
          messageId,
          timestamp: Date.now(),
          // Add a unique identifier to track this notification
          notificationId: `${messageId}-${Date.now()}`,
          // Ensure clickable data is present
          clickAction: 'OPEN_APP'
        },
        sound: 'sound.mp3',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        badge: 1,
      };

      // Only add category if it's a ride request with actions
      if (categoryIdentifier) {
        notificationContent.categoryIdentifier = categoryIdentifier;
      }

      // Add channel for Android
      if (Platform.OS === 'android') {
        notificationContent.channelId = channelId;
      }

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null,
      });

      console.log(`✅ Local notification scheduled for ride: ${rideId || 'unknown'}, category: ${categoryIdentifier || 'none'}`);
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
  }

  // Handle notification tap - always navigate to Home
  handleNotificationTap(data) {
    console.log('🔔 Notification tapped with data:', data);
    
    if (!globalNavigationRef) {
      console.error('❌ Navigation ref not available, storing for later');
      // Store the notification tap for when navigation becomes available
      this.storePendingNotification(data);
      return;
    }

    try {
      console.log('🔔 Notification tapped, navigating to Home');
      
      // Always navigate to Home screen with notification data
      globalNavigationRef.navigate('Home', {
        fromNotification: true,
        notificationData: data,
        timestamp: Date.now(),
        ...(data || {})
      });
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Store for retry when navigation is available
      this.storePendingNotification(data);
    }
  }

  // Store pending notification for when app opens
  async storePendingNotification(data) {
    try {
      await AsyncStorage.setItem(PENDING_NOTIFICATION_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      console.log('📦 Pending notification stored');
    } catch (error) {
      console.error('Error storing pending notification:', error);
    }
  }

  // Get and clear pending notification
  async getPendingNotification() {
    try {
      const pendingNotification = await AsyncStorage.getItem(PENDING_NOTIFICATION_KEY);
      if (pendingNotification) {
        await AsyncStorage.removeItem(PENDING_NOTIFICATION_KEY);
        const parsed = JSON.parse(pendingNotification);
        console.log('📦 Retrieved pending notification:', parsed);
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('Error getting pending notification:', error);
      return null;
    }
  }

  // Set navigation reference
  setNavigationRef(ref) {
    globalNavigationRef = ref;
    console.log('🧭 Navigation ref set');
  }
}

// Background Message Handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📩 Background message received:', remoteMessage);
  
  const notificationService = NotificationService.getInstance();
  const data = remoteMessage.data || {};
  
  // Don't show local notification if the system already showed one
  // This prevents duplicate notifications for FCM messages with notification payload
  if (remoteMessage.notification) {
    console.log('📱 FCM notification with payload, storing for tap handling');
    // Just store the data for tap handling, don't show duplicate notification
    await notificationService.storePendingNotification({
      ...data,
      fromBackground: true,
      messageId: remoteMessage.messageId || `bg-${Date.now()}`,
      originalMessage: remoteMessage,
      hasSystemNotification: true
    });
  } else {
    // Show local notification only if no system notification
    await notificationService.showLocalNotification(
      remoteMessage.notification?.title || 'New Notification',
      remoteMessage.notification?.body || 'You have a new notification',
      {
        ...data,
        fromBackground: true,
        messageId: remoteMessage.messageId || `bg-${Date.now()}`,
        originalMessage: remoteMessage
      }
    );
  }
});

// Main App Component
const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs to prevent re-renders
  const initializationRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const notificationService = useRef(NotificationService.getInstance());

  const navigationRef = useNavigationContainerRef();
  const {
    isGranted,
    fcmToken,
    requestPermission
  } = useNotificationPermission(navigationRef);

  // Memoized values
  const screenOptions = useMemo(() => ({ headerShown: false }), []);
  const apiConfig = useMemo(() => ({
    baseURL: API_BASE_URL,
    timeout: 10000,
  }), []);

  // Set global navigation reference
  useEffect(() => {
    if (navigationRef.current) {
      globalNavigationRef = navigationRef.current;
      notificationService.current.setNavigationRef(navigationRef.current);
      console.log('🧭 Global navigation ref updated');
    }
  }, [navigationRef]);

  // Authentication check
  const checkAuthToken = useCallback(async () => {
    if (initializationRef.current) return;

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

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState) => {
    const previousAppState = appStateRef.current;
    appStateRef.current = nextAppState;

    if (previousAppState !== nextAppState) {
      console.log(`AppState changed: ${previousAppState} → ${nextAppState}`);
      
      if (nextAppState === 'active' && previousAppState === 'background') {
        console.log('App returned to foreground');
        // Check for pending notifications with delay to ensure navigation is ready
        setTimeout(() => {
          checkPendingNotifications();
        }, 1000);
      }
    }
  }, []);

  // Check for pending notifications when app becomes active
  const checkPendingNotifications = useCallback(async () => {
    try {
      const pendingNotification = await notificationService.current.getPendingNotification();
      if (pendingNotification) {
        console.log('📱 Processing pending notification');
        // Ensure navigation ref is available before processing
        if (globalNavigationRef) {
          notificationService.current.handleNotificationTap(pendingNotification.data);
        } else {
          console.log('⏳ Navigation not ready, retrying in 500ms');
          setTimeout(() => {
            if (globalNavigationRef) {
              notificationService.current.handleNotificationTap(pendingNotification.data);
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('❌ Error checking pending notifications:', error);
    }
  }, []);

  // Initialize app
  useEffect(() => {
    if (isInitialized) return;

    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing app...');
        
        // Initialize notification service
        await notificationService.current.initialize();
        
        // Check authentication
        await checkAuthToken();
        
        // Request permissions
        await requestPermission();
        
        setIsInitialized(true);
        console.log('✅ App initialization complete');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [isInitialized, checkAuthToken, requestPermission]);

  // Check for pending notifications after navigation is ready
  useEffect(() => {
    if (isInitialized && globalNavigationRef) {
      // Small delay to ensure navigation is fully ready
      setTimeout(() => {
        checkPendingNotifications();
      }, 500);
    }
  }, [isInitialized, globalNavigationRef, checkPendingNotifications]);

  // Setup notification listeners
  useEffect(() => {
    if (!isInitialized) return;

    let fcmUnsubscribe;
    let notificationListener;
    let responseListener;

    const setupListeners = async () => {
      // FCM foreground message handler
      fcmUnsubscribe = messaging().onMessage(async (remoteMessage) => {
        console.log('📱 Foreground FCM message received');
        await notificationService.current.showLocalNotification(
          remoteMessage.notification?.title,
          remoteMessage.notification?.body,
          {
            ...remoteMessage.data,
            fromForeground: true,
            messageId: remoteMessage.messageId,
            originalMessage: remoteMessage
          }
        );
      });

      // Handle notification opening app (FCM notification tap)
      messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('📱 FCM Notification opened app:', remoteMessage);
        
        if (remoteMessage && remoteMessage.data) {
          console.log('👆 FCM notification tapped, navigating to Home');
          notificationService.current.handleNotificationTap(remoteMessage.data);
        }
      });

      // Check if app was opened from a notification (when app was completely closed)
      messaging().getInitialNotification().then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 App opened from FCM notification:', remoteMessage);
          
          // Small delay to ensure navigation is ready
          setTimeout(() => {
            if (remoteMessage.data) {
              console.log('👆 Initial FCM notification, navigating to Home');
              notificationService.current.handleNotificationTap(remoteMessage.data);
            }
          }, 2000);
        }
      });

      // Notification received listener
      notificationListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('📱 Notification received:', notification.request.content.title);
      });

      // Notification response listener (when user taps)
      responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapped');
        console.log('Response:', response);
        
        const { notification, actionIdentifier } = response;
        const data = notification.request.content.data;

        console.log('Action identifier:', actionIdentifier);
        console.log('Notification data:', data);

        if (actionIdentifier === 'ACCEPT') {
          console.log('✅ User accepted ride');
          notificationService.current.handleNotificationTap(data);
        } else if (actionIdentifier === 'DECLINE') {
          console.log('❌ User declined ride');
          // Handle decline logic here
        } else if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          console.log('👆 User tapped notification body - navigating to Home');
          notificationService.current.handleNotificationTap(data);
        } else {
          // Handle any other tap scenarios
          console.log('👆 Unknown action, navigating to Home');
          notificationService.current.handleNotificationTap(data);
        }
      });
    };

    setupListeners();

    return () => {
      fcmUnsubscribe?.();
      notificationListener && Notifications.removeNotificationSubscription(notificationListener);
      responseListener && Notifications.removeNotificationSubscription(responseListener);
    };
  }, [isInitialized]);

  // App state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

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
                      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                      <Stack.Screen 
                        name="register" 
                        component={RegistrationForm}
                        options={{ headerShown: true, title: 'Complete Profile' }}
                      />
                      <Stack.Screen name="UploadDocuments" component={Document} />
                      <Stack.Screen name="Wait_Screen" component={Wait_Screen} />
                      <Stack.Screen name="Home" component={HomeScreen} />
                      <Stack.Screen name="start" component={RunningRide} />
                      <Stack.Screen name="support" component={SupportScreen} />
                      <Stack.Screen name="collect_money" component={MoneyPage} />
                      <Stack.Screen name="AllRides" component={AllRides} />
                      <Stack.Screen name="NewRideScreen" component={RideRequestScreen} />
                      <Stack.Screen name="UnlockCoupons" component={UnlockCoupons} />
                      <Stack.Screen name="Profile" component={Profile} />
                      <Stack.Screen name="upload-qr" component={UploadQr} />
                      <Stack.Screen name="enter_bh" component={BhVerification} />
                      <Stack.Screen name="Register" component={RegisterWithBh} />
                      <Stack.Screen name="OtpVerify" component={BhOtpVerification} />
                      <Stack.Screen name="Recharge" component={RechargeViaOnline} />
                      <Stack.Screen name="recharge-history" component={RechargeHistory} />
                      <Stack.Screen name="WorkingData" component={WorkingData} />
                      <Stack.Screen name="referral-history" component={ReferalHistory} />
                      <Stack.Screen name="withdraw" component={Withdraw} />
                      <Stack.Screen name="ParcelDetails" component={NewParcelLive} />
                      <Stack.Screen 
                        name="DeliveryTracking" 
                        component={DeliveryTracking}
                        options={{ headerShown: false }}
                      />
                      <Stack.Screen 
                        name="available-orders" 
                        component={AvailableOrder}
                        options={{ headerShown: false, title: "Available Orders" }}
                      />
                      <Stack.Screen 
                        name="progress-order" 
                        component={ProgressOrder}
                        options={{ headerShown: true, title: "Progress Orders" }}
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

// Memoized wrapped components
const WrappedApp = React.memo(Sentry.wrap(App));
const RootApp = React.memo(() => (
  <ErrorBoundaryWrapper>
    <CheckAppUpdate>
      <WrappedApp />
    </CheckAppUpdate>
  </ErrorBoundaryWrapper>
));

AppRegistry.registerComponent(appName, () => RootApp);
export default RootApp;