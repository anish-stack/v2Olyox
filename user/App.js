import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import './context/firebaseConfig';

import * as Location from 'expo-location';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { View, Text, StyleSheet, Linking, TouchableOpacity, Platform } from 'react-native';

import { SocketProvider } from './context/SocketContext';
import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import * as IntentLauncher from 'expo-intent-launcher';
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import LottieView from 'lottie-react-native';
import * as Application from 'expo-application';

// Import screens
import HomeScreen from './screens/HomeScreen';
import Collect_Data from './Ride/First_Step_screen/Collect_Data';
import Show_Cabs from './Ride/Show_near_by_cab/Show_Cabs';
import { DriverMatching } from './Ride/Show_near_by_cab/Driver_matching';
import { RideConfirmed } from './Ride/Show_near_by_cab/Ride_Confirmed';
import Hotels_details from './Hotels/Hotel_Details/Hotels_details';
import Single_Hotel_details from './Hotels/Hotel_Details/Single_Hotel_details';
import BookingSuccess from './Hotels/Hotel_Details/BookingSuccess';
import OnboardingScreen from './onboarding/Onboarding';
import Ride_Rating from './Ride/Show_near_by_cab/Ride_Rating';
import AllHotel from './Hotels/Hotel_Details/AllHotel';
import AllFoods from './Foods/Top_Foods/AllFoods';
import { LocationProvider } from './context/LocationContext';
import Food_Dispay_Page from './Foods/Food_Page/Food_Dispay_Page';
import { FoodProvider } from './context/Food_Context/Food_context';
import Restaurant from './Foods/Restaurant/Restaurant';
import Checkout from './Foods/Checkout/Checkout';
import OrderTracking from './Foods/Order_Process/Order_Process';
import MainTransport from './Transport/Main.Transport';
import Parcel_Transport from './Transport/Parcel_Transport/Parcel_Transport';
import BookParcel from './Transport/Parcel_Transport/Book-Parcel';
import Parcel_Orders from './Transport/Parcel_Transport/Parcel_orders/Parcel_Orders';
import OrderDetails from './Transport/Parcel_Transport/Parcel_orders/OrderDetails';
import UserProfile from './screens/Profile';
import Tiffins_Page from './Foods/Tiffins_Page/Tiffins_Page';
import ErrorBoundaryWrapper from './context/ErrorBoundary';
import { tokenCache } from './Auth/cache';
import BookingConfirmation from './Ride/Show_near_by_cab/confirm_booking';
import Policy from './policy/Policy';
import Help_On from './onboarding/Help/Help_On';
import LocationErrorScreen from './LocationError';
import SplashScreen from './screens/SplashScreen';
import { GuestProvider } from './context/GuestLoginContext';
import Get_Pickup_Drop from './Parcel_Booking/Get_Pickup_Drop';
import { BookingParcelProvider } from './context/ParcelBookingContext/ParcelBookingContext';
import Choose_Vehicle from './Parcel_Booking/Choose_Vehicle';
import PaymentScreen from './Parcel_Booking/PaymentScreen';
import FindRider from './Parcel_Booking/FindRider/FindRider';
import { RideProvider } from './context/RideContext';
import RideLocationSelector from './Ride/First_Step_screen';
import useNotificationPermission from './hooks/notification';
import { find_me } from './utils/helpers';
import axios from 'axios';
import OlyoxAppUpdate from './context/CheckAppUpdate';
import OnWayRide from './New Screen/OnWayRide';
import RateRiderOrRide from './New Screen/RateRiderOrRide';

const Stack = createNativeStackNavigator();

// Initialize Sentry
Sentry.init({
  dsn: "https://c73ead860e964d854e9985d11321815e@o4508943362621440.ingest.de.sentry.io/4508943364194384",
  enableInExpoDevelopment: true,
  debug: false,
  tracesSampleRate: 1.0,
});

// Constants
const MAX_LOADING_TIME = 5000;
const MIN_UPDATE_INTERVAL = 10000;
const MAX_RETRY_ATTEMPTS = 3;
const API_URL = "http://192.168.1.6:3100/api/v1";

// Define location error types
const ERROR_TYPES = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  LOCATION_UNAVAILABLE: 'LOCATION_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
};

