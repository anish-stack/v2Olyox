import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, StatusBar, Platform, NativeModules } from 'react-native';
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
const { FloatingWidget } = NativeModules;

console.log("NativeModules", NativeModules?.FloatingWidget);

// Widget Management Class
class FloatingWidgetManager {
  static instance = null;
  
  static getInstance() {
    if (!FloatingWidgetManager.instance) {
      FloatingWidgetManager.instance = new FloatingWidgetManager();
    }
    return FloatingWidgetManager.instance;
  }

  constructor() {
    this.isWidgetActive = false;
    this.currentAppState = AppState.currentState;
    this.partnerData = null;
  }

  // Update partner data
  updatePartnerData(userData) {
    this.partnerData = userData;
    console.log('🔄 Widget Manager - Partner data updated:', {
      isAvailable: userData?.isAvailable,
      onRideId: userData?.on_ride_id,
      hasValidData: !!userData
    });
  }

  // Update app state
  updateAppState(newState, refreshUserDataCallback = null) {
    const previousState = this.currentAppState;
    this.currentAppState = newState;
    
    console.log(`📱 Widget Manager - App state changed: ${previousState} → ${newState}`);
    
    // If app is going to background and we might need to show widget, refresh user data first
    if (newState === 'background' && refreshUserDataCallback) {
      console.log('🔄 App going to background - refreshing user data before widget decision');
      refreshUserDataCallback().then(() => {
        console.log('✅ User data refreshed, now handling widget visibility');
        this.handleWidgetVisibility();
      }).catch((error) => {
        console.error('❌ Error refreshing user data:', error);
        // Still try to handle widget visibility with existing data
        this.handleWidgetVisibility();
      });
    } else {
      // Handle widget visibility based on app state change
      this.handleWidgetVisibility();
    }
  }

  // Main widget visibility logic
  handleWidgetVisibility() {
    const shouldShowWidget = this.shouldShowWidget();
    
    console.log('🎯 Widget visibility decision:', {
      shouldShow: shouldShowWidget,
      currentState: this.currentAppState,
      isWidgetActive: this.isWidgetActive,
      partnerStatus: {
        isAvailable: this.partnerData?.isAvailable,
        onRideId: this.partnerData?.on_ride_id,
        hasData: !!this.partnerData
      }
    });

    if (shouldShowWidget && !this.isWidgetActive) {
      this.startWidget();
    } else if (!shouldShowWidget && this.isWidgetActive) {
      this.stopWidget();
    }
  }

  // Logic to determine if widget should be shown
  shouldShowWidget() {
    // Don't show widget if app is in active state
    if (this.currentAppState === 'active') {
      console.log('❌ Widget - App is active, not showing widget');
      return false;
    }

    // Don't show widget if no partner data
    if (!this.partnerData) {
      console.log('❌ Widget - No partner data available');
      return false;
    }

    const { isAvailable, on_ride_id } = this.partnerData;

    // Show widget if partner has valid on_ride_id
    if (on_ride_id) {
      console.log('✅ Widget - Partner has active ride, showing widget');
      return true;
    }

    // Show widget if partner is available (but not on ride)
    if (isAvailable && !on_ride_id) {
      console.log('✅ Widget - Partner is available, showing widget');
      return true;
    }

    // Don't show widget if partner is not available and has no ride
    if (!isAvailable && !on_ride_id) {
      console.log('❌ Widget - Partner not available and no ride, not showing widget');
      return false;
    }

    return false;
  }

  // Start the floating widget
  startWidget() {
    try {
      if (FloatingWidget?.startWidget) {
        FloatingWidget.startWidget();
        this.isWidgetActive = true;
        console.log('✅ Floating widget started');
      } else {
        console.warn('⚠️ FloatingWidget.startWidget not available');
      }
    } catch (error) {
      console.error('❌ Error starting floating widget:', error);
    }
  }

