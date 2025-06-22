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
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Sentry from '@sentry/react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import './context/firebaseConfig';
import { name as appName } from './app.json';
import { store } from './redux/store';
import { SocketProvider } from './context/SocketContext';
import { LocationProvider } from './context/LocationContext';
import { registerBackgroundSocketTask } from './context/backgroundTasks/socketTask';
import Loading from './components/Loading';
import ActiveRideButton from './ActiveRideButton';
import ErrorBoundaryWrapper from './ErrorBoundary';
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

const TASK_NAME = 'BACKGROUND_NOTIFICATION_TASK';
const Stack = createNativeStackNavigator();

Sentry.init({
  dsn: 'https://cb37ba59c700e925974e3b36d10e8e5b@o4508691997261824.ingest.us.sentry.io/4508692015022080',
  environment: 'production',
  enableInExpoDevelopment: true,
  debug: false,
  tracesSampleRate: 1.0,
});



const getExpoPushToken = async () => {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    console.log('Expo Push Token:', data);
    return data;
  } catch (error) {
    console.error('Error fetching Expo push token:', error);
  }
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [activeRide, setActiveRide] = useState(false);
  const [activeRideData, setActiveRideData] = useState(null);
  const navigationRef = useNavigationContainerRef();
  const intervalRef = useRef(null);
  const { fcmToken, lastNotification } = useNotificationPermission();

  const checkAuthToken = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        setInitialRoute('Onboarding');
        return;
      }

      const response = await axios.get('https://www.appv2.olyox.com/api/v1/rider/user-details', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { partner } = response.data;
      if (partner?.on_ride_id) {
        setActiveRide(true);
        await fetchRideDetails(partner.on_ride_id);
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
    } catch (error) {
      console.error('Auth error:', error?.response?.data?.message || error.message);
      setInitialRoute('Onboarding');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRideDetails = useCallback(async (rideId) => {
    try {
      const response = await axios.get(`https://www.appv2.olyox.com/rider/${rideId}`);
      setActiveRideData(response.data);
    } catch (error) {
      console.error('Error fetching ride details:', error?.response?.data);
    }
  }, []);

  // const updateFcmToken = useCallback(async () => {
  //   if (!fcmToken) return;
  //   try {
  //     const authToken = await SecureStore.getItemAsync('auth_token_cab');
  //     if (authToken) {
  //       await axios.post(
  //         'https://www.appv2.olyox.com/api/v1/rider/update-fcm-token',
  //         { fcm_token: fcmToken },
  //         { headers: { Authorization: `Bearer ${authToken}` } }
  //       );
  //       console.log('FCM token updated on server');
  //     }
  //   } catch (error) {
  //     console.error('Error updating FCM token:', error?.response?.data);
  //   }
  // }, [fcmToken]);

  const checkActiveRideStatus = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) return;

      const response = await axios.get('https://www.appv2.olyox.com/api/v1/rider/user-details', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { partner } = response.data;
      if (partner?.on_ride_id) {
        setActiveRide(true);
        await fetchRideDetails(partner.on_ride_id);
      } else {
        setActiveRide(false);
        setActiveRideData(null);
      }
    } catch (error) {
      console.error('Error checking ride status:', error);
    }
  }, [fetchRideDetails]);



  const handleAppStateChange = useCallback(
    (nextAppState) => {
      console.log(`AppState changed to: ${nextAppState}`);
      if (nextAppState === 'active') {
        console.log('App returned to foreground');
        // stopBackgroundLogging();
        checkActiveRideStatus();
        // updateFcmToken();
      } else if (nextAppState === 'background') {
        console.log('App moved to background');
 
        checkActiveRideStatus();
      }
    },
    [checkActiveRideStatus]
  );

  useEffect(() => {
    console.log('Mounting App, initial intervalRef:', !!intervalRef.current);
    checkAuthToken();
    getExpoPushToken();
  }, [checkAuthToken]);



  useEffect(() => {
    if (lastNotification) {
      console.log('Handling notification:', lastNotification);
      const data = lastNotification.request?.content?.data || {};
      if (data.type === 'ride_request') {
        navigationRef.navigate('NewRideScreen', { rideId: data.ride_id });
      } else if (data.type === 'ride_update') {
        navigationRef.navigate('start', { rideId: data.ride_id });
      }
    }
  }, [lastNotification, navigationRef]);

  useEffect(() => {
    console.log('Setting up AppState listener');
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      console.log('Cleaning up AppState listener');
      subscription.remove();
      // stopBackgroundLogging();
    };
  }, [handleAppStateChange]);

  if (isLoading) return <Loading />;

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
                    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                      <Stack.Screen name="register" options={{ headerShown: true, title: 'Complete Profile' }} component={RegistrationForm} />
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
                      <Stack.Screen name="DeliveryTracking" options={{ headerShown: false }} component={DeliveryTracking} />
                      <Stack.Screen name="available-orders" options={{ headerShown: false, title: "Available Orders" }} component={AvailableOrder} />
                      <Stack.Screen name="progress-order" options={{ headerShown: true, title: "Progress Orders" }} component={ProgressOrder} />
                    </Stack.Navigator>
                    {/* {activeRide && <ActiveRideButton rideData={activeRideData} />} */}
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