import React, { useState, useEffect } from 'react';
import { AppState, Platform, LogBox, View, Text, Button, StatusBar } from 'react-native';
import { AppRegistry } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';

import * as TaskManager from 'expo-task-manager';
import * as Sentry from '@sentry/react-native';
import './context/firebaseConfig';

import { name as appName } from './app.json';
import { store } from './redux/store';
import { SocketProvider } from './context/SocketContext';
import { LocationProvider } from './context/LocationContext';
import { registerBackgroundSocketTask, testBackgroundTaskNow } from './context/backgroundTasks/socketTask';

import Loading from './components/Loading';
import ActiveRideButton from './ActiveRideButton';
import ErrorBoundaryWrapper from './ErrorBoundary';

const TASK_NAME = 'BACKGROUND_NOTIFICATION_TASK';
// Screens
import OnboardingScreen from './screens/onboarding/OnboardingScreen';
import RegistrationForm from './screens/onboarding/registration/RegistrationForm';
import Document from './screens/onboarding/registration/Document';
import Wait_Screen from './screens/Wait_Screen/Wait_Screen';
import HomeScreen from './screens/HomeScreen';
import RideDetailsScreen from './screens/RideDetailsScreen';
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
import { LocalRideStorage } from './services/DatabaseService';
import RideRequestScreen from './screens/Ride.come';
import { RideStatusProvider } from './context/CheckRideHaveOrNot.context';
import NewParcelLive from './screens/Parcel_Screens/NewParcelLive/NewParcelLive';
import DeliveryTracking from './screens/Parcel_Screens/DeliveryTracking/DeliveryTracking';
import AvailableOrder from './screens/Parcel_Screens/Available_Orders/AvailableOrder';
import ProgressOrder from './screens/Parcel_Screens/ProgressOrder/ProgressOrder';
import UnlockCoupons from './screens/Unlock/UnlockCoupons';
import CheckAppUpdate from './context/CheckAppUpdate';
import useNotificationPermission from './hooks/notification';
import RunningRide from './New Screens/on_way_ride/RunningRide';

LogBox.ignoreLogs(['Setting a timer']);

const Stack = createNativeStackNavigator();

// Sentry Initialization
Sentry.init({
  dsn: 'https://cb37ba59c700e925974e3b36d10e8e5b@o4508691997261824.ingest.us.sentry.io/4508692015022080',
  environment: 'production',
  enableInExpoDevelopment: true,
  debug: false,
  tracesSampleRate: 1.0,
});

TaskManager.defineTask(TASK_NAME, async ({ data, error, executionInfo }) => {
  if (error) {
    console.log('❌ Background Task Error:', error);
    return;
  }

  console.log('📥 Background notification received From App.js:', data ? data : null);
});

export async function getExpoPushToken() {
  const tokenData = await Notifications.getExpoPushTokenAsync();
  console.log("Expo Push Token:", tokenData.data);
  return tokenData.data;
}