  // Stop the floating widget
  stopWidget() {
    try {
      if (FloatingWidget?.stopWidget) {
        FloatingWidget.stopWidget();
        this.isWidgetActive = false;
        console.log('🛑 Floating widget stopped');
      } else {
        console.warn('⚠️ FloatingWidget.stopWidget not available');
      }
    } catch (error) {
      console.error('❌ Error stopping floating widget:', error);
    }
  }

  // Force stop widget (for cleanup)
  forceStopWidget() {
    console.log('🔄 Force stopping widget...');
    this.stopWidget();
  }

  // Get current widget status
  getWidgetStatus() {
    return {
      isActive: this.isWidgetActive,
      appState: this.currentAppState,
      partnerData: this.partnerData,
      shouldShow: this.shouldShowWidget()
    };
  }
}

// Notification Channel Configuration
const NOTIFICATION_CHANNELS = {
  RIDE_REQUEST: {
    id: 'ride_request_channel',
    name: 'Ride Requests',
    description: 'Notifications for incoming ride requests',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'sound.mp3',
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#00FF00',
    category: 'RIDE_REQUEST'
  },
  RIDE_CANCEL: {
    id: 'ride_cancel_channel',
    name: 'Ride Cancellations',
    description: 'Notifications for ride cancellations',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'ride_cancel_sound.mp3',
    vibrationPattern: [0, 300, 100, 300, 100, 300],
    lightColor: '#FF0000',
    category: 'RIDE_CANCEL'
  },
  PAYMENT_COMPLETE: {
    id: 'payment_complete_channel',
    name: 'Payment Completed',
    description: 'Notifications for completed payments',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'payment_complete_sound.mp3',
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#0000FF',
    category: 'PAYMENT_COMPLETE'
  },
  APP_NOTIFICATION: {
    id: 'app_notification_channel',
    name: 'App Notifications',
    description: 'General app notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'app_notification_sound.mp3',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF9500',
    category: 'APP_NOTIFICATION'
  }
};

// Notification Event Types
const NOTIFICATION_EVENTS = {
  RIDE_REQUEST: 'RIDE_REQUEST',
  RIDE_CANCEL: 'RIDE_CANCEL',
  PAYMENT_COMPLETE: 'PAYMENT_COMPLETE',
  APP_NOTIFICATION: 'APP_NOTIFICATION'
};

const Stack = createNativeStackNavigator();

// Global navigation reference
let globalNavigationRef = null;

// Configure Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const channelId = notification.request.content.channelId;
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: channelId !== 'app_notification_channel',
      // Priority based on channel
      priority: channelId === 'ride_request_channel' 
        ? Notifications.AndroidNotificationPriority.MAX 
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

// Enhanced Notification Service Class
class NotificationService {
  static instance = null;
  