// Helper function to determine if locations are significantly different
const isSignificantLocationChange = (prevLocation, newLocation) => {
  if (!prevLocation || !newLocation) return true;

  const prevCoords = prevLocation.coords || prevLocation;
  const newCoords = newLocation.coords || newLocation;

  const latDiff = Math.abs(prevCoords.latitude - newCoords.latitude);
  const lngDiff = Math.abs(prevCoords.longitude - newCoords.longitude);

  return (latDiff > 0.0001 || lngDiff > 0.0001);
};

// Memoized LocationErrorScreen wrapper to prevent recreating on every render
const LocationErrorScreenWrapper = React.memo(({ locationError, openSettings, getLocationInBackground }) => (
  <LocationErrorScreen
    getLocationInBackground={getLocationInBackground}
    locationError={locationError}
    openSettings={openSettings}
  />
));

// Memoized error banner component
const ErrorBanner = React.memo(({ locationError }) => {
  const handlePress = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          {
            data: 'package:' + Application.applicationId,
          }
        );
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      Sentry.captureException(error);
    }
  }, []);

  if (!locationError) return null;

  return (
    <TouchableOpacity style={styles.errorBanner} onPress={handlePress}>
      <Text style={styles.errorBannerText}>
        Location service issue. Tap to fix.
      </Text>
    </TouchableOpacity>
  );
});

// Memoized loading screen component
const LoadingScreen = React.memo(() => (
  <View style={styles.loaderContainer}>
    <StatusBar style="auto" />
    <LottieView
      source={require('./location.json')}
      autoPlay
      loop
      style={styles.lottieAnimation}
    />
    <Text style={styles.loadingText}>Getting ready...</Text>
  </View>
));