const App = () => {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [activeRide, setActiveRide] = useState(false);
  const [activeRideData, setActiveRideData] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const [currentRoute, setCurrentRoute] = useState(null);

  // Use the notification hook
  const {
    permissionStatus,
    isGranted,
    requestPermission,
    fcmToken,
    getToken,
    showNotification,
    lastNotification,
    lastFcmMessage
  } = useNotificationPermission();

  // Handle authentication and user state
  useEffect(() => {
    const checkAuthToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token_cab');

        if (token) {
          const response = await axios.get(
            'https://www.appapi.olyox.com/api/v1/rider/user-details',
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const partner = response.data.partner;
          if (partner.hasOwnProperty('on_ride_id') && partner.on_ride_id != null) {
            setActiveRide(true);
            await foundRideDetails(partner.on_ride_id);
          } else {
            setActiveRide(false);
          }

          if (!partner?.isDocumentUpload) {
            setInitialRoute('UploadDocuments');
          } else if (!partner?.DocumentVerify) {
            setInitialRoute('Wait_Screen');
          } else {
            setInitialRoute('Home');
          }
        } else {
          setInitialRoute('Onboarding');
        }
      } catch (error) {
        console.error('Auth error:', error?.response?.data?.message || error.message);
        setInitialRoute('Onboarding');
      } finally {
        setLoading(false);
      }
    };

    checkAuthToken();
  }, []);

  const foundRideDetails = async (temp_ride_id) => {
    console.log("Temp", temp_ride_id);
    try {
      const response = await axios.get(`https://www.appapi.olyox.com/rider/${temp_ride_id}`);
      console.log("hello", response.data);
      setActiveRideData(response.data);
    } catch (error) {
      console.log(error?.response.data);
    }
  };

  // Handle FCM token updates - send to your backend
  useEffect(() => {
    const updateTokenOnServer = async () => {
      if (fcmToken) {
        try {
          const authToken = await SecureStore.getItemAsync('auth_token_cab');
          if (authToken) {
            // Update FCM token on your server
            await axios.post(
              'https://www.appapi.olyox.com/api/v1/rider/update-fcm-token',
              { fcm_token: fcmToken },
              { headers: { Authorization: `Bearer ${authToken}` } }
            );
            console.log('✅ FCM token updated on server');
          }
        } catch (error) {
          console.error('❌ Error updating FCM token on server:', error.response.data);
        }
      }
    };

    updateTokenOnServer();
  }, [fcmToken]);

  useEffect(() => {
    if (lastNotification) {
      console.log('📱 Handling notification:', lastNotification);
      const data = lastNotification.request?.content?.data || {};

      if (data.type === 'ride_request') {
        navigationRef.navigate('NewRideScreen', { rideId: data.ride_id });
      } else if (data.type === 'ride_update') {
        navigationRef.navigate('start', { rideId: data.ride_id });
      }
    }
  }, [lastNotification, navigationRef]);

  // Handle FCM messages
  useEffect(() => {
    if (lastFcmMessage) {
      console.log('🔥 Handling FCM message:', lastFcmMessage);
      const data = lastFcmMessage.data || {};

      // You can add custom logic here based on FCM message data
      if (data.type === 'ride_status_update') {
        // Refresh ride data or update UI
      }
    }
  }, [lastFcmMessage]);

  // Get Expo push token for additional push notification services
  useEffect(() => {
    getExpoPushToken();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (navigationRef.isReady()) {
        setCurrentRoute(navigationRef.getCurrentRoute()?.name);
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [navigationRef]);

  // Helper function to check active ride status when app comes back
  const checkActiveRideStatus = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (token) {
        console.log('🔄 Checking active ride status after app return...');
        const response = await axios.get(
          'https://www.appapi.olyox.com/api/v1/rider/user-details',
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const partner = response.data.partner;
        if (partner.hasOwnProperty('on_ride_id') && partner.on_ride_id != null) {
          console.log('🚗 Active ride found after app return');
          setActiveRide(true);
          await foundRideDetails(partner.on_ride_id);
        } else {
          console.log('✅ No active ride after app return');
          setActiveRide(false);
        }
      }
    } catch (error) {
      console.error('❌ Error checking ride status after app return:', error);
    }
  };

  // APP STATE MONITORING - This will log "I am back app" when app returns from background
  useEffect(() => {
    let previousAppState = AppState.currentState;

    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 App state transition: ${previousAppState} → ${nextAppState}`);

      // Main functionality - When app returns to active from background or inactive
      if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🎉 I am back app - App returned to foreground!');

        // Additional actions when app comes back:
        // 1. Check for active rides
        checkActiveRideStatus();

        // 2. Update FCM token if needed
        if (fcmToken) {
          updateFCMTokenOnReturn();
        }

        // 3. Refresh location services if needed
        console.log('📍 Refreshing location services...');

        // 4. You can add more custom logic here:
        // - Sync offline data
        // - Check for app updates
        // - Reconnect websockets
        // - Refresh user balance/wallet
      } else if (nextAppState === 'background') {
        console.log('📱 App went to background - Saving state...');
        checkActiveRideStatus();
        
        // You can save important data here before app goes to background
      } else if (nextAppState === 'inactive') {
        console.log('📱 App became inactive');
      }

      previousAppState = nextAppState;
    };

    // Add the event listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Log initial app state
    console.log('📱 Initial app state:', AppState.currentState);

    // Cleanup function to remove the event listener
    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, [fcmToken]); // Dependencies: fcmToken so it updates when token changes

  // Helper function to update FCM token when app returns
  const updateFCMTokenOnReturn = async () => {
    try {
      const authToken = await SecureStore.getItemAsync('auth_token_cab');
      if (authToken && fcmToken) {
        await axios.post(
          'https://www.appapi.olyox.com/api/v1/rider/update-fcm-token',
          { fcm_token: fcmToken },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✅ FCM token refreshed on app return');
      }
    } catch (error) {
      console.error('❌ Error refreshing FCM token on app return:', error);
    }
  };

  if (loading) return <Loading />;

  return (
    <Provider store={store}>
      <PaperProvider>
        <SocketProvider>
          <LocationProvider>
            <RideStatusProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                  <NavigationContainer ref={navigationRef}>
                    <StatusBar barStyle={'dark-content'} />
                    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                      <Stack.Screen name="register" options={{ headerShown: true, title: 'Complete Profile' }} component={RegistrationForm} />
                      <Stack.Screen name="UploadDocuments" component={Document} />
                      <Stack.Screen name="Wait_Screen" component={Wait_Screen} />
                      <Stack.Screen name="Home" component={HomeScreen} />
                      {/* <Stack.Screen name="start" component={RideDetailsScreen} /> old */}
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

                      {/* Parcel Rides */}
                      <Stack.Screen name="ParcelDetails" component={NewParcelLive} />
                      <Stack.Screen name="DeliveryTracking" options={{ headerShown: false }} component={DeliveryTracking} />
                      <Stack.Screen name="available-orders" options={{ headerShown: false, title: "Available Orders" }} component={AvailableOrder} />
                      <Stack.Screen name="progress-order" options={{ headerShown: true, title: "Progress Orders" }} component={ProgressOrder} />
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

const WrappedApp = Sentry.wrap(App);
const RootApp = () => (
  <ErrorBoundaryWrapper>
    <CheckAppUpdate>
      <WrappedApp />
    </CheckAppUpdate>
  </ErrorBoundaryWrapper>
);

AppRegistry.registerComponent(appName, () => RootApp);

export default RootApp;