// useBackgroundTask.js - Improved version
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const BACKGROUND_FETCH_TASK = 'background-fetch-task';
const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';

// Define background tasks outside component to prevent re-registration
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('🔄 Background fetch task executed');
  
  try {
    // Your background logic here
    const now = new Date();
    
    // Schedule a notification to show task is running
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Background Task',
        body: `Background fetch executed at ${now.toLocaleTimeString()}`,
        data: { 
          type: 'background_fetch',
          timestamp: now.toISOString()
        },
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: false,
        autoDismiss: true,
      },
      trigger: null, // Show immediately
    });

    // Simulate API call or other background work
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// More aggressive notification task for testing
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  console.log('🔔 Background notification task executed');
  
  try {
    const now = new Date();
    
    // Send test notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: `Interval test at ${now.toLocaleTimeString()}`,
        data: { 
          type: 'interval_test',
          timestamp: now.toISOString()
        },
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
        sound: 'default',
        vibrate: [0, 250, 250, 250],
      },
      trigger: null,
    });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Background notification error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const useBackgroundTask = () => {
  const [isBackgroundTaskActive, setIsBackgroundTaskActive] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState('inactive');
  const [lastBackgroundExecution, setLastBackgroundExecution] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  
  const appStateRef = useRef(AppState.currentState);
  const backgroundIntervalRef = useRef(null);
  const persistentNotificationRef = useRef(null);
  const testIntervalRef = useRef(null);

  // Check if background fetch is available
  const checkBackgroundFetchStatus = useCallback(async () => {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      console.log('📊 Background fetch status:', status);
      
      const statusMap = {
        [BackgroundFetch.BackgroundFetchStatus.Restricted]: 'restricted',
        [BackgroundFetch.BackgroundFetchStatus.Denied]: 'denied',
        [BackgroundFetch.BackgroundFetchStatus.Available]: 'available',
      };
      
      setBackgroundTaskStatus(statusMap[status] || 'unknown');
      return status === BackgroundFetch.BackgroundFetchStatus.Available;
    } catch (error) {
      console.error('❌ Error checking background fetch status:', error);
      setBackgroundTaskStatus('error');
      return false;
    }
  }, []);

  // Show persistent notification
  const showPersistentNotification = useCallback(async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚗 Ride App Running',
          body: 'Your app is active and looking for rides',
          data: { 
            type: 'persistent',
            timestamp: new Date().toISOString()
          },
          priority: Notifications.AndroidNotificationPriority.LOW,
          sticky: true,
          autoDismiss: true,
          sound: 'default',
        },
        trigger: null,
      });
      console.log('✅ Persistent notification shown');
    } catch (error) {
      console.error('❌ Error showing persistent notification:', error);
    }
  }, []);

  // Start test interval notifications (for debugging only)
  const startTestIntervalNotifications = useCallback(() => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
    }

    console.log('🧪 Starting test interval notifications');
    
    testIntervalRef.current = setInterval(async () => {
      try {
        const now = new Date();
        setNotificationCount(prev => prev + 1);
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔔 Test Interval',
            body: `Test #${notificationCount + 1} at ${now.toLocaleTimeString()}`,
            data: { 
              type: 'test_interval',
              count: notificationCount + 1,
              timestamp: now.toISOString()
            },
            priority: Notifications.AndroidNotificationPriority.DEFAULT,
            sound: 'default',
          },
          trigger: null,
        });
        
        console.log(`🔔 Test notification #${notificationCount + 1} sent`);
        setLastBackgroundExecution(now.toISOString());
      } catch (error) {
        console.error('❌ Error in test interval:', error);
      }
    }, 3000); // 3 seconds
  }, [notificationCount]);

  // Stop test interval notifications
  const stopTestIntervalNotifications = useCallback(() => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
      console.log('⏹️ Test interval notifications stopped');
    }
  }, []);

  // Initialize background tasks
  const initializeBackgroundTasks = useCallback(async () => {
    console.log('🚀 Initializing background tasks...');
    
    try {
      const isAvailable = await checkBackgroundFetchStatus();
      
      if (!isAvailable) {
        console.warn('⚠️ Background fetch not available');
        return false;
      }

      // Register background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15000, // 15 seconds (minimum allowed)
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log('✅ Background fetch task registered');

      // Show persistent notification when going to background
      if (appStateRef.current !== 'active') {
        await showPersistentNotification();
      }

      setIsBackgroundTaskActive(true);
      return true;
    } catch (error) {
      console.error('❌ Error initializing background tasks:', error);
      setBackgroundTaskStatus('error');
      return false;
    }
  }, [checkBackgroundFetchStatus, showPersistentNotification]);

  // Stop background tasks
  const stopBackgroundTasks = useCallback(async () => {
    console.log('⏹️ Stopping background tasks...');
    
    try {
      // Unregister tasks
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      
      // Clear intervals
      stopTestIntervalNotifications();
      
      // Clear persistent notification
      await Notifications.dismissAllNotificationsAsync();
      
      setIsBackgroundTaskActive(false);
      setBackgroundTaskStatus('inactive');
      setNotificationCount(0);
      
      console.log('✅ Background tasks stopped');
    } catch (error) {
      console.error('❌ Error stopping background tasks:', error);
    }
  }, [stopTestIntervalNotifications]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 App state changed from ${appStateRef.current} to ${nextAppState}`);
      
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      setAppState(nextAppState);

      if (isBackgroundTaskActive) {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          console.log('🔄 App went to background - starting background operations');
          showPersistentNotification();
          
          // Start test notifications for debugging (remove in production)
          if (__DEV__) {
            startTestIntervalNotifications();
          }
        } else if (nextAppState === 'active' && previousState !== 'active') {
          console.log('🔄 App became active - stopping test notifications');
          stopTestIntervalNotifications();
          
          // Clear notifications when app becomes active
          setTimeout(() => {
            Notifications.dismissAllNotificationsAsync().catch(console.error);
          }, 1000);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [isBackgroundTaskActive, showPersistentNotification, startTestIntervalNotifications, stopTestIntervalNotifications]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTestIntervalNotifications();
      if (backgroundIntervalRef.current) {
        clearInterval(backgroundIntervalRef.current);
      }
    };
  }, [stopTestIntervalNotifications]);

  // Initialize background fetch status on mount
  useEffect(() => {
    checkBackgroundFetchStatus();
  }, [checkBackgroundFetchStatus]);

  return {
    isBackgroundTaskActive,
    appState,
    backgroundTaskStatus,
    lastBackgroundExecution,
    notificationCount,
    initializeBackgroundTasks,
    stopBackgroundTasks,
    checkBackgroundFetchStatus,
    startTestIntervalNotifications,
    stopTestIntervalNotifications,
  };
};

export default useBackgroundTask;