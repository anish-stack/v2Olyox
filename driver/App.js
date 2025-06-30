import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, StatusBar } from 'react-native';
import { AppRegistry } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
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

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Background Message Handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📩 Background message received:', remoteMessage);
  const messageId = remoteMessage.messageId || `local-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;


  if (!messageId) return;
  
  try {
    // Prevent duplicate processing
    const processedMessages = await AsyncStorage.getItem(PROCESSED_MESSAGES_KEY);
    const processed = processedMessages ? JSON.parse(processedMessages) : [];
    
    if (processed.includes(messageId)) {
      console.log('📩 Message already processed, skipping:', messageId);
      return;
    }
    
    // Add to processed list (keep only last 50)
    processed.push(messageId);
    if (processed.length > 50) {
      processed.splice(0, processed.length - 50);
    }
    await AsyncStorage.setItem(PROCESSED_MESSAGES_KEY, JSON.stringify(processed));
    
    // Store the notification data for when app opens
    await AsyncStorage.setItem('@app:pendingNotification', JSON.stringify({
      data: remoteMessage.data,
      timestamp: Date.now(),
      messageId: messageId
    }));
    
    // Show notification with proper category for actions
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.notification?.title || 'New Message',
        body: remoteMessage.notification?.body || 'You have a new notification',
        data: {
          ...remoteMessage.data,
          fromBackground: true,
          messageId: messageId
        },
        sound: true,
        categoryIdentifier: 'RIDE_REQUEST',
      },
      trigger: null,
    });
    
    console.log('✅ Background notification scheduled with data:', remoteMessage.data);
    
  } catch (error) {
    console.error('❌ Background handler error:', error);
  }
});

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  
  const navigationRef = useNavigationContainerRef();
  const { 
    fcmToken, 
    lastNotification, 
    lastFcmMessage, 
    requestPermission,
    showNotification 
  } = useNotificationPermission(navigationRef);

  // Check authentication and user status
  const checkAuthToken = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        setInitialRoute('Onboarding');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/rider/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
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
    }
  }, []);

  // Get Expo Push Token
  const getExpoPushToken = useCallback(async () => {
    try {
      const { data } = await Notifications.getExpoPushTokenAsync();
      console.log('Expo Push Token:', data);
      return data;
    } catch (error) {
      console.error('Error fetching Expo push token:', error);
    }
  }, []);

  // Handle notification navigation
  const handleNotificationNavigation = useCallback((data) => {
    if (!navigationRef?.current || !data) return;
    
    console.log('🧭 Navigating with data:', data);
    
    try {
      if (data.event === "NEW_RIDE_REQUEST" || data.action === "RIDE_REQUEST") {
        console.log('🚖 Navigating to NewRideScreen with rideId:', data.rideId);
        navigationRef.current.navigate("Home", {
          rideId: data.rideId,
          pickup: data.pickup !== "undefined" ? data.pickup : null,
          drop: data.drop !== "undefined" ? data.drop : null,
          price: data.price !== "undefined" ? data.price : null,
          fromNotification: true,
          timestamp: Date.now(),
        });
      } else if (data.type === 'ride_update') {
        console.log('🔄 Navigating to start screen with rideId:', data.ride_id);
        navigationRef.current.navigate('start', { 
          rideId: data.ride_id,
          fromNotification: true 
        });
      } else {
        console.log('🏠 Navigating to Home screen');
        // Default navigation
        navigationRef.current.navigate("Home", {
          fromNotification: true,
          timestamp: Date.now(),
          notificationData: data
        });
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Fallback navigation
      try {
        navigationRef.current.navigate("Home");
      } catch (fallbackError) {
        console.error('❌ Fallback navigation failed:', fallbackError);
      }
    }
  }, [navigationRef]);

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState) => {
    console.log(`AppState changed to: ${nextAppState}`);
    
    if (nextAppState === 'active') {
      console.log('App returned to foreground');
      // Request permissions if not already granted
      requestPermission();
    }
  }, [requestPermission]);

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
          handleNotificationNavigation(notification.data);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Error checking pending notifications:', error);
    }
  }, [handleNotificationNavigation]);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await checkAuthToken();
        await getExpoPushToken();
        await requestPermission();
        await checkPendingNotifications();
      } catch (error) {
        console.error('❌ App initialization error:', error);
      }
    };

    initializeApp();
  }, [checkAuthToken, getExpoPushToken, requestPermission, checkPendingNotifications]);

  // Handle FCM message navigation
  useEffect(() => {
    if (lastFcmMessage?.data) {
      console.log('Handling FCM message navigation:', lastFcmMessage.data);
      handleNotificationNavigation(lastFcmMessage.data);
    }
  }, [lastFcmMessage, handleNotificationNavigation]);

  // Handle Expo notification navigation
  useEffect(() => {
    if (lastNotification?.request?.content?.data) {
      console.log('Handling Expo notification navigation:', lastNotification.request.content.data);
      handleNotificationNavigation(lastNotification.request.content.data);
    }
  }, [lastNotification, handleNotificationNavigation]);

  // App state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

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
                      screenOptions={{ headerShown: false }}
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
const WrappedApp = Sentry.wrap(App);

// Root App Component
const RootApp = () => (
  <ErrorBoundaryWrapper>
    <CheckAppUpdate>
      <WrappedApp />
    </CheckAppUpdate>
  </ErrorBoundaryWrapper>
);

// Register the app
AppRegistry.registerComponent(appName, () => RootApp);

export default RootApp;