import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  ToastAndroid,
  Dimensions,
  StatusBar,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { tokenCache } from '../../Auth/cache';
import { useLocation } from '../../context/LocationContext';
import { useRide } from '../../context/RideContext';
import useNotificationPermission from '../../hooks/notification';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8';
const POLLING_INTERVAL = 8000;
const BOOKING_TIMEOUT = 120000;

// Enhanced Color Palette
const COLORS = {
  primary: '#6366F1',
  primaryLight: '#E0E7FF',
  primaryDark: '#4338CA',
  secondary: '#10B981',
  secondaryLight: '#D1FAE5',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',

  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
    dark: '#0F172A',
  },

  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
    muted: '#64748B',
  },

  border: {
    light: '#E2E8F0',
    medium: '#CBD5E1',
    dark: '#94A3B8',
  },

  shadow: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(0, 0, 0, 0.15)',
  },
};

const showNotification = (title, message, type = 'info') => {
  const displayMessage = `${title ? title + '\n' : ''}${message}`;
  if (Platform.OS === 'android') {
    ToastAndroid.show(displayMessage, type === 'error' || message.length > 60 ? ToastAndroid.LONG : ToastAndroid.SHORT);
  } else {
    Alert.alert(title || (type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Notification'), message);
  }
};

// Polyline decoding function
const decodePolyline = (encoded) => {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

export default function BookingConfirmation() {
  const route = useRoute();
  const navigation = useNavigation();
  const { location: contextLocation } = useLocation();
  const { saveRide, updateRideStatus } = useRide();
  const { fcmToken } = useNotificationPermission();

  const { origin, destination, selectedRide, dropoff, pickup } = route.params || {};

  // State management
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isCreatingRide, setIsCreatingRide] = useState(false);
  const [isBookingInProgress, setIsBookingInProgress] = useState(false);
  const [bookingStatusMessage, setBookingStatusMessage] = useState('Preparing your ride...');
  const [currentRideStatus, setCurrentRideStatus] = useState('pending');
  const [rideOtp, setRideOtp] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [createdRideId, setCreatedRideId] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [rideCompleted, setRideCompleted] = useState(false);

  // Refs
  const pollingRef = useRef(null);
  const bookingTimeoutRef = useRef(null);
  const mapRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const isActiveRef = useRef(true);

  // Memoized values
  const farePayload = useMemo(() => ({
    base_fare: selectedRide?.pricing?.baseFare || 0,
    distance_fare: selectedRide?.pricing?.distanceCost || 0,
    time_fare: selectedRide?.pricing?.timeCost || 0,
    platform_fee: selectedRide?.pricing?.fuelSurcharge || 0,
    night_charge: selectedRide?.pricing?.nightSurcharge || 0,
    rain_charge: selectedRide?.conditions?.rain ? (selectedRide?.pricing?.rainCharge || 10) : 0,
    toll_charge: selectedRide?.pricing?.tollCost || 0,
    discount: selectedRide?.pricing?.discount || 0,
    total_fare: selectedRide?.totalPrice,
    currency: selectedRide?.pricing?.currency || 'INR',
  }), [selectedRide]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (bookingTimeoutRef.current) {
      clearTimeout(bookingTimeoutRef.current);
      bookingTimeoutRef.current = null;
    }
  }, []);

  // Stop booking process
  const stopBookingProcess = useCallback((reason) => {
    console.log('Stopping booking process:', reason);
    setIsBookingInProgress(false);
    setRideCompleted(true);
    cleanup();
  }, [cleanup]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        isActiveRef.current = true;
      } else if (nextAppState.match(/inactive|background/)) {
        isActiveRef.current = false;
        // Auto-cancel ride if user minimizes app during booking
        if (isBookingInProgress && createdRideId && !rideCompleted) {
          handleCancelBooking(true);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isBookingInProgress, createdRideId, rideCompleted]);

  // Focus effect for cleanup
  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      return () => {
        isActiveRef.current = false;
        if (isBookingInProgress && !rideCompleted) {
          cleanup();
        }
      };
    }, [isBookingInProgress, rideCompleted, cleanup])
  );

  // Fetch directions
  const fetchDirections = useCallback(async () => {
    if (!origin || !destination) return;

    try {
      const pickup = {
        latitude: origin.latitude,
        longitude: origin.longitude
      };
      const dropoff = {
        latitude: destination.latitude,
        longitude: destination.longitude
      };

      console.log('Fetching directions...');
      const response = await axios.post('https://appapi.olyox.com/directions', { pickup, dropoff });
      const json = response.data;

      if (json?.polyline) {
        const decodedCoords = decodePolyline(json.polyline).map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setCoordinates(decodedCoords);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      showNotification('Route Error', 'Unable to fetch route directions.', 'error');
    }
  }, [origin, destination]);

  // Fetch location
  const fetchLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      if (contextLocation?.coords) {
        setCurrentLocation(contextLocation.coords);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showNotification('Permission Denied', 'Location permission required.', 'error');
          setIsLoadingLocation(false);
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentLocation(position.coords);
      }
    } catch (err) {
      console.error('Error getting location:', err);
      showNotification('Location Error', 'Unable to get location.', 'error');
    }
    setIsLoadingLocation(false);
  }, [contextLocation]);

  // Poll ride status
  const pollRideStatus = useCallback(async () => {
    console.log("i am status pool")
    if (!createdRideId || !isBookingInProgress || rideCompleted || !isActiveRef.current) return;
    console.log("i am createdRideId", createdRideId, isBookingInProgress, rideCompleted, isActiveRef?.current)

    try {
      const token = await tokenCache.getToken('auth_token_db');
      if (!token) {
        showNotification('Authentication Error', 'Please log in again.', 'error');
        stopBookingProcess('AUTH_ERROR_POLL');
        return;
      }

      const response = await axios.get(
        `http://192.168.1.37:3100/api/v1/new/status/${createdRideId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: POLLING_INTERVAL - 1000
        }
      );
      console.log(" response.data", response.data?.status)
      const { status: newStatus, rideDetails, message } = response.data;

      if (rideCompleted) return; // Prevent state updates after completion

      setCurrentRideStatus(newStatus);
      setBookingStatusMessage(message || `Ride status: ${newStatus}`);

      switch (newStatus) {
        case 'driver_assigned':
          showNotification('Driver Assigned!', message || 'Your ride is on the way.', 'success');
          saveRide({ ...rideDetails, ride_otp: rideOtp });
          updateRideStatus('confirmed');
          stopBookingProcess('DRIVER_ASSIGNED');
          navigation.replace('RideStarted', { driver: rideDetails?._id, origin, destination });
          break;
        case 'cancelled':
          showNotification('Ride Cancelled', message || 'Ride cancelled.', 'info');
          stopBookingProcess('CANCELLED_BY_SYSTEM');
          break;
        case 'completed':
          showNotification('Ride Completed!', message || 'Thank you for riding.', 'success');
          stopBookingProcess('COMPLETED');
          break;
      }
    } catch (err) {
      console.error('Error polling ride status:', err);
      if (err.response?.status === 401 || err.response?.status === 404) {
        showNotification('Status Error', 'Could not verify ride status.', 'error');
        stopBookingProcess('POLL_API_ERROR');
      }
    }
  }, [createdRideId, isBookingInProgress, rideCompleted, navigation, saveRide, updateRideStatus, origin, destination, rideOtp, stopBookingProcess]);

  // Effects
  useEffect(() => {
    fetchDirections();
  }, [fetchDirections]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  // Status polling effect
  useEffect(() => {
    if (!createdRideId || !isBookingInProgress || rideCompleted) return;

    console.log("Starting status polling");

    const startPolling = () => {
      pollRideStatus(); // Initial call
      pollingRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
    };

    startPolling();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [createdRideId, isBookingInProgress, rideCompleted, pollRideStatus]);

  // Create ride
  const handleCreateRide = useCallback(async () => {
    if (!currentLocation || !origin || !destination || !selectedRide || !fcmToken) {
      showNotification('Missing Information', 'Ensure location and ride details are selected.', 'error');
      return;
    }

    setIsCreatingRide(true);
    setIsBookingInProgress(true);
    setRideCompleted(false);
    setBookingStatusMessage('Requesting your ride...');
    setCurrentRideStatus('pending');

    try {
      const token = await tokenCache.getToken('auth_token_db');
      if (!token) {
        showNotification('Authentication Error', 'Please log in again.', 'error');
        stopBookingProcess('AUTH_ERROR_CREATE');
        setIsCreatingRide(false);
        return;
      }

      const rideData = {
        vehicleType: selectedRide.vehicleType || selectedRide.vehicleName,
        pickupLocation: { latitude: origin.latitude, longitude: origin.longitude },
        dropLocation: { latitude: destination.latitude, longitude: destination.longitude },
        currentLocation: { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        pick_desc: pickup?.description,
        drop_desc: dropoff?.description,
        fare: farePayload,
        fcmToken,
        paymentMethod,
        platform: Platform.OS,
        scheduledAt: null,
        pickupAddress: pickup?.address || {},
        dropAddress: dropoff?.address || {},
      };

      const response = await axios.post(
        'http://192.168.1.37:3100/api/v1/new/new-ride',
        rideData,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
      );

      if (response.data?.success && response.data.data?.rideId) {
        const rideDetails = response.data.data;
        setCreatedRideId(rideDetails.rideId);
        if (rideDetails.ride_otp) setRideOtp(rideDetails.ride_otp);
        showNotification('Ride Requested!', response.data.message || 'Searching for drivers...', 'success');
        setBookingStatusMessage('Searching for drivers...');
        setCurrentRideStatus(rideDetails.ride_status || 'searching');

        bookingTimeoutRef.current = setTimeout(() => {
          if (isBookingInProgress && currentRideStatus !== 'driver_assigned' && !rideCompleted) {
            showNotification('No Drivers Found', 'Could not find a driver. Try again later.', 'info');
            stopBookingProcess('TIMEOUT');
          }
        }, BOOKING_TIMEOUT);
      } else {
        throw new Error(response.data?.message || 'Invalid server response.');
      }
    } catch (err) {
      console.error('Error creating ride:', err);
      showNotification('Booking Failed', err.response?.data?.message || 'Failed to create ride.', 'error');
      stopBookingProcess('CREATE_RIDE_API_ERROR');
    } finally {
      setIsCreatingRide(false);
    }
  }, [currentLocation, origin, destination, selectedRide, fcmToken, pickup, dropoff, farePayload, paymentMethod, isBookingInProgress, currentRideStatus, rideCompleted, stopBookingProcess]);

  // Cancel booking
  const handleCancelBooking = useCallback((isAutoCancel = false) => {
    const performCancel = async () => {
      try {
        stopBookingProcess('USER_CANCELLED');
        if (!isAutoCancel) {
          showNotification('Booking Cancelled', 'Ride request cancelled.', 'info');
        }
        if (createdRideId) {
          const token = await tokenCache.getToken('auth_token_db');
          if (token) {
            await axios.post(
              `http://192.168.1.37:3100/api/v1/new/cancel-before/${createdRideId}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!isAutoCancel) {
              showNotification('Success', 'Ride cancelled successfully.', 'success');
            }
          }
        }
        setCreatedRideId(null);
        setRideOtp(null);
      } catch (error) {
        console.error('Failed to cancel ride:', error);
        if (!isAutoCancel) {
          showNotification('Cancel Failed', 'Error cancelling ride.', 'error');
        }
      }
    };

    if (isAutoCancel) {
      performCancel();
    } else {
      Alert.alert('Cancel Booking?', 'Are you sure you want to cancel this ride?', [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: performCancel,
        },
      ]);
    }
  }, [createdRideId, stopBookingProcess]);

  // Payment method change
  const handleChangePayment = useCallback(() => {
    Alert.alert('Select Payment Method', 'Choose your preferred payment method:', [
      { text: 'Cash', onPress: () => setPaymentMethod('Cash') },
      { text: 'UPI', onPress: () => setPaymentMethod('UPI') },
      { text: 'Online', onPress: () => setPaymentMethod('Online') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  // Payment icon
  const getPaymentIcon = useCallback(() => {
    switch (paymentMethod) {
      case 'Cash':
        return 'cash-multiple';
      case 'UPI':
        return 'cellphone-link';
      case 'Online':
        return 'credit-card-outline';
      default:
        return 'credit-card-settings-outline';
    }
  }, [paymentMethod]);

  // Fit map to markers
  const fitMapToMarkers = useCallback(() => {
    if (mapRef.current && origin && destination) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ],
        { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }
      );
    }
  }, [origin, destination]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Components
  const Header = React.memo(() => (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => (isBookingInProgress ? handleCancelBooking() : navigation.goBack())}
        activeOpacity={0.7}
      >
        <Icon name="arrow-left" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Book Your Ride</Text>
      <View style={styles.headerButton} />
    </View>
  ));

  const MapSection = React.memo(() => (
    <View style={styles.mapContainer}>
      {origin && destination ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          googleMapId={GOOGLE_MAPS_APIKEY}
          initialRegion={{
            latitude: (origin.latitude + destination.latitude) / 2,
            longitude: (origin.longitude + destination.longitude) / 2,
            latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 2 || 0.01,
            longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 2 || 0.01,
          }}
          onMapReady={fitMapToMarkers}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          <Marker
            coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
            title="Pickup"
            description={pickup?.description || 'Pickup location'}
          >
            <View style={styles.customMarker}>
              <Icon name="map-marker-circle" size={32} color={COLORS.primary} />
            </View>
          </Marker>
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title="Drop-off"
            description={dropoff?.description || 'Destination'}
          >
            <View style={styles.customMarker}>
              <Icon name="flag-checkered" size={32} color={COLORS.secondary} />
            </View>
          </Marker>

          <Polyline
            coordinates={coordinates}
            strokeWidth={4}
            strokeColor={COLORS.primary}
            lineDashPattern={[0]}
          />

        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Icon name="map-outline" size={48} color={COLORS.text.tertiary} />
          <Text style={styles.mapPlaceholderText}>Loading map...</Text>
        </View>
      )}
    </View>
  ));

  const LocationCard = React.memo(() => (
    <View style={styles.locationCard}>
      <View style={styles.locationRow}>
        <View style={styles.locationIconContainer}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.primary }]} />
        </View>
        <View style={styles.locationTextContainer}>
          <Text style={styles.locationLabel}>PICKUP</Text>
          <Text style={styles.locationText} numberOfLines={2}>
            {pickup?.description || 'Current Location'}
          </Text>
        </View>
      </View>

      <View style={styles.routeLine} />

      <View style={styles.locationRow}>
        <View style={styles.locationIconContainer}>
          <View style={[styles.locationDot, { backgroundColor: COLORS.secondary }]} />
        </View>
        <View style={styles.locationTextContainer}>
          <Text style={styles.locationLabel}>DROP-OFF</Text>
          <Text style={styles.locationText} numberOfLines={2}>
            {dropoff?.description || 'Selected Destination'}
          </Text>
        </View>
      </View>
    </View>
  ));

  const RideDetailsCard = React.memo(() => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Ride Details</Text>
        {selectedRide?.durationInMinutes && (
          <View style={styles.durationBadge}>
            <Icon name="clock-outline" size={16} color={COLORS.primary} />
            <Text style={styles.durationText}>
              {selectedRide.durationInMinutes.toFixed(0)} min
            </Text>
          </View>
        )}
      </View>

      <View style={styles.vehicleInfo}>
        <Icon name="car" size={28} color={COLORS.primary} />
        <Text style={styles.vehicleText}>
          {selectedRide?.vehicleName || 'Standard Vehicle'}
        </Text>
      </View>

      <View style={styles.fareSection}>
        <Text style={styles.fareSectionTitle}>Fare Breakdown</Text>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Base Fare</Text>
          <Text style={styles.fareValue}>
            ₹{selectedRide?.pricing?.baseFare?.toFixed(0) || '0'}
          </Text>
        </View>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Distance Cost</Text>
          <Text style={styles.fareValue}>
            ₹{selectedRide?.pricing?.distanceCost?.toFixed(0) || '0'}
          </Text>
        </View>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Time Cost</Text>
          <Text style={styles.fareValue}>
            ₹{selectedRide?.pricing?.timeCost?.toFixed(0) || '0'}
          </Text>
        </View>
        <View style={styles.totalFareRow}>
          <Text style={styles.totalFareLabel}>Total Fare</Text>
          <Text style={styles.totalFareValue}>
            ₹{selectedRide?.totalPrice?.toFixed(0) || '0'}
          </Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        * Fare may vary based on distance, traffic, and tolls.
      </Text>
    </View>
  ));

  const BookingProgressCard = React.memo(() => (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.progressTitle}>Finding Your Driver</Text>
        <Text style={styles.progressMessage}>{bookingStatusMessage}</Text>
      </View>

      <View style={styles.statusIndicator}>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            (currentRideStatus === 'searching' || currentRideStatus === 'pending') && styles.statusDotActive
          ]} />
          <Text style={[
            styles.statusText,
            (currentRideStatus === 'searching' || currentRideStatus === 'pending') && styles.statusTextActive
          ]}>
            Searching for drivers
          </Text>
        </View>
        <View style={styles.statusConnector} />
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            currentRideStatus === 'driver_assigned' && styles.statusDotActive
          ]} />
          <Text style={[
            styles.statusText,
            currentRideStatus === 'driver_assigned' && styles.statusTextActive
          ]}>
            Driver assigned
          </Text>
        </View>
      </View>

      {rideOtp && (
        <View style={styles.otpSection}>
          <Text style={styles.otpLabel}>Your Ride OTP</Text>
          <Text style={styles.otpValue}>{rideOtp}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => handleCancelBooking()}
        activeOpacity={0.7}
      >
        <Icon name="close-circle-outline" size={20} color={COLORS.danger} />
        <Text style={styles.cancelButtonText}>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  ));

  if (isLoadingLocation) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.primary} />
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.primary} />
      <Header />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <MapSection />
        <LocationCard />
        {isBookingInProgress ? <BookingProgressCard /> : <RideDetailsCard />}
      </ScrollView>

      {!isBookingInProgress && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.paymentSelector}
            onPress={handleChangePayment}
            activeOpacity={0.7}
          >
            <Icon name={getPaymentIcon()} size={24} color={COLORS.primary} />
            <Text style={styles.paymentText}>{paymentMethod}</Text>
            <Icon name="chevron-down" size={20} color={COLORS.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bookButton,
              (!selectedRide || !currentLocation || isCreatingRide) && styles.bookButtonDisabled
            ]}
            onPress={handleCreateRide}
            disabled={!selectedRide || !currentLocation || isCreatingRide}
            activeOpacity={0.8}
          >
            {isCreatingRide ? (
              <ActivityIndicator size="small" color={COLORS.text.inverse} />
            ) : (
              <>
                <Text style={styles.bookButtonText}>Book Ride</Text>
                <Text style={styles.bookButtonSubtext}>
                  ₹{selectedRide?.totalPrice?.toFixed(0) || '0'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Header Styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    elevation: 2,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background.secondary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },

  // Scroll View Styles
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 24,
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },

  // Map Styles
  mapContainer: {
    height: height * 0.4,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: COLORS.shadow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background.tertiary,
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.tertiary,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Location Card Styles
  locationCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.background.primary,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  locationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  routeLine: {
    width: 2,
    height: 32,
    backgroundColor: COLORS.border.medium,
    marginLeft: 11,
    marginVertical: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text.tertiary,
    marginBottom: 6,
    letterSpacing: 1,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
    lineHeight: 22,
  },

  // Card Styles
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.background.primary,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  durationText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Vehicle Info Styles
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 16,
  },
  vehicleText: {
    marginLeft: 16,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Fare Section Styles
  fareSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    paddingTop: 20,
  },
  fareSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  fareLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  fareValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  totalFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  totalFareLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  totalFareValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  disclaimer: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Progress Card Styles
  progressCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.background.primary,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  progressHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  progressMessage: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },

  // Status Indicator Styles
  statusIndicator: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.border.medium,
    marginRight: 16,
  },
  statusDotActive: {
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  statusConnector: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border.light,
    marginLeft: 6,
    marginVertical: 8,
  },

  // OTP Section Styles
  otpSection: {
    backgroundColor: COLORS.successLight,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 8,
  },
  otpValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.success,
    letterSpacing: 4,
  },

  // Cancel Button Styles
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight,
  },
  cancelButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },

  // Footer Styles
  footer: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    elevation: 12,
    shadowColor: COLORS.shadow.dark,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },

  // Payment Selector Styles
  paymentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  paymentText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Book Button Styles
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    minHeight: 64,
  },
  bookButtonDisabled: {
    backgroundColor: COLORS.border.medium,
    elevation: 0,
    shadowOpacity: 0,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.inverse,
    marginBottom: 4,
  },
  bookButtonSubtext: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.inverse,
    opacity: 0.9,
  },
});