  static getInstance() {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  constructor() {
    this.channelsInitialized = false;
  }

  // Initialize notification configuration
  async initialize() {
    try {
      await this.requestPermissions();
      await this.setupNotificationChannels();
      await this.setupNotificationCategories();
      this.channelsInitialized = true;
      console.log('✅ Notification service initialized with 4 channels');
    } catch (error) {
      console.error('❌ Notification initialization error:', error);
    }
  }

  // Request notification permissions
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });

    if (status !== 'granted') {
      console.log('❌ Expo notification permission denied');
    }

    const authStatus = await messaging().requestPermission({
      alert: true,
      announcement: false,
      badge: true,
      carPlay: true,
      provisional: false,
      sound: true,
    });

    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                   authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      const token = await messaging().getToken();
      console.log('🔑 FCM Token:', token);
    }

    return enabled;
  }

  // Setup all notification channels
  async setupNotificationChannels() {
    if (Platform.OS !== 'android') return;

    try {
      for (const [key, channel] of Object.entries(NOTIFICATION_CHANNELS)) {
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          description: channel.description,
          importance: channel.importance,
          vibrationPattern: channel.vibrationPattern,
          lightColor: channel.lightColor,
          sound: channel.sound,
          enableLights: true,
          enableVibrate: true,
          showBadge: channel.id !== 'app_notification_channel',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: channel.id === 'ride_request_channel',
        });

        console.log(`✅ Channel created: ${channel.name} (${channel.id})`);
      }
    } catch (error) {
      console.error('❌ Error creating notification channels:', error);
    }
  }

  // Setup notification categories with actions
  async setupNotificationCategories() {
    try {
      // Ride Request Category (with Accept/Decline actions)
      await Notifications.setNotificationCategoryAsync('RIDE_REQUEST', [
        {
          identifier: 'ACCEPT',
          buttonTitle: 'Accept Ride',
          options: { 
            opensAppToForeground: true,
            isDestructive: false,
            isAuthenticationRequired: false
          },
        },
        {
          identifier: 'DECLINE',
          buttonTitle: 'Decline',
          options: { 
            opensAppToForeground: false,
            isDestructive: true,
            isAuthenticationRequired: false
          },
        },
      ]);

      // Ride Cancel Category (with View Details action)
      await Notifications.setNotificationCategoryAsync('RIDE_CANCEL', [
        {
          identifier: 'VIEW_DETAILS',
          buttonTitle: 'View Details',
          options: { 
            opensAppToForeground: true,
            isDestructive: false,
            isAuthenticationRequired: false
          },
        },
      ]);

      // Payment Complete Category (with View Earnings action)
      await Notifications.setNotificationCategoryAsync('PAYMENT_COMPLETE', [
        {
          identifier: 'VIEW_EARNINGS',
          buttonTitle: 'View Earnings',
          options: { 
            opensAppToForeground: true,
            isDestructive: false,
            isAuthenticationRequired: false
          },
        },
      ]);

      // App Notification Category (with Open App action)
      await Notifications.setNotificationCategoryAsync('APP_NOTIFICATION', [
        {
          identifier: 'OPEN_APP',
          buttonTitle: 'Open App',
          options: { 
            opensAppToForeground: true,
            isDestructive: false,
            isAuthenticationRequired: false
          },
        },
      ]);

      console.log('✅ All notification categories configured');
    } catch (error) {
      console.error('❌ Error setting up notification categories:', error);
    }
  }

  // Get channel configuration by event type
  getChannelByEventType(eventType) {
    switch (eventType) {
      case NOTIFICATION_EVENTS.RIDE_REQUEST:
        return NOTIFICATION_CHANNELS.RIDE_REQUEST;
      case NOTIFICATION_EVENTS.RIDE_CANCEL:
        return NOTIFICATION_CHANNELS.RIDE_CANCEL;
      case NOTIFICATION_EVENTS.PAYMENT_COMPLETE:
        return NOTIFICATION_CHANNELS.PAYMENT_COMPLETE;
      case NOTIFICATION_EVENTS.APP_NOTIFICATION:
      default:
        return NOTIFICATION_CHANNELS.APP_NOTIFICATION;
    }
  }

  // Check for duplicate notifications
  async isDuplicateNotification(rideId, messageId, eventType) {
    if (!rideId && !messageId) return false;

    try {
      const processedMessages = await AsyncStorage.getItem(PROCESSED_MESSAGES_KEY);
      const processed = processedMessages ? JSON.parse(processedMessages) : [];

      const isDuplicate = processed.some(item =>
        item.messageId === messageId ||
        (rideId && item.rideId === rideId && 
         item.eventType === eventType && 
         (Date.now() - item.timestamp) < 30000)
      );

      if (!isDuplicate) {
        processed.push({
          messageId: messageId || `local-${Date.now()}`,
          rideId,
          eventType,
          timestamp: Date.now()
        });

        // Keep only recent entries (last 10 minutes)
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const filteredProcessed = processed
          .filter(item => item.timestamp > tenMinutesAgo)
          .slice(-100);

        await AsyncStorage.setItem(PROCESSED_MESSAGES_KEY, JSON.stringify(filteredProcessed));
      }

      return isDuplicate;
    } catch (error) {
      console.error('❌ Error checking duplicate notification:', error);
      return false;
    }
  }

  // Show local notification with appropriate channel
  async showLocalNotification(title, body, data = {}) {
    try {
      const eventType = data?.event || data?.eventType || NOTIFICATION_EVENTS.APP_NOTIFICATION;
      const rideId = data?.rideId || data?.ride_id;
      const messageId = data?.messageId || `local-${Date.now()}`;

      // Check for duplicates
      const isDuplicate = await this.isDuplicateNotification(rideId, messageId, eventType);
      if (isDuplicate) {
        console.log(`🔄 Duplicate notification prevented for ${eventType}: ${rideId}`);
        return;
      }

      // Get channel configuration
      const channel = this.getChannelByEventType(eventType);

      // Store for background navigation if needed
      if (data?.fromBackground) {
        await this.storePendingNotification({ ...data, eventType });
      }

      // Create notification content
      const notificationContent = {
        title: title || this.getDefaultTitle(eventType),
        body: body || this.getDefaultBody(eventType),
        data: {
          ...data,
          eventType,
          messageId,
          timestamp: Date.now(),
          notificationId: `${messageId}-${Date.now()}`,
          clickAction: 'OPEN_APP'
        },
        sound: channel.sound,
        priority: channel.importance === Notifications.AndroidImportance.MAX 
          ? Notifications.AndroidNotificationPriority.MAX 
          : Notifications.AndroidNotificationPriority.HIGH,
        vibrate: channel.vibrationPattern,
        badge: channel.id !== 'app_notification_channel' ? 1 : 0,
        categoryIdentifier: channel.category,
      };

      // Add channel for Android
      if (Platform.OS === 'android') {
        notificationContent.channelId = channel.id;
      }

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null,
      });

      console.log(`✅ ${eventType} notification scheduled via ${channel.name}`);
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
  }

  // Get default titles based on event type
  getDefaultTitle(eventType) {
    switch (eventType) {
      case NOTIFICATION_EVENTS.RIDE_REQUEST:
        return '🚕 New Ride Request';
      case NOTIFICATION_EVENTS.RIDE_CANCEL:
        return '❌ Ride Cancelled';
      case NOTIFICATION_EVENTS.PAYMENT_COMPLETE:
        return '💰 Payment Received';
      case NOTIFICATION_EVENTS.APP_NOTIFICATION:
      default:
        return '📱 App Notification';
    }
  }

  // Get default bodies based on event type
  getDefaultBody(eventType) {
    switch (eventType) {
      case NOTIFICATION_EVENTS.RIDE_REQUEST:
        return 'You have a new ride request. Tap to accept or decline.';
      case NOTIFICATION_EVENTS.RIDE_CANCEL:
        return 'A ride has been cancelled. Tap to view details.';
      case NOTIFICATION_EVENTS.PAYMENT_COMPLETE:
        return 'Payment has been processed successfully. Tap to view earnings.';
      case NOTIFICATION_EVENTS.APP_NOTIFICATION:
      default:
        return 'You have a new notification from the app.';
    }
  }

  // Handle notification tap with enhanced routing
  handleNotificationTap(data, actionIdentifier = null) {
    console.log('🔔 Notification tapped:', { eventType: data?.eventType, actionIdentifier });
    
    if (!globalNavigationRef) {
      console.error('❌ Navigation ref not available, storing for later');
      this.storePendingNotification(data);
      return;
    }

    try {
      const eventType = data?.eventType || NOTIFICATION_EVENTS.APP_NOTIFICATION;
      
      // Handle different action identifiers
      switch (actionIdentifier) {
        case 'ACCEPT':
          console.log('✅ Ride accepted via notification');
          globalNavigationRef.navigate('NewRideScreen', {
            fromNotification: true,
            action: 'accept',
            rideData: data
          });
          break;
          
        case 'DECLINE':
          console.log('❌ Ride declined via notification');
          // Handle decline logic without opening app
          this.handleRideDecline(data);
          break;
          
        case 'VIEW_DETAILS':
          console.log('👁️ View details tapped');
          globalNavigationRef.navigate('AllRides', {
            fromNotification: true,
            rideId: data?.rideId
          });
          break;
          
        case 'VIEW_EARNINGS':
          console.log('💰 View earnings tapped');
          globalNavigationRef.navigate('collect_money', {
            fromNotification: true,
            transactionId: data?.transactionId
          });
          break;
          
        case 'OPEN_APP':
        case Notifications.DEFAULT_ACTION_IDENTIFIER:
        default:
          // Default navigation based on event type
          this.navigateByEventType(eventType, data);
          break;
      }
    } catch (error) {
      console.error('❌ Navigation error:', error);
      this.storePendingNotification(data);
    }
  }

  // Navigate based on event type
  navigateByEventType(eventType, data) {
    switch (eventType) {
      case NOTIFICATION_EVENTS.RIDE_REQUEST:
        globalNavigationRef.navigate('NewRideScreen', {
          fromNotification: true,
          rideData: data
        });
        break;
        
      case NOTIFICATION_EVENTS.RIDE_CANCEL:
        globalNavigationRef.navigate('AllRides', {
          fromNotification: true,
          rideId: data?.rideId
        });
        break;
        
      case NOTIFICATION_EVENTS.PAYMENT_COMPLETE:
        globalNavigationRef.navigate('collect_money', {
          fromNotification: true,
          transactionId: data?.transactionId
        });
        break;
        
      case NOTIFICATION_EVENTS.APP_NOTIFICATION:
      default:
        globalNavigationRef.navigate('Home', {
          fromNotification: true,
          notificationData: data
        });
        break;
    }
  }

  // Handle ride decline
  async handleRideDecline(data) {
    try {
      const rideId = data?.rideId || data?.ride_id;
      if (rideId) {
        // Make API call to decline ride
        const token = await SecureStore.getItemAsync('auth_token_cab');
        if (token) {
          await axios.post(`${API_BASE_URL}/rider/decline-ride`, 
            { rideId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('✅ Ride declined successfully');
        }
      }
    } catch (error) {
      console.error('❌ Error declining ride:', error);
    }
  }

  // Store pending notification
  async storePendingNotification(data) {
    try {
      await AsyncStorage.setItem(PENDING_NOTIFICATION_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      console.log('📦 Pending notification stored');
    } catch (error) {
      console.error('❌ Error storing pending notification:', error);
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
      console.error('❌ Error getting pending notification:', error);
      return null;
    }
  }

  // Set navigation reference
  setNavigationRef(ref) {
    globalNavigationRef = ref;
    console.log('🧭 Navigation ref set');
  }
}

// Enhanced Background Message Handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📩 Background FCM message received:', remoteMessage.messageId);
  
  const notificationService = NotificationService.getInstance();
  const data = remoteMessage.data || {};
  const eventType = data.event || data.eventType || NOTIFICATION_EVENTS.APP_NOTIFICATION;
  
  // Always show notification for background messages
  await notificationService.showLocalNotification(
    remoteMessage.notification?.title,
    remoteMessage.notification?.body,
    {
      ...data,
      eventType,
      fromBackground: true,
      messageId: remoteMessage.messageId || `bg-${Date.now()}`,
      originalMessage: remoteMessage
    }
  );

  console.log(`✅ Background notification processed: ${eventType}`);
});

