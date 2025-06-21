// backgroundTasks/backgroundTaskManager.js
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';

const BACKGROUND_NOTIFICATION_TASK = 'background-notification-task';
const BACKGROUND_INTERVAL_TASK = 'background-interval-task';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Background task for periodic notifications
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    console.log('🔔 Background task running - sending notification');
    
    // Send notification every time task runs
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your Ride App is Active 🚗",
        body: `App is running in background - ${new Date().toLocaleTimeString()}`,
        data: {
          type: 'background_ping',
          timestamp: Date.now()
        },
        sound: 'default',
        priority: 'high',
      },
      trigger: null, // Send immediately
    });

    // Show persistent notification that app is running
    await showPersistentNotification();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Background task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Task for interval-based notifications (every 3 seconds when app is backgrounded)
TaskManager.defineTask(BACKGROUND_INTERVAL_TASK, async () => {
  try {
    const appState = AppState.currentState;
    
    if (appState === 'background' || appState === 'inactive') {
      console.log('📱 App is in background - sending interval notification');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Ride App Background Update",
          body: `Checking for new rides... ${new Date().toLocaleTimeString()}`,
          data: {
            type: 'interval_check',
            timestamp: Date.now()
          },
          sound: 'default',
        },
        trigger: null,
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ Interval task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Show persistent notification indicating app is running
const showPersistentNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🚗 Ride App Running",
        body: "Your app is active and looking for rides",
        data: {
          type: 'persistent_status',
          persistent: true
        },
        sticky: true, // Makes notification persistent
        ongoing: true, // Android specific - keeps notification in ongoing section
        priority: 'low', // Low priority so it doesn't disturb user
      },
      trigger: null,
    });
  } catch (error) {
    console.error('❌ Error showing persistent notification:', error);
  }
};

// Background Task Manager Class
class BackgroundTaskManager {
  static isRegistered = false;
  static intervalId = null;
  static appStateSubscription = null;

  // Register background tasks
  static async registerBackgroundTasks() {
    try {
      if (this.isRegistered) {
        console.log('⚠️ Background tasks already registered');
        return;
      }

      // Register the main background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
        minimumInterval: 3000, // 3 seconds (minimum for testing, production should be higher)
        stopOnTerminate: false,
        startOnBoot: true,
      });

      // Register interval task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_INTERVAL_TASK, {
        minimumInterval: 3000, // 3 seconds
        stopOnTerminate: false,
        startOnBoot: true,
      });

      this.isRegistered = true;
      console.log('✅ Background tasks registered successfully');

      // Start app state monitoring
      this.startAppStateMonitoring();

    } catch (error) {
      console.error('❌ Error registering background tasks:', error);
    }
  }

  // Start monitoring app state changes
  static startAppStateMonitoring() {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  // Handle app state changes
  static handleAppStateChange = (nextAppState) => {
    console.log('📱 App state changed to:', nextAppState);

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('🔄 App went to background - starting interval notifications');
      this.startIntervalNotifications();
      showPersistentNotification();
    } else if (nextAppState === 'active') {
      console.log('🔄 App became active - stopping interval notifications');
      this.stopIntervalNotifications();
      this.clearPersistentNotifications();
    }
  };

  // Start interval notifications when app is backgrounded
  static startIntervalNotifications() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔔 Background Check",
            body: `App running in background - ${new Date().toLocaleTimeString()}`,
            data: {
              type: 'interval_notification',
              timestamp: Date.now()
            },
            sound: 'default',
          },
          trigger: null,
        });
        console.log('📤 Interval notification sent');
      } catch (error) {
        console.error('❌ Error sending interval notification:', error);
      }
    }, 3000); // Every 3 seconds
  }

  // Stop interval notifications
  static stopIntervalNotifications() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Interval notifications stopped');
    }
  }

  // Clear persistent notifications
  static async clearPersistentNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log('🧹 Persistent notifications cleared');
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  }

  // Unregister background tasks
  static async unregisterBackgroundTasks() {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_INTERVAL_TASK);
      
      this.stopIntervalNotifications();
      
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      this.isRegistered = false;
      console.log('✅ Background tasks unregistered successfully');
    } catch (error) {
      console.error('❌ Error unregistering background tasks:', error);
    }
  }

  // Check if background tasks are available
  static async checkBackgroundFetchStatus() {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      console.log('📊 Background fetch status:', status);
      return status;
    } catch (error) {
      console.error('❌ Error checking background fetch status:', error);
      return null;
    }
  }

  // Test notification immediately
  static async testNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🧪 Test Notification",
          body: "This is a test notification from your ride app!",
          data: {
            type: 'test',
            timestamp: Date.now()
          },
          sound: 'default',
        },
        trigger: null,
      });
      console.log('🧪 Test notification sent');
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
    }
  }
}

export default BackgroundTaskManager;