import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AppState,
  Platform,
} from 'react-native';
import notifee, { 
  AndroidImportance, 
  AndroidVisibility,
  AndroidCategory,
  AndroidStyle,
  TriggerType,
  RepeatFrequency 
} from '@notifee/react-native';

const NotifeeOverlayTester = () => {
  const [appState, setAppState] = useState(AppState.currentState);
  const [testRunning, setTestRunning] = useState(false);
  const [channelId, setChannelId] = useState(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Initialize Notifee
    initializeNotifee();
    
    return () => subscription?.remove();
  }, []);

  const initializeNotifee = async () => {
    try {
      // Request permissions
      await notifee.requestPermission();

      // Create notification channel for Android
      const channelId = await notifee.createChannel({
        id: 'ride-requests',
        name: 'Ride Requests',
        description: 'Notifications for incoming ride requests',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'ride_request', // Custom sound file
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
      });

      setChannelId(channelId);
      console.log('Notifee initialized with channel:', channelId);

      // Set up notification event handlers
      setupNotificationHandlers();

    } catch (error) {
      console.error('Error initializing Notifee:', error);
    }
  };

  const setupNotificationHandlers = () => {
    // Handle notification events
    notifee.onForegroundEvent(({ type, detail }) => {
      console.log('Foreground event:', type, detail);
      
      switch (type) {
        case 'press':
          console.log('Notification pressed:', detail.notification);
          break;
        case 'action_press':
          handleNotificationAction(detail.pressAction.id, detail.notification);
          break;
        case 'dismissed':
          console.log('Notification dismissed');
          break;
      }
    });

    // Handle background events
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log('Background event:', type, detail);
      
      if (type === 'action_press') {
        await handleNotificationAction(detail.pressAction.id, detail.notification);
      }
    });
  };

  const handleNotificationAction = async (actionId, notification) => {
    console.log('Action pressed:', actionId, notification);
    
    const rideData = notification.data;
    
    if (actionId === 'accept') {
      console.log('Ride accepted:', rideData);
      
      // Show acceptance confirmation
      await notifee.displayNotification({
        title: 'Ride Accepted! 🎉',
        body: `You accepted the ride for ₹${rideData.price}`,
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          autoCancel: true,
        },
      });
      
      // Cancel the original notification
      await notifee.cancelNotification(notification.id);
      
    } else if (actionId === 'decline') {
      console.log('Ride declined:', rideData);
      
      // Cancel the notification
      await notifee.cancelNotification(notification.id);
    }
  };

  const handleAppStateChange = (nextAppState) => {
    console.log('App state changed:', appState, '->', nextAppState);
    setAppState(nextAppState);
        console.log('nextAppState',nextAppState);
        console.log('testRunning',testRunning);

    if (testRunning && nextAppState === 'background') {
      setTimeout(() => {
        triggerBackgroundOverlay();
      }, 2000);
    }
  };

  // Test 1: Basic notification with actions
  const testBasicNotification = async () => {
    try {
      await notifee.displayNotification({
        title: 'New Ride Request 🚗',
        body: '₹150.00 • 5.2 km • Sector 18 → Cyber City',
        data: {
          rideId: 'test-123',
          price: '150.00',
          pickup: 'Sector 18, Gurugram',
          destination: 'Cyber City, Gurugram',
          distance: '5.2 km',
          estimatedTime: '12 mins'
        },
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          category: AndroidCategory.CALL,
          autoCancel: false,
          ongoing: true,
          showTimestamp: true,
          largeIcon: 'https://via.placeholder.com/64x64/007AFF/FFFFFF?text=🚗',
          style: {
            type: AndroidStyle.BIGTEXT,
            text: 'Pickup: Sector 18, Gurugram\nDestination: Cyber City, Gurugram\nDistance: 5.2 km\nEstimated Time: 12 mins\nEstimated Earnings: ₹150.00'
          },
          actions: [
            {
              title: 'Accept',
              pressAction: { id: 'accept' },
              icon: 'https://via.placeholder.com/24x24/34C759/FFFFFF?text=✓',
            },
            {
              title: 'Decline',
              pressAction: { id: 'decline' },
              icon: 'https://via.placeholder.com/24x24/FF3B30/FFFFFF?text=✗',
            },
          ],
        },
      });
      
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Error', 'Failed to send notification');
    }
  };

  // Test 2: Full screen notification (like incoming call)
  const testFullScreenNotification = async () => {
    try {
      await notifee.displayNotification({
        title: 'URGENT: Premium Ride Request! 🚨',
        body: '₹300.00 • Airport Trip • High Priority',
        data: {
          rideId: 'urgent-456',
          price: '300.00',
          type: 'premium',
          pickup: 'DLF Phase 1',
          destination: 'IGI Airport',
          distance: '25.8 km'
        },
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          category: AndroidCategory.CALL,
          fullScreenAction: {
            id: 'full_screen_action',
          },
          autoCancel: false,
          ongoing: true,
          showTimestamp: true,
          timeoutAfter: 30000, // Auto dismiss after 30 seconds
          style: {
            type: AndroidStyle.BIGPICTURE,
            picture: 'https://via.placeholder.com/400x200/007AFF/FFFFFF?text=Premium+Ride'
          },
          actions: [
            {
              title: '🎯 Accept Premium',
              pressAction: { id: 'accept' },
            },
            {
              title: '❌ Decline',
              pressAction: { id: 'decline' },
            },
          ],
        },
      });
      
      Alert.alert('Full Screen Notification', 'Urgent ride request sent!');
    } catch (error) {
      console.error('Error sending full screen notification:', error);
    }
  };

  // Test 3: Background overlay test
  const testBackgroundOverlay = () => {
    setTestRunning(true);
    Alert.alert(
      'Background Test Started',
      'Now minimize the app. A high-priority notification will appear in 2 seconds.',
      [
        {
          text: 'OK',
          onPress: () => {
            console.log('Background test initiated');
          }
        }
      ]
    );
  };

  const triggerBackgroundOverlay = async () => {
    console.log('Triggering background overlay');
    
    try {
      await notifee.displayNotification({
        title: 'BACKGROUND: New Ride! 🚨',
        body: '₹200.00 • Premium • Accept quickly!',
        data: {
          rideId: 'bg-789',
          price: '200.00',
          type: 'background_test',
          pickup: 'Current Location',
          destination: 'Airport Terminal 3'
        },
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          category: AndroidCategory.CALL,
          autoCancel: false,
          ongoing: true,
          showTimestamp: true,
    lights: ['#FF0000', 300, 300],
          vibrationPattern: [500, 500, 500, 500],
          style: {
            type: AndroidStyle.BIGTEXT,
            text: 'This notification appeared while the app was in background!\n\nPickup: Current Location\nDestination: Airport Terminal 3\nEstimated Earnings: ₹200.00'
          },
          actions: [
            {
              title: '✅ Accept Now',
              pressAction: { id: 'accept' },
            },
            {
              title: '⏰ Snooze 1min',
              pressAction: { id: 'snooze' },
            },
            {
              title: '❌ Decline',
              pressAction: { id: 'decline' },
            },
          ],
        },
      });
    } catch (error) {
      console.error('Error triggering background overlay:', error);
    }
  };

  // Test 4: Multiple ride requests
  const testMultipleRequests = async () => {
    const rides = [
      { price: '120.50', pickup: 'Sector 29', destination: 'Cyber Hub', distance: '4.2 km' },
      { price: '89.00', pickup: 'MG Road', destination: 'Sector 14', distance: '2.8 km' },
      { price: '156.75', pickup: 'Golf Course Road', destination: 'Sohna Road', distance: '8.1 km' },
    ];

    for (let i = 0; i < rides.length; i++) {
      const ride = rides[i];
      
      setTimeout(async () => {
        try {
          await notifee.displayNotification({
            id: `ride-${i}`,
            title: `Ride Request #${i + 1}`,
            body: `₹${ride.price} • ${ride.distance}`,
            data: {
              rideId: `multi-${i}`,
              ...ride
            },
            android: {
              channelId: 'ride-requests',
              importance: AndroidImportance.HIGH,
              tag: `ride-${i}`, // Prevents grouping
              autoCancel: false,
              actions: [
                {
                  title: 'Accept',
                  pressAction: { id: 'accept' },
                },
                {
                  title: 'Decline',
                  pressAction: { id: 'decline' },
                },
              ],
            },
          });
        } catch (error) {
          console.error(`Error sending ride ${i + 1}:`, error);
        }
      }, i * 3000);
    }

    Alert.alert('Multiple Requests', 'Sending 3 ride requests, 3 seconds apart');
  };

  // Test 5: Scheduled notification (simulates server-triggered)
  const testScheduledNotification = async () => {
    try {
      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + 5000, // 5 seconds from now
      };

      await notifee.createTriggerNotification({
        title: 'Scheduled Ride Request ⏰',
        body: 'This simulates a server-triggered notification',
        data: {
          rideId: 'scheduled-999',
          price: '175.00',
          type: 'scheduled'
        },
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          actions: [
            {
              title: 'Accept',
              pressAction: { id: 'accept' },
            },
            {
              title: 'Decline',
              pressAction: { id: 'decline' },
            },
          ],
        },
      }, trigger);

      Alert.alert('Scheduled', 'Notification will appear in 5 seconds');
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await notifee.cancelAllNotifications();
      Alert.alert('Cleared', 'All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifee Overlay Testing</Text>
      <Text style={styles.appState}>App State: {appState}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Tests</Text>
        
        <TouchableOpacity style={styles.testButton} onPress={testBasicNotification}>
          <Text style={styles.buttonText}>Test Basic Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testFullScreenNotification}>
          <Text style={styles.buttonText}>Test Full Screen Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testBackgroundOverlay}>
          <Text style={styles.buttonText}>Test Background Overlay</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Tests</Text>
        
        <TouchableOpacity style={styles.testButton} onPress={testMultipleRequests}>
          <Text style={styles.buttonText}>Test Multiple Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testScheduledNotification}>
          <Text style={styles.buttonText}>Test Scheduled Notification</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Utilities</Text>
        
        <TouchableOpacity style={styles.clearButton} onPress={clearAllNotifications}>
          <Text style={styles.buttonText}>Clear All Notifications</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Notifee Testing Instructions:</Text>
        <Text style={styles.instructionsText}>
          1. Basic notification shows with Accept/Decline actions{'\n'}
          2. Full screen acts like incoming call overlay{'\n'}
          3. Background test - minimize app first{'\n'}
          4. Multiple requests test notification stacking{'\n'}
          5. Scheduled simulates server-triggered notifications
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  appState: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    fontWeight: '600',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
});

export default NotifeeOverlayTester;