// Main App Component
const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [isInitialized, setIsInitialized] = useState(false);
  const [userData, setUserData] = useState(null);

  // Refs
  const initializationRef = useRef(false);
  const notificationService = useRef(NotificationService.getInstance());
  const widgetManager = useRef(FloatingWidgetManager.getInstance());
  const navigationRef = useNavigationContainerRef();

  const { isGranted, fcmToken, requestPermission } = useNotificationPermission(navigationRef);

  // Memoized values
  const screenOptions = useMemo(() => ({ headerShown: false }), []);

  // Get Expo push token
  useEffect(() => {
    const getExpoPushToken = async () => {
      try {
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        console.log("📱 Expo Push Token:", token);
      } catch (error) {
        console.error("❌ Error getting Expo token:", error);
      }
    };
    
    if (isInitialized) {
      getExpoPushToken();
    }
  }, [isInitialized]);

  console.log('🔔 Notification permission status:', isGranted ? 'granted' : 'denied');

  // Set global navigation reference
  useEffect(() => {
    if (navigationRef.current && isInitialized) {
      globalNavigationRef = navigationRef.current;
      notificationService.current.setNavigationRef(navigationRef.current);
      console.log('🧭 Global navigation ref updated');
    }
  }, [navigationRef, isInitialized]);

  // Update widget manager when userData changes
  useEffect(() => {
    if (userData) {
      widgetManager.current.updatePartnerData(userData);
    }
  }, [userData]);

  // Enhanced authentication check that can be called multiple times
  const checkAuthToken = useCallback(async (isRefresh = false) => {
    // Prevent multiple simultaneous calls unless it's a refresh
    if (initializationRef.current && !isRefresh) return;

    try {
      if (!isRefresh) {
        initializationRef.current = true;
      }
      
      console.log(isRefresh ? '🔄 Refreshing user data...' : '🔐 Checking auth token...');
      
      const token = await SecureStore.getItemAsync('auth_token_cab');
      
      if (!token) {
        console.log('❌ No auth token found');
        if (!isRefresh) {
          setInitialRoute('Onboarding');
        }
        return null;
      }

      const response = await axios.get(`${API_BASE_URL}/rider/user-details`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const { partner } = response.data;
      console.log('✅ User data retrieved:', {
        isAvailable: partner?.isAvailable,
        onRideId: partner?.on_ride_id,
        isDocumentUpload: partner?.isDocumentUpload,
        documentVerify: partner?.DocumentVerify
      });
      
      setUserData(response.data.partner);

      // Only set initial route if this is not a refresh call
      if (!isRefresh) {
        if (!partner?.isDocumentUpload) {
          setInitialRoute('UploadDocuments');
        } else if (!partner?.DocumentVerify) {
          setInitialRoute('Wait_Screen');
        } else {
          setInitialRoute('Home');
        }
      }

      return response.data.partner;
    } catch (error) {
      console.error('❌ Auth error:', error?.response?.data?.message || error.message);
      if (!isRefresh) {
        setInitialRoute('Onboarding');
      }
      return null;
    } finally {
      if (!isRefresh) {
        setIsLoading(false);
        initializationRef.current = false;
      }
    }
  }, []);

  // Refresh user data function
  const refreshUserData = useCallback(async () => {
    console.log('🔄 Refreshing user data for widget decision...');
    return await checkAuthToken(true);
  }, [checkAuthToken]);

  // Enhanced app state change handler with widget logic and data refresh
  const handleAppStateChange = useCallback((nextAppState) => {
    console.log(`📱 AppState changing to: ${nextAppState}`);
    
    // Update widget manager with new app state and pass refresh callback
    widgetManager.current.updateAppState(nextAppState, nextAppState === 'background' ? refreshUserData : null);
    
    if (nextAppState === 'active') {
      console.log('📱 App became active - checking pending notifications');
      
      // Also refresh user data when app becomes active to ensure latest status
      setTimeout(() => {
        refreshUserData().then(() => {
          console.log('✅ User data refreshed on app active');
        });
        checkPendingNotifications();
      }, 1000);
    }
  }, [refreshUserData]);

  // Check for pending notifications
  const checkPendingNotifications = useCallback(async () => {
    try {
      const pendingNotification = await notificationService.current.getPendingNotification();
      if (pendingNotification && globalNavigationRef) {
        console.log('📱 Processing pending notification');
        notificationService.current.handleNotificationTap(pendingNotification.data);
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
        console.log('🚀 Initializing app with enhanced notifications and widget...');
        
        // Initialize notification service with 4 channels
        await notificationService.current.initialize();
        
        // Check authentication (initial load)
        await checkAuthToken(false);
        
        // Request permissions
        await requestPermission();
        
        setIsInitialized(true);
        console.log('✅ App initialization complete with 4 notification channels and widget management');
      } catch (error) {
        console.error('❌ App initialization error:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [isInitialized, checkAuthToken, requestPermission, refreshUserData]);

  // Check pending notifications after initialization
  useEffect(() => {
    if (isInitialized && globalNavigationRef) {
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
        const eventType = remoteMessage.data?.event || 
                         remoteMessage.data?.eventType || 
                         NOTIFICATION_EVENTS.APP_NOTIFICATION;
        
        await notificationService.current.showLocalNotification(
          remoteMessage.notification?.title,
          remoteMessage.notification?.body,
          {
            ...remoteMessage.data,
            eventType,
            fromForeground: true,
            messageId: remoteMessage.messageId,
            originalMessage: remoteMessage
          }
        );
      });

      // Handle FCM notification opening app
      messaging().onNotificationOpenedApp(remoteMessage => {
        console.log('📱 FCM Notification opened app');
        if (remoteMessage?.data) {
          notificationService.current.handleNotificationTap(remoteMessage.data);
        }
      });

      // Check if app was opened from FCM notification
      messaging().getInitialNotification().then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 App opened from FCM notification');
          setTimeout(() => {
            if (remoteMessage.data) {
              notificationService.current.handleNotificationTap(remoteMessage.data);
            }
          }, 2000);
        }
      });

      // Local notification received listener
      notificationListener = Notifications.addNotificationReceivedListener(notification => {
        const eventType = notification.request.content.data?.eventType || 'APP_NOTIFICATION';
        console.log(`📱 ${eventType} notification received:`, notification.request.content.title);
      });

      // Enhanced notification response listener
      responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification response received');
        
        const { notification, actionIdentifier } = response;
        const data = notification.request.content.data;
        const eventType = data?.eventType || NOTIFICATION_EVENTS.APP_NOTIFICATION;

        console.log(`Event: ${eventType}, Action: ${actionIdentifier}`);

        // Handle the response with action identifier
        notificationService.current.handleNotificationTap(data, actionIdentifier);
      });
    };

    setupListeners();

    return () => {
      fcmUnsubscribe?.();
      notificationListener && Notifications.removeNotificationSubscription(notificationListener);
      responseListener && Notifications.removeNotificationSubscription(responseListener);
    };
  }, [isInitialized]);

  // App state listener with widget management and data refresh
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Initial app state setup
    if (userData) {
      widgetManager.current.updatePartnerData(userData);
      widgetManager.current.updateAppState(AppState.currentState);
    }
    
    return () => subscription?.remove();
  }, [handleAppStateChange, userData]);

  // Cleanup effect - ensure widget is stopped when app unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 App cleanup - stopping widget');
      widgetManager.current.forceStopWidget();
    };
  }, []);

  // Debug effect to log widget status changes
  useEffect(() => {
    if (userData && isInitialized) {
      const status = widgetManager.current.getWidgetStatus();
      // console.log('🎯 Current Widget Status:', status);
    }
  }, [userData, isInitialized]);

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
                        options={{ headerShown: false, title: 'Complete Profile' }}
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
                      <Stack.Screen 
                        name="enter_bh"
                        options={{
                          headerShown: Platform.OS === 'ios',
                          title: 'Enter BH Id',
                          headerBackTitleVisible: false,
                        }}
                        component={BhVerification} 
                      />
                      <Stack.Screen
                        name="Register"
                        component={RegisterWithBh}
                        options={{
                          headerShown: Platform.OS === 'ios',
                          title: 'Complete Profile',
                          headerBackTitleVisible: false,
                        }}
                      />
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

// Export notification events, service, and widget manager for use in other components
export { NOTIFICATION_EVENTS, NotificationService, FloatingWidgetManager };

// Memoized Root App Component
const RootApp = React.memo(() => (
  <ErrorBoundaryWrapper>
    <CheckAppUpdate>
      <App />
    </CheckAppUpdate>
  </ErrorBoundaryWrapper>
));

AppRegistry.registerComponent(appName, () => RootApp);
export default RootApp;