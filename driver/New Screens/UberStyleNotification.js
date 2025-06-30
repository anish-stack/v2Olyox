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
  AndroidColor,
  AndroidDefaults,
  AndroidGroupAlertBehavior
} from '@notifee/react-native';

const UberStyleNotification = () => {
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    initializeUberStyleNotifications();
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription?.remove();
  }, []);

  const initializeUberStyleNotifications = async () => {
    try {
      // Request permissions
      await notifee.requestPermission();

      // Create high-priority channel for ride requests
      await notifee.createChannel({
        id: 'ride-requests',
        name: 'Ride Requests',
        description: 'High priority ride request notifications',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
        vibrationPattern: [300, 500, 300, 500, 300, 500],
        lights: ['#FF0000', 300, 300],
        lightColor: AndroidColor.BLUE,
      });

      setupNotificationHandlers();
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  const setupNotificationHandlers = () => {
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === 'action_press') {
        handleRideAction(detail.pressAction.id, detail.notification);
      }
    });

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === 'action_press') {
        await handleRideAction(detail.pressAction.id, detail.notification);
      }
    });
  };

  const handleRideAction = async (actionId, notification) => {
    const rideData = notification.data;
    
    if (actionId === 'accept') {
      // Show acceptance confirmation
      await notifee.displayNotification({
        title: '🎉 Ride Accepted!',
        body: `Heading to pickup: ${rideData.pickup}`,
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          color: AndroidColor.GREEN,
          autoCancel: true,
        },
      });
      
      await notifee.cancelNotification(notification.id);
    } else if (actionId === 'decline') {
      await notifee.cancelNotification(notification.id);
    }
  };

  // Create Uber-style full screen ride request
  const showUberStyleRideRequest = async () => {
    try {
      const rideData = {
        rideId: 'uber-style-123',
        rideType: 'Moto',
        price: '119.18',
        currency: '₹',
        rating: '5.00',
        pickup: 'Sector 99A, Gurugram, 122505',
        destination: 'Sector 29, Gurugram, 122022',
        pickupTime: '2 mins (0 km)',
        tripTime: '32 mins (18.2 km)',
        taxInfo: '*Includes 5% tax',
        paymentMethod: 'Cash payment'
      };

      await notifee.displayNotification({
        id: 'uber-ride-request',
        title: `${rideData.rideType} • ${rideData.currency}${rideData.price}`,
        body: `${rideData.pickup} → ${rideData.destination}`,
        data: rideData,
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          category: AndroidCategory.CALL,
          
          // Full screen intent for overlay effect
          fullScreenAction: {
            id: 'ride_request_full_screen',
          },
          
          // Styling to match Uber
          color: AndroidColor.BLUE,
          colorized: true,
          autoCancel: false,
          ongoing: true,
          showTimestamp: false,
          timeoutAfter: 30000, // 30 seconds timeout
          
          // Custom large icon (Uber-style)
          largeIcon: 'https://via.placeholder.com/128x128/000000/FFFFFF?text=🚗',
          
          // Rich notification style
          style: {
            type: AndroidStyle.BIGTEXT,
            text: `🚗 ${rideData.rideType} Ride Request\n\n` +
                  `💰 ${rideData.currency}${rideData.price} ${rideData.taxInfo}\n` +
                  `⭐ ${rideData.rating} rating\n` +
                  `💳 ${rideData.paymentMethod}\n\n` +
                  `📍 Pickup: ${rideData.pickupTime}\n${rideData.pickup}\n\n` +
                  `🏁 Drop: ${rideData.tripTime}\n${rideData.destination}`,
          },
          
          // Action buttons styled like Uber
          actions: [
            {
              title: '✅ Accept',
              pressAction: { id: 'accept' },
              icon: 'https://via.placeholder.com/32x32/34C759/FFFFFF?text=✓',
            },
            {
              title: '❌ Decline', 
              pressAction: { id: 'decline' },
              icon: 'https://via.placeholder.com/32x32/FF3B30/FFFFFF?text=✗',
            },
          ],
          
          // Additional styling
          defaults: [
            AndroidDefaults.ALL,
          ],
          
          // Heads up notification
          priority: AndroidImportance.HIGH,
        },
      });

      Alert.alert('Uber-Style Notification', 'Full screen ride request sent!');
    } catch (error) {
      console.error('Error showing Uber-style notification:', error);
    }
  };

  // Premium ride request with enhanced styling
  const showPremiumRideRequest = async () => {
    try {
      await notifee.displayNotification({
        id: 'premium-ride-request',
        title: '🌟 Premium • ₹299.00',
        body: 'Airport Trip • High Priority',
        data: {
          rideId: 'premium-456',
          rideType: 'Premium',
          price: '299.00',
          pickup: 'DLF Phase 1, Gurugram',
          destination: 'IGI Airport Terminal 3',
          distance: '25.8 km',
          estimatedTime: '45 mins'
        },
        android: {
          channelId: 'ride-requests',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          category: AndroidCategory.CALL,
          
          fullScreenAction: {
            id: 'premium_ride_full_screen',
          },
          
          color: AndroidColor.YELLOW, // Gold color for premium
          colorized: true,
          autoCancel: false,
          ongoing: true,
          timeoutAfter: 45000,
          
          // Premium styling
          largeIcon: 'https://via.placeholder.com/128x128/FFD700/000000?text=⭐',
          
          style: {
            type: AndroidStyle.BIGPICTURE,
            picture: 'https://via.placeholder.com/400x200/FFD700/000000?text=PREMIUM+RIDE',
            largeIcon: 'https://via.placeholder.com/128x128/FFD700/000000?text=⭐',
            summaryText: 'Premium Airport Trip',
          },
          
          actions: [
            {
              title: '🎯 Accept Premium',
              pressAction: { id: 'accept' },
              icon: 'https://via.placeholder.com/32x32/FFD700/000000?text=⭐',
            },
            {
              title: '⏰ Snooze 2min',
              pressAction: { id: 'snooze' },
              icon: 'https://via.placeholder.com/32x32/FF9500/FFFFFF?text=⏰',
            },
            {
              title: '❌ Decline',
              pressAction: { id: 'decline' },
              icon: 'https://via.placeholder.com/32x32/FF3B30/FFFFFF?text=✗',
            },
          ],
          
          // Enhanced vibration for premium
         vibrationPattern: [500, 500, 500, 500],
    lights: ['#FF0000', 300, 300],
          lightColor: AndroidColor.YELLOW,
        },
      });

      Alert.alert('Premium Ride', 'Premium ride request with enhanced styling!');
    } catch (error) {
      console.error('Error showing premium ride:', error);
    }
  };

  // Background test - shows overlay when app is minimized
  const testBackgroundOverlay = () => {
    Alert.alert(
      'Background Overlay Test',
      'Minimize the app now. A full-screen Uber-style overlay will appear in 3 seconds.',
      [
        {
          text: 'OK',
          onPress: () => {
            setTimeout(() => {
              if (appState === 'background') {
                showUberStyleRideRequest();
              }
            }, 3000);
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Uber-Style Ride Notifications</Text>
      <Text style={styles.appState}>App State: {appState}</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Uber-Style Overlays</Text>
        
        <TouchableOpacity style={styles.uberButton} onPress={showUberStyleRideRequest}>
          <Text style={styles.buttonText}>🚗 Show Uber-Style Request</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.premiumButton} onPress={showPremiumRideRequest}>
          <Text style={styles.buttonText}>⭐ Show Premium Request</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={testBackgroundOverlay}>
          <Text style={styles.buttonText}>🔄 Test Background Overlay</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How it works:</Text>
        <Text style={styles.instructionsText}>
          • Full-screen notifications act like Uber overlays{'\n'}
          • Rich styling with colors, icons, and images{'\n'}
          • Action buttons work without opening the app{'\n'}
          • Appears over lock screen and other apps{'\n'}
          • Auto-dismisses after timeout period
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
    color: '#000',
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
    marginBottom: 15,
    color: '#333',
  },
  uberButton: {
    backgroundColor: '#000000',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  premiumButton: {
    backgroundColor: '#FFD700',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
});

export default UberStyleNotification;