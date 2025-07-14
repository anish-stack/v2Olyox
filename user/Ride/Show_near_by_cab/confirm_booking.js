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
  Switch,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import { tokenCache } from '../../Auth/cache';
import { useLocation } from '../../context/LocationContext';
import { useRide } from '../../context/RideContext';
import useNotificationPermission from '../../hooks/notification';
import MapViewDirections from "react-native-maps-directions";
import useSettings from '../../hooks/Settings';
import { useRideSearching } from '../../context/ride_searching';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8';
const POLLING_INTERVAL = 8000;
const RIDER_CHECK_INTERVAL = 10000;
const BOOKING_TIMEOUT = 120000;
const isAndroid = Platform.OS === "android";

// Enhanced Color Palette
const COLORS = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryDark: '#3730A3',
  secondary: '#10B981',
  secondaryLight: '#D1FAE5',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
    card: '#FFFFFF',
  },
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    muted: '#9CA3AF',
  },
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
  },
  shadow: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(0, 0, 0, 0.15)',
  },
};

// Delhi NCR boundaries (approximate)
const DELHI_NCR_BOUNDS = {
  north: 28.8,
  south: 28.0,
  east: 77.5,
  west: 76.8,
};

const showNotification = (title, message, type = 'info') => {
  const displayMessage = `${title ? title + '\n' : ''}${message}`;
  if (Platform.OS === 'android') {
    ToastAndroid.show(displayMessage, type === 'error' || message.length > 60 ? ToastAndroid.LONG : ToastAndroid.SHORT);
  } else {
    Alert.alert(title || (type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Notification'), message);
  }
};

const isLocationInDelhiNCR = (latitude, longitude) => {
  return (
    latitude >= DELHI_NCR_BOUNDS.south &&
    latitude <= DELHI_NCR_BOUNDS.north &&
    longitude >= DELHI_NCR_BOUNDS.west &&
    longitude <= DELHI_NCR_BOUNDS.east
  );
};

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
  const { saveRideSearching, updateRideStatusSearching, clearCurrentRideSearching } = useRideSearching();
  const { fcmToken } = useNotificationPermission();
  const { settings } = useSettings();
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
  const [ridersNearYou, setRidersNearYou] = useState([]);
  const [isLoadingRiders, setIsLoadingRiders] = useState(false);
  const [isRidePooling, setIsRidePooling] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Refs
  const pollingRef = useRef(null);
  const riderCheckRef = useRef(null);
  const bookingTimeoutRef = useRef(null);
  const mapRef = useRef(null);
  const isActiveRef = useRef(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    is_pooling: isRidePooling,
  }), [selectedRide, isRidePooling]);

  const isLocationValid = useMemo(() => {
    if (!origin || !destination) return false;
    return isLocationInDelhiNCR(origin.latitude, origin.longitude) &&
      isLocationInDelhiNCR(destination.latitude, destination.longitude);
  }, [origin, destination]);

  const vehicleIcon = useMemo(() => {
    const vehicleType = selectedRide?.vehicleType || selectedRide?.vehicleName || '';
    return vehicleType.toLowerCase().includes('bike') || vehicleType.toLowerCase().includes('motorcycle')
      ? 'motorbike'
      : 'car';
  }, [selectedRide]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (riderCheckRef.current) {
      clearInterval(riderCheckRef.current);
      riderCheckRef.current = null;
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

  // Fetch nearby riders with error handling
  const fetchNearByRiders = useCallback(async () => {
    if (!origin || !selectedRide || !isActiveRef.current) return;

    setIsLoadingRiders(true);
    try {
      const response = await axios.post(
        'https://www.appv2.olyox.com/api/v1/new/find-rider-near-user',
        {
          lat: origin.latitude,
          lng: origin.longitude,
          vehicleType: selectedRide.vehicleName || selectedRide.vehicleType,
        },
        { timeout: 10000 }
      );

      if (response.data?.success && response.data?.data) {
        setRidersNearYou(response.data.data);
        console.log("response.data.data", response.data.data)
        setLocationError(null);
      } else {
        setRidersNearYou([]);
      }
    } catch (error) {
      console.error('Error fetching nearby riders:', error);
      setRidersNearYou([]);
      if (error.code === 'ECONNABORTED') {
        setLocationError('Network timeout. Please check your connection.');
      } else {
        setLocationError('Unable to find nearby riders.');
      }
    } finally {
      setIsLoadingRiders(false);
    }
  }, [origin, selectedRide]);

  // Fetch directions with error handling
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

      const response = await axios.post(
        'https://appapi.olyox.com/directions',
        { pickup, dropoff },
        { timeout: 15000 }
      );

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

  // Fetch location with enhanced error handling
  const fetchLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      if (contextLocation?.coords) {
        setCurrentLocation(contextLocation.coords);
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission is required to book a ride.');
          showNotification('Permission Denied', 'Location permission required.', 'error');
          setIsLoadingLocation(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000,
        });
        setCurrentLocation(position.coords);
        setLocationError(null);
      }
    } catch (err) {
      console.error('Error getting location:', err);
      setLocationError('Unable to get your current location.');
      showNotification('Location Error', 'Unable to get location.', 'error');
    }
    setIsLoadingLocation(false);
  }, [contextLocation]);

  // Poll ride status with enhanced error handling
  const pollRideStatus = useCallback(async () => {
    if (!createdRideId || !isBookingInProgress || rideCompleted || !isActiveRef.current) return;

    setTimeout(()=>{
        console.log("I am Start at evry call time to late 5 second")
    },5000)
    try {
      const token = await tokenCache.getToken('auth_token_db');
      if (!token) {
        showNotification('Authentication Error', 'Please log in again.', 'error');
        stopBookingProcess('AUTH_ERROR_POLL');
        return;
      }
      console.log("Pooling Start",createdRideId)
      const response = await axios.get(
        `https://www.appv2.olyox.com/api/v1/new/status/${createdRideId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: POLLING_INTERVAL - 1000
        }
      );
            console.log("Pooling End",response.data?.status)


      const { status: newStatus, rideDetails, message } = response.data;

      if (rideCompleted) return;

      setCurrentRideStatus(newStatus);
      setBookingStatusMessage(message || `Ride status: ${newStatus}`);

      switch (newStatus) {
        case 'driver_assigned':
          showNotification('Driver Assigned!', message || 'Your ride is on the way.', 'success');
          saveRide({ ...rideDetails, ride_otp: rideOtp });
          clearCurrentRideSearching();
          updateRideStatus('confirmed');
          stopBookingProcess('DRIVER_ASSIGNED');
          navigation.replace('RideStarted', { driver: rideDetails?._id, origin, destination });
          break;
        case 'cancelled':
          clearCurrentRideSearching();
          showNotification('Ride Cancelled', message || 'Ride cancelled.', 'info');
          stopBookingProcess('CANCELLED_BY_SYSTEM');
          break;
        case 'completed':
          clearCurrentRideSearching();
          showNotification('Ride Completed!', message || 'Thank you for riding.', 'success');
          stopBookingProcess('COMPLETED');
          break;
      }
    } catch (err) {
      console.error('Error polling ride status:', err?.response?.data);
      if (err.response?.status === 401 || err.response?.status === 404) {
        showNotification('Status Error', 'Could not verify ride status.', 'error');
      }
    }
  }, [createdRideId, isBookingInProgress, rideCompleted, navigation, saveRide, updateRideStatus, origin, destination, rideOtp, stopBookingProcess]);

  // Create ride with enhanced error handling
  const handleCreateRide = useCallback(async () => {
    if (!currentLocation || !origin || !destination || !selectedRide || !fcmToken) {
      showNotification('Missing Information', 'Ensure location and ride details are selected.', 'error');
      return;
    }

    if (!isLocationValid) {
      Alert.alert(
        'Service Area',
        'We currently only accept bookings within Delhi NCR (Delhi, Gurgaon, Noida, Haryana). Please select locations within our service area.',
        [{ text: 'OK' }]
      );
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
        isPooling: isRidePooling,
      };

      const response = await axios.post(
        'https://www.appv2.olyox.com/api/v1/new/new-ride',
        rideData,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000
        }
      );

      if (response.data?.success && response.data.data?.rideId) {
        const rideDetails = response.data.data;
        saveRideSearching({ _id: response.data.data?.rideId });
        updateRideStatusSearching('searching');
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
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create ride.';
      showNotification('Booking Failed', errorMessage, 'error');
      stopBookingProcess('CREATE_RIDE_API_ERROR');
    } finally {
      setIsCreatingRide(false);
    }
  }, [currentLocation, origin, destination, selectedRide, fcmToken, pickup, dropoff, farePayload, paymentMethod, isBookingInProgress, currentRideStatus, rideCompleted, stopBookingProcess, isLocationValid, isRidePooling]);

  // Cancel booking with confirmation
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
              `https://www.appv2.olyox.com/api/v1/new/cancel-before/${createdRideId}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!isAutoCancel) {
              showNotification('Success', 'Ride cancelled successfully.', 'success');
            }
          }
        }

        updateRideStatusSearching('cancel');
        clearCurrentRideSearching();
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
      Alert.alert(
        'Cancel Booking?',
        'Are you sure you want to cancel this ride?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: performCancel,
          },
        ]
      );
    }
  }, [createdRideId, stopBookingProcess]);

  // Payment method selection
  const handleChangePayment = useCallback(() => {
    Alert.alert(
      'Select Payment Method',
      'Choose your preferred payment method:',
      [
        { text: 'Cash', onPress: () => setPaymentMethod('Cash') },
        { text: 'UPI', onPress: () => setPaymentMethod('UPI') },
        { text: 'Online', onPress: () => setPaymentMethod('Online') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  // Get payment icon
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
    if (mapRef.current && origin && destination && mapReady) {
      setTimeout(() => {
        mapRef.current.fitToCoordinates(
          [
            { latitude: origin.latitude, longitude: origin.longitude },
            { latitude: destination.latitude, longitude: destination.longitude },
            ...ridersNearYou.map(rider => ({
              latitude: rider.latitude || rider.lat,
              longitude: rider.longitude || rider.lng,
            })),
          ],
          {
            edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
            animated: true
          }
        );
      }, 500);
    }
  }, [origin, destination, ridersNearYou, mapReady]);

  // Effects
  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      return () => {
        isActiveRef.current = false;
        if (isBookingInProgress && !rideCompleted) {
          cleanup();
        }
      };
    }, [isBookingInProgress, rideCompleted, cleanup, fadeAnim])
  );

  useEffect(() => {
    fetchDirections();
  }, [fetchDirections]);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  useEffect(() => {
    if (origin && selectedRide) {
      fetchNearByRiders();


      return () => {
        if (riderCheckRef.current) {
          clearInterval(riderCheckRef.current);
          riderCheckRef.current = null;
        }
      };
    }
  }, [origin, selectedRide, fetchNearByRiders]);

  useEffect(() => {
    if (mapReady && ridersNearYou.length > 0) {
      fitMapToMarkers();
    }
  }, [ridersNearYou, mapReady, fitMapToMarkers]);

  // Status polling effect
  useEffect(() => {
  if (!createdRideId || !isBookingInProgress || rideCompleted) return;

  const timeout = setTimeout(() => {
    pollRideStatus(); // Initial call after 5 seconds
    pollingRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
  }, 5000); // Delay start by 5 seconds

  return () => {
    clearTimeout(timeout); // Clear timeout on unmount
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };
}, [createdRideId, isBookingInProgress, rideCompleted, pollRideStatus]);


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
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Icon name="arrow-left" size={24} color={COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Book Your Ride</Text>
      <View style={styles.headerButton} />
    </View>
  ));

  const ServiceAreaWarning = React.memo(() => {
    if (isLocationValid) return null;

    return (
      <View style={styles.warningCard}>
        <Icon name="alert-circle" size={24} color={COLORS.warning} />
        <View style={styles.warningTextContainer}>
          <Text style={styles.warningTitle}>Service Area Notice</Text>
          <Text style={styles.warningText}>
            We currently only accept bookings within Delhi NCR (Delhi, Gurgaon, Noida, Haryana).
          </Text>
        </View>
      </View>
    );
  });

  const RiderAvailabilityIndicator = React.memo(() => (
    <View style={styles.riderIndicatorCard}>
      <View style={styles.riderIndicatorHeader}>
        <Icon
          name={vehicleIcon}
          size={20}
          color={ridersNearYou.length > 0 ? COLORS.success : COLORS.text.secondary}
        />
        <Text style={styles.riderIndicatorTitle}>
          {isLoadingRiders ? 'Checking...' : `${ridersNearYou.length} riders nearby`}
        </Text>
        {isLoadingRiders && <ActivityIndicator size="small" color={COLORS.primary} />}
      </View>
      {ridersNearYou.length === 0 && !isLoadingRiders && (
        <Text style={styles.riderIndicatorSubtext}>
          No riders available in your area right now. Please try again later.
        </Text>
      )}
      {locationError && (
        <Text style={styles.errorText}>{locationError}</Text>
      )}
    </View>
  ));

  const MapSection = React.memo(() => (
    <View style={styles.mapContainer}>
      {origin && destination ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={isAndroid ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          region={{
            latitude: origin.latitude,
            longitude: origin.longitude,
            latitudeDelta: 0.01, // zoom level
            longitudeDelta: 0.01, // zoom level
          }}
          onMapReady={() => {
            setMapReady(true);
            setTimeout(fitMapToMarkers, 1000);
          }}
          showsUserLocation={true}
          showsCompass={true}
          showsMyLocationButton={true}
          minZoomLevel={5}
          maxZoomLevel={18}
          toolbarEnabled={false}
        >
          {/* Pickup marker */}
          <Marker
            coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
            title="Pickup"
            description={pickup?.description || 'Pickup location'}
          >
            <View style={styles.pickupMarker}>
              <Icon name="circle" size={16} color={COLORS.success} />
            </View>
          </Marker>

          {/* Drop-off marker */}
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title="Drop-off"
            description={dropoff?.description || 'Destination'}
          >
            <View style={styles.dropoffMarker}>
              <Icon name="square" size={16} color={COLORS.danger} />
            </View>
          </Marker>

          {/* Available riders markers */}
          {ridersNearYou.map((rider, index) => {
            const lat = rider.location?.coordinates[1] ?? rider.lat;
            const lng = rider.location?.coordinates[0] ?? rider.lng;

            const isValidLat = typeof lat === 'number' && !isNaN(lat);
            const isValidLng = typeof lng === 'number' && !isNaN(lng);

            const defaultLat = 28.6139; // Fallback: New Delhi
            const defaultLng = 77.2090;

            const baseLat = isValidLat ? lat : defaultLat;
            const baseLng = isValidLng ? lng : defaultLng;

            // Offset within ~100 meters
            const offsetLat = baseLat + ((Math.random() - 0.5) * 0.001); // ±0.0005 ~ ±55m
            const offsetLng = baseLng + ((Math.random() - 0.5) * 0.001);

            return (
              <Marker
                key={`rider-${index}`}
                coordinate={{
                  latitude: offsetLat,
                  longitude: offsetLng,
                }}
                title={`${vehicleIcon === 'motorbike' ? 'Bike' : 'Car'} Rider`}
                description="Available for ride"
              >
                <View style={styles.riderMarker}>
                  <Icon
                    name={vehicleIcon}
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
              </Marker>
            );
          })}


          {/* Route rendering */}
          {destination && (
            <>
              {isAndroid && (
                <MapViewDirections
                  origin={{
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                  }}
                  destination={{
                    latitude: destination.latitude,
                    longitude: destination.longitude,
                  }}
                  apikey={GOOGLE_MAPS_APIKEY}
                  strokeWidth={4}
                  strokeColor={COLORS.primary}
                  mode="DRIVING"
                  onError={(errorMessage) => {
                    console.warn("MapViewDirections Error:", errorMessage);
                  }}
                />
              )}
              {!isAndroid && coordinates.length > 0 && (
                <Polyline
                  coordinates={coordinates}
                  strokeWidth={4}
                  strokeColor={COLORS.primary}
                />
              )}
            </>
          )}
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
          <View style={[styles.locationDot, { backgroundColor: COLORS.success }]} />
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
          <View style={[styles.locationDot, { backgroundColor: COLORS.danger }]} />
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
        <View style={styles.cardTitleContainer}>
          <Icon name={vehicleIcon} size={24} color={COLORS.primary} />
          <Text style={styles.cardTitle}>
            {selectedRide?.vehicleName || 'Standard Vehicle'}
          </Text>
        </View>
        {selectedRide?.durationInMinutes && (
          <View style={styles.durationBadge}>
            <Icon name="clock-outline" size={16} color={COLORS.primary} />
            <Text style={styles.durationText}>
              {selectedRide.durationInMinutes.toFixed(0)} min
            </Text>
          </View>
        )}
      </View>



      <View style={styles.fareSection}>
        <Text style={styles.fareSectionTitle}>Fare Breakdown</Text>

        {/* Total Fare Before Discount */}
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Total Fare (Before Discount)</Text>
          <Text style={styles.fareValue}>
            ₹
            {selectedRide && settings
              ? (selectedRide.totalPrice * (1 + settings.ride_percentage_off / 100)).toFixed(0)
              : '0'}
          </Text>
        </View>

        {/* Offer Discount Row */}
        {selectedRide && settings && (
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>
              Offer Discount ({settings.ride_percentage_off}%)
            </Text>
            <Text style={[styles.fareValue, { color: COLORS.success }]}>
              -₹{(selectedRide.totalPrice * settings.ride_percentage_off / 100).toFixed(0)}
            </Text>
          </View>
        )}

        {/* Actual Total Fare */}
        <View style={styles.totalFareRow}>
          <Text style={styles.totalFareLabel}>Total Fare</Text>
          <Text style={styles.totalFareValue}>
            ₹{selectedRide?.totalPrice?.toFixed(0) || '0'}
          </Text>
        </View>
      </View>


      <Text style={styles.disclaimer}>
        * MCD and toll taxes are excluded in this fare. Please do not pay any additional charges to the driver
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

      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <MapSection />
          <RiderAvailabilityIndicator />
          <ServiceAreaWarning />
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
                (!selectedRide || !currentLocation || isCreatingRide || !isLocationValid) && styles.bookButtonDisabled
              ]}
              onPress={handleCreateRide}
              disabled={!selectedRide || !currentLocation || isCreatingRide || !isLocationValid}
              activeOpacity={0.8}
            >
              {isCreatingRide ? (
                <ActivityIndicator size="small" color={COLORS.text.inverse} />
              ) : (
                <>
                  <Text style={styles.bookButtonText}>
                    {isRidePooling ? 'Book Pool Ride' : 'Book Ride'}
                  </Text>
                  <Text style={styles.bookButtonSubtext}>
                    ₹{(
                      (selectedRide?.totalPrice || 0) *
                      (isRidePooling ? 0.7 : 1) *
                      (1 - (settings?.ride_percentage_off || 0) / 100)
                    ).toFixed(0)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    elevation: 2,
    shadowColor: COLORS.shadow.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  mapContainer: {
    height: height * 0.4,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background.secondary,
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.text.tertiary,
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  dropoffMarker: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: COLORS.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  riderMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    elevation: 3,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningLight,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  warningTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  riderIndicatorCard: {
    backgroundColor: COLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: COLORS.shadow.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  riderIndicatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  riderIndicatorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  riderIndicatorSubtext: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    lineHeight: 16,
  },
  locationCard: {
    backgroundColor: COLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border.medium,
    marginLeft: 11,
    marginVertical: 8,
  },
  card: {
    backgroundColor: COLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 12,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 4,
  },
  poolingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  poolingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  poolingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginLeft: 8,
  },
  poolingSubtext: {
    fontSize: 12,
    color: COLORS.success,
    marginLeft: 8,
    fontWeight: '500',
  },
  fareSection: {
    marginBottom: 16,
  },
  fareSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fareLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  totalFareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    marginTop: 8,
  },
  totalFareLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  totalFareValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  disclaimer: {
    fontSize: 11,
    color: COLORS.text.tertiary,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  progressCard: {
    backgroundColor: COLORS.background.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 24,
    borderRadius: 16,
    elevation: 3,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  progressHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  progressMessage: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  statusIndicator: {
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border.medium,
    marginRight: 12,
  },
  statusDotActive: {
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  statusTextActive: {
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  statusConnector: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border.light,
    marginLeft: 5,
    marginVertical: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.dangerLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
    marginLeft: 8,
  },
  footer: {
    backgroundColor: COLORS.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    elevation: 8,
    shadowColor: COLORS.shadow.dark,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  paymentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  bookButtonDisabled: {
    backgroundColor: COLORS.border.medium,
    elevation: 0,
    shadowOpacity: 0,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.inverse,
    marginBottom: 2,
  },
  bookButtonSubtext: {
    fontSize: 14,
    color: COLORS.text.inverse,
    opacity: 0.9,
  },
});