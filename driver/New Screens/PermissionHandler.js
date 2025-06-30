import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
} from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const PermissionHandler = () => {
  const [hasOverlayPermission, setHasOverlayPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    console.log("i am hit",Platform.OS)
  
      await checkOverlayPermission();
      await checkLocationPermissions();
    //   await checkNotificationPermission();
 
  };

  // System Overlay Permission (Android only)
  const checkOverlayPermission = async () => {
    console.log("i am check overlay",require('react-native').NativeModules)
    try {
      const { Settings } = require('react-native').NativeModules;
      console.log("Settings",Settings)
      if (Settings && Settings.canDrawOverlays) {
        const canDraw = await Settings.canDrawOverlays();
        console.log("canDraw",canDraw)
        setHasOverlayPermission(canDraw);
        return canDraw;
      }
      return false;
    } catch (error) {
      console.log('Error checking overlay permission:', error);
      return false;
    }
  };

  const requestOverlayPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        Alert.alert(
          'System Overlay Permission Required',
          'This app needs permission to display ride requests over other apps. You will be redirected to settings.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => {
                // Open system settings for overlay permission
                Linking.openSettings('package:' + 'com.olyoxpvt.OlyoxDriverApp');
                // Alternative: Open specific overlay settings
                // Linking.openURL('package:' + 'com.yourapp.package');
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting overlay permission:', error);
    }
  };

  // Location Permissions
  const checkLocationPermissions = async () => {
    try {
      const fineLocationStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      const backgroundLocationStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      
      setHasLocationPermission(
        fineLocationStatus === RESULTS.GRANTED && 
        backgroundLocationStatus === RESULTS.GRANTED
      );
    } catch (error) {
      console.error('Error checking location permissions:', error);
    }
  };

  const requestLocationPermissions = async () => {
    try {
      // First request fine location
      const fineLocationResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      
      if (fineLocationResult === RESULTS.GRANTED) {
        // Then request background location (Android 10+)
        if (Platform.Version >= 29) {
          const backgroundResult = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
          setHasLocationPermission(backgroundResult === RESULTS.GRANTED);
        } else {
          setHasLocationPermission(true);
        }
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
    }
  };

  // Notification Permission (Android 13+)
  const checkNotificationPermission = async () => {
    try {
      if (Platform.Version >= 33) {
        const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        setHasNotificationPermission(status === RESULTS.GRANTED);
      } else {
        setHasNotificationPermission(true); // Granted by default on older versions
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if (Platform.Version >= 33) {
        const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        setHasNotificationPermission(result === RESULTS.GRANTED);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  // Alternative method using PermissionsAndroid for basic permissions
  const requestPermissionsAlternative = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ...(Platform.Version >= 29 ? [PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] : []),
          ...(Platform.Version >= 33 ? [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] : []),
        ]);

        console.log('Permission grants:', grants);

        const locationGranted = 
          grants[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
        
        const backgroundLocationGranted = Platform.Version >= 29 
          ? grants[PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
          : true;

        const notificationGranted = Platform.Version >= 33
          ? grants[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] === PermissionsAndroid.RESULTS.GRANTED
          : true;

        setHasLocationPermission(locationGranted && backgroundLocationGranted);
        setHasNotificationPermission(notificationGranted);

      } catch (err) {
        console.warn('Error requesting permissions:', err);
      }
    }
  };

  const requestAllPermissions = async () => {
    await requestPermissionsAlternative();
    await requestOverlayPermission();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Permission Status</Text>
      
      <View style={styles.permissionItem}>
        <Text style={styles.permissionText}>
          System Overlay: {hasOverlayPermission ? '✅ Granted' : '❌ Not Granted'}
        </Text>
        {!hasOverlayPermission && (
          <TouchableOpacity style={styles.button} onPress={requestOverlayPermission}>
            <Text style={styles.buttonText}>Request Overlay</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.permissionItem}>
        <Text style={styles.permissionText}>
          Location: {hasLocationPermission ? '✅ Granted' : '❌ Not Granted'}
        </Text>
        {!hasLocationPermission && (
          <TouchableOpacity style={styles.button} onPress={requestLocationPermissions}>
            <Text style={styles.buttonText}>Request Location</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.permissionItem}>
        <Text style={styles.permissionText}>
          Notifications: {hasNotificationPermission ? '✅ Granted' : '❌ Not Granted'}
        </Text>
        {!hasNotificationPermission && (
          <TouchableOpacity style={styles.button} onPress={requestNotificationPermission}>
            <Text style={styles.buttonText}>Request Notifications</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.requestAllButton} onPress={requestAllPermissions}>
        <Text style={styles.requestAllButtonText}>Request All Permissions</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.checkButton} onPress={checkAllPermissions}>
        <Text style={styles.buttonText}>Refresh Status</Text>
      </TouchableOpacity>
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
    marginBottom: 30,
    textAlign: 'center',
  },
  permissionItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  permissionText: {
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  requestAllButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  requestAllButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkButton: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});

export default PermissionHandler;