const App = () => {
  // State
  const [isLogin, setIsLogin] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [locationFetchRetries, setLocationFetchRetries] = useState(0);
  const [fcmTokenSent, setFcmTokenSent] = useState(false);

  // Refs
  const locationRef = useRef(null);
  const watchSubscriptionRef = useRef(null);
  const lastLocationUpdateTimeRef = useRef(0);
  const userDataRef = useRef(null);
  const fcmTokenSentRef = useRef(false);

  // Hooks
  const { isGranted, requestPermission, deviceId, fcmToken } = useNotificationPermission();

  // Memoized open settings function
  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
        );
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      Sentry.captureException(error);
    }
  }, []);

  // Memoized throttled location update function
  const updateLocationState = useCallback((newLocation) => {
    const now = Date.now();
    locationRef.current = newLocation;

    if (now - lastLocationUpdateTimeRef.current >= MIN_UPDATE_INTERVAL ||
      isSignificantLocationChange(locationRef.current, newLocation)) {
      console.log("📍 Updating location state:", newLocation);
      lastLocationUpdateTimeRef.current = now;
    }

    setInitialLoading(false);
  }, []);

  // Memoized location service manager
  const getLocationInBackground = useCallback(async () => {
    try {
      // Cleanup any existing subscription
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }

      // Step 1: Check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      console.log("🔍 Location services enabled:", isLocationEnabled);
      if (!isLocationEnabled) {
        setLocationError(ERROR_TYPES.LOCATION_UNAVAILABLE);
        return;
      }

      // Step 2: Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("🔐 Location permission status:", status);

      if (status !== 'granted') {
        setLocationError(ERROR_TYPES.PERMISSION_DENIED);
        return;
      }

      // Step 3: Get quick but less accurate location first
      try {
        const quickLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
          maximumAge: 60000,
        });

        console.log("📍 Got quick initial location:", quickLocation);
        updateLocationState(quickLocation);

        // Then get more accurate location in background
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        }).then(accurateLocation => {
          console.log("📍 Got accurate location:", accurateLocation);
          updateLocationState(accurateLocation);
        }).catch(error => {
          console.log("Could not get accurate location:", error);
        });

      } catch (error) {
        console.error('❌ Error getting location from App .js:', error);

        try {
          const lastKnownLocation = await Location.getLastKnownPositionAsync();
          if (lastKnownLocation) {
            console.log("📍 Using last known location:", lastKnownLocation);
            updateLocationState(lastKnownLocation);
            setLocationError(null);
          } else {
            throw new Error("No last known location");
          }
        } catch (fallbackError) {
          if (error.message && error.message.includes('timeout')) {
            setLocationError(ERROR_TYPES.TIMEOUT);
          } else {
            setLocationError(ERROR_TYPES.UNKNOWN);
          }
          setLocationFetchRetries(prev => prev + 1);
        }
      }

      // Step 4: Start watching position for updates
      watchSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 10,
        },
        (newLocation) => {
          updateLocationState(newLocation);
        }
      );

    } catch (error) {
      console.error('❗ Error in location service:', error);
      Sentry?.captureException?.(error);
      setLocationError(ERROR_TYPES.UNKNOWN);
    }
  }, [updateLocationState]);

  // Check login status - only run once
  useEffect(() => {
    let isMounted = true;

    const checkLoginStatus = async () => {
      try {
        const db_token = await tokenCache.getToken('auth_token_db');
        if (isMounted) {
          setIsLogin(db_token !== null);

          if (db_token !== null) {
            const userData = await find_me();
            if (isMounted) {
              userDataRef.current = userData;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
        Sentry.captureException(error);
      }
    };

    checkLoginStatus();

    // Set timeout to proceed regardless of location status
    const timer = setTimeout(() => {
      if (isMounted) {
        setInitialLoading(false);
      }
    }, MAX_LOADING_TIME);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  // FCM Token handling - optimized with ref to prevent multiple calls
  useEffect(() => {
    if (fcmTokenSentRef.current || !fcmToken || !userDataRef.current?.user?._id) {
      return;
    }

    const sendFcmTokenToServer = async () => {
      try {
        console.log("📤 Sending FCM token to server:", { fcmToken, userId: userDataRef.current.user._id });

        await axios.post(`${API_URL}/rider/fcm/add`, {
          fcm: fcmToken,
          id: userDataRef.current.user._id,
        });

        console.log("✅ FCM token sent successfully");
        fcmTokenSentRef.current = true;
        setFcmTokenSent(true);
      } catch (error) {
        console.error("❌ FCM registration error:", error?.response?.data || error.message);
        Sentry.captureException(error);
      }
    };

    sendFcmTokenToServer();
  }, [fcmToken, userDataRef.current?.user?._id]);

  // Initial location fetch - only run once
  useEffect(() => {
    getLocationInBackground();

    return () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
        console.log("🧹 Cleaned up location watcher.");
      }
    };
  }, []); // Empty dependency array - only run once

  // Handle location retry logic - optimized
  useEffect(() => {
    if ((locationError === ERROR_TYPES.TIMEOUT || locationError === ERROR_TYPES.UNKNOWN) &&
      locationFetchRetries <= MAX_RETRY_ATTEMPTS) {
      const retryDelay = locationFetchRetries * 5000;
      const retryTimer = setTimeout(() => {
        getLocationInBackground();
      }, retryDelay);

      return () => clearTimeout(retryTimer);
    }
  }, [locationError, locationFetchRetries]); // Removed getLocationInBackground from deps

  // Handle notification permission request - optimized
  const handleRequestNotificationPermission = useCallback(async () => {
    if (isGranted) return;

    console.log("🔔 Requesting notification permission...");
    try {
      const granted = await requestPermission();
      console.log("✅ Notification permission granted:", granted);
    } catch (error) {
      console.error("❌ Notification permission error:", error.message || error);
      Sentry.captureException(error);
    }
  }, [requestPermission, isGranted]);

  // App initialization - only run once
  useEffect(() => {
    const initApp = async () => {
      console.log("🔄 App initialization started...");
      try {
        await handleRequestNotificationPermission();
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log("✅ App initialized");
      } catch (error) {
        console.error("❌ App initialization error:", error.message || error);
        Sentry.captureException(error);
      }
    };

    initApp();
  }, []); // Empty dependency array

  // Routes definition - memoized with useMemo for better performance
  const routes = useMemo(() => (
    <>
      <Stack.Screen name="Home" options={{ headerShown: false }} component={HomeScreen} />
      {/* Booking Ride Screens */}
      <Stack.Screen name="Start_Booking_Ride" options={{ headerShown: false }} component={RideLocationSelector} />
      <Stack.Screen name="second_step_of_booking" options={{ headerShown: false }} component={Show_Cabs} />
      <Stack.Screen name="confirm_screen" options={{ headerShown: false }} component={BookingConfirmation} />
      <Stack.Screen name="driver_match" options={{ headerShown: false }} component={DriverMatching} />
      <Stack.Screen name="RideStarted" options={{ headerShown: false }} component={OnWayRide} />
      <Stack.Screen name="RateRiderOrRide" options={{ headerShown: false }} component={RateRiderOrRide} />
      {/* Hotel Booking Screens */}
      <Stack.Screen name="hotels-details" options={{ headerShown: false }} component={Hotels_details} />
      <Stack.Screen name="Hotel" options={{ headerShown: false }} component={AllHotel} />
      <Stack.Screen name="Single-hotels-listing" options={{ headerShown: false }} component={Single_Hotel_details} />
      <Stack.Screen name="Booking_hotel_success" options={{ headerShown: false }} component={BookingSuccess} />
      {/* Food Screens */}
      <Stack.Screen name="Tiffin" options={{ headerShown: false }} component={AllFoods} />
      <Stack.Screen name="Tiffins_Page" options={{ headerShown: false, title: "Tiffins Package" }} component={Tiffins_Page} />
      <Stack.Screen name="food_Page_By_Cats" options={{ headerShown: false }} component={Food_Dispay_Page} />
      <Stack.Screen name="restaurants_page" options={{ headerShown: false }} component={Restaurant} />
      <Stack.Screen name="Checkout" options={{ headerShown: Platform.OS === "ios" ? false : true }} component={Checkout} />
      <Stack.Screen name="Order_Process" options={{ headerShown: false }} component={OrderTracking} />
      {/* User Profile and Auth */}
      <Stack.Screen name="Profile" options={{ headerShown: false }} component={UserProfile} />
      {/* Transport */}
      <Stack.Screen name="Transport" options={{ headerShown: false }} component={MainTransport} />
      <Stack.Screen name="delivery_parcel" options={{ headerShown: false }} component={Parcel_Transport} />
      <Stack.Screen name="Book-Parcel" options={{ headerShown: false }} component={BookParcel} />
      <Stack.Screen name="Parcel" options={{ headerShown: true }} component={Parcel_Orders} />
      <Stack.Screen name="OrderDetails" options={{ headerShown: false }} component={OrderDetails} />
      <Stack.Screen name="Onboarding" options={{ headerShown: false }} component={OnboardingScreen} />

      {/* Parcel_Booking Screens */}
      <Stack.Screen name="Parcel_Booking" options={{ headerShown: false }} component={Get_Pickup_Drop} />
      <Stack.Screen name="Choose_Vehicle" options={{ headerShown: false }} component={Choose_Vehicle} />
      <Stack.Screen name="PaymentScreen" options={{ headerShown: true, title: "Review Booking" }} component={PaymentScreen} />
      <Stack.Screen name="Booking_Complete_Find_Rider" options={{ headerShown: true, title: "Parcel Info" }} component={FindRider} />

      {/* App Policy */}
      <Stack.Screen name="spalsh" options={{ headerShown: false }} component={SplashScreen} />
      <Stack.Screen name="policy" options={{ headerShown: true, title: "Olyox App Polices" }} component={Policy} />
      <Stack.Screen name="policyauth" options={{ headerShown: true, title: "Olyox App Polices" }} component={Policy} />
      <Stack.Screen name="Help_me" options={{ headerShown: true, title: "Olyox Center" }} component={Help_On} />

      {/* Error Screen */}
      <Stack.Screen
        name="LocationError"
        options={{ headerShown: false }}
        children={(props) => (
          <LocationErrorScreenWrapper
            {...props}
            getLocationInBackground={getLocationInBackground}
            locationError={locationError}
            openSettings={openSettings}
          />
        )}
      />
    </>
  ), [locationError, openSettings, getLocationInBackground]);

  // Early return for loading state
  if (initialLoading) {
    return <LoadingScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SocketProvider>
        <LocationProvider initialLocation={locationRef.current}>
          <GuestProvider>
            <RideProvider>
              <BookingParcelProvider>
                <SafeAreaProvider>
                  <StatusBar style="auto" />
                  <ErrorBoundaryWrapper>
                    <NavigationContainer>
                      <Stack.Navigator initialRouteName={'spalsh'}>
                        {routes}
                      </Stack.Navigator>
                      <ErrorBanner locationError={locationError} />
                    </NavigationContainer>
                  </ErrorBoundaryWrapper>
                </SafeAreaProvider>
              </BookingParcelProvider>
            </RideProvider>
          </GuestProvider>
        </LocationProvider>
      </SocketProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  lottieAnimation: {
    width: 200,
    height: 200,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  errorBannerText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// Memoize the main App component
const MemoizedApp = React.memo(App);
const WrappedApp = Sentry.wrap(MemoizedApp);

const RootApp = () => (
  <FoodProvider>
    <OlyoxAppUpdate>
      <WrappedApp />
    </OlyoxAppUpdate>
  </FoodProvider>
);

AppRegistry.registerComponent(appName, () => RootApp);

export default RootApp;