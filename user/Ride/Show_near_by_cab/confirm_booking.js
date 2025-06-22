import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  ToastAndroid,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
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

const showNotification = (title, message, type = 'info') => {
  const displayMessage = `${title ? title + '\n' : ''}${message}`;
  if (Platform.OS === 'android') {
    ToastAndroid.show(displayMessage, type === 'error' || message.length > 60 ? ToastAndroid.LONG : ToastAndroid.SHORT);
  } else {
    Alert.alert(title || (type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Notification'), message);
  }
};

export default function BookingConfirmation() {
  const route = useRoute();
  const navigation = useNavigation();
  const { location: contextLocation } = useLocation();
  const { saveRide, updateRideStatus } = useRide();
  const { fcmToken } = useNotificationPermission();

  const { origin, destination, selectedRide, dropoff, pickup } = route.params || {};

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

  const pollingRef = useRef(null);
  const bookingTimeoutRef = useRef(null);
  const mapRef = useRef(null);

  const fetchDirections = async () => {
    if (!origin || !destination) return;
    try {
      console.log('Fetching directions...');
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json`,
        {
          params: {
            origin: `${origin.latitude},${origin.longitude}`,
            destination: `${destination.latitude},${destination.longitude}`,
            key: GOOGLE_MAPS_APIKEY,
            mode: 'driving',
          },
          timeout: 10000,
        }
      );
      if (response.data.routes.length > 0) {
        const points = decodePolyline(response.data.routes[0].overview_polyline.points);
        const coords = points.map(point => ({
          latitude: point[0],
          longitude: point[1],
        }));
        setCoordinates(coords);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      showNotification('Route Error', 'Unable to fetch route directions.', 'error');
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

  useEffect(() => {
    fetchDirections();
  }, [origin, destination]);

  useEffect(() => {
    const fetchLocation = async () => {
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
    };
    fetchLocation();
  }, [contextLocation]);

  useEffect(() => {
    if (!createdRideId || !isBookingInProgress) return;

    const pollRideStatus = async () => {
      try {
        const token = await tokenCache.getToken('auth_token_db');
        if (!token) {
          showNotification('Authentication Error', 'Please log in again.', 'error');
          stopBookingProcess('AUTH_ERROR_POLL');
          return;
        }
        const response = await axios.get(
          `https://www.appv2.olyox.com/api/v1/new/status/${createdRideId}`,
          { headers: { Authorization: `Bearer ${token}` }, timeout: POLLING_INTERVAL - 1000 }
        );
        const { status: newStatus, rideDetails, message } = response.data;
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
    };

    pollingRef.current = setInterval(pollRideStatus, POLLING_INTERVAL);
    pollRideStatus();

    return () => clearInterval(pollingRef.current);
  }, [createdRideId, isBookingInProgress, navigation, saveRide, updateRideStatus, origin, destination, rideOtp]);

  const stopBookingProcess = (reason) => {
    console.log('Stopping booking process:', reason);
    setIsBookingInProgress(false);
    clearInterval(pollingRef.current);
    clearTimeout(bookingTimeoutRef.current);
  };

  const handleCreateRide = async () => {
    if (!currentLocation || !origin || !destination || !selectedRide || !fcmToken) {
      showNotification('Missing Information', 'Ensure location and ride details are selected.', 'error');
      return;
    }

    setIsCreatingRide(true);
    setIsBookingInProgress(true);
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

      const farePayload = {
        base_fare: selectedRide.pricing?.baseFare || 0,
        distance_fare: selectedRide.pricing?.distanceCost || 0,
        time_fare: selectedRide.pricing?.timeCost || 0,
        platform_fee: selectedRide.pricing?.fuelSurcharge || 0,
        night_charge: selectedRide.pricing?.nightSurcharge || 0,
        rain_charge: selectedRide.conditions?.rain ? (selectedRide.pricing?.rainCharge || 10) : 0,
        toll_charge: selectedRide.pricing?.tollCost || 0,
        discount: selectedRide.pricing?.discount || 0,
        total_fare: selectedRide.totalPrice,
        currency: selectedRide.pricing?.currency || 'INR',
      };

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
        'https://www.appv2.olyox.com/api/v1/new/new-ride',
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
          if (isBookingInProgress && currentRideStatus !== 'driver_assigned') {
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
  };

  const handleCancelBooking = () => {
    Alert.alert('Cancel Booking?', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            stopBookingProcess('USER_CANCELLED');
            showNotification('Booking Cancelled', 'Ride request cancelled.', 'info');
            if (createdRideId) {
              await axios.post(`https://www.appv2.olyox.com/api/v1/new/cancel-before/${createdRideId}`);
              showNotification('Success', 'Ride cancelled.', 'success');
            }
            setCreatedRideId(null);
            setRideOtp(null);
          } catch (error) {
            console.error('Failed to cancel ride:', error);
            showNotification('Cancel Failed', 'Error cancelling ride.', 'error');
          }
        },
      },
    ]);
  };

  const handleChangePayment = () => {
    Alert.alert('Select Payment Method', 'Choose payment method:', [
      { text: 'Cash', onPress: () => setPaymentMethod('Cash') },
      { text: 'UPI', onPress: () => setPaymentMethod('UPI') },
      { text: 'Online', onPress: () => setPaymentMethod('Online') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const getPaymentIcon = () => {
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
  };

  const fitMapToMarkers = () => {
    if (mapRef.current && origin && destination) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ],
        { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }
      );
    }
  };

  const Header = () => (
    <View>
      <TouchableOpacity onPress={() => (isBookingInProgress ? handleCancelBooking() : navigation.goBack())}>
        <Icon name="arrow-left" size={24} />
      </TouchableOpacity>
      <Text>Book Your Ride</Text>
    </View>
  );

  const MapSection = () => (
    <View>
      {origin && destination ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: (origin.latitude + destination.latitude) / 2,
            longitude: (origin.longitude + destination.longitude) / 2,
            latitudeDelta: Math.abs(origin.latitude - destination.latitude) * 2 || 0.01,
            longitudeDelta: Math.abs(origin.longitude - destination.longitude) * 2 || 0.01,
          }}
          onMapReady={fitMapToMarkers}
        >
          <Marker
            coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
            title="Pickup"
            description={pickup?.description || 'Pickup location'}
          >
            <Icon name="map-marker-circle" size={30} />
          </Marker>
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title="Drop-off"
            description={dropoff?.description || 'Destination'}
          >
            <Icon name="flag-checkered" size={30} />
          </Marker>
          {Platform.OS === 'ios' && coordinates.length > 0 && (
            <Polyline coordinates={coordinates} strokeWidth={4} strokeColor="#2196F3" />
          )}
          {Platform.OS !== 'ios' && coordinates.length > 0 && (
            <Polyline coordinates={coordinates} strokeWidth={4} strokeColor="#2196F3" />
          )}
        </MapView>
      ) : (
        <View>
          <Icon name="map-outline" size={48} />
          <Text>Map loading...</Text>
        </View>
      )}
    </View>
  );

  const LocationCard = () => (
    <View>
      <View>
        <Text>PICKUP</Text>
        <Text>{pickup?.description || 'Current Location'}</Text>
      </View>
      <View>
        <Text>DROP-OFF</Text>
        <Text>{dropoff?.description || 'Selected Destination'}</Text>
      </View>
    </View>
  );

  const RideDetailsCard = () => (
    <View>
      <View>
        <Text>Ride Details</Text>
        {selectedRide?.durationInMinutes && (
          <View>
            <Icon name="clock-outline" size={16} />
            <Text>{selectedRide.durationInMinutes.toFixed(0)} min</Text>
          </View>
        )}
      </View>
      <View>
        <Icon name="car" size={24} />
        <Text>{selectedRide?.vehicleName || 'Standard Vehicle'}</Text>
      </View>
      <View>
        <Text>Fare Breakdown</Text>
        <View>
          <Text>Base Fare</Text>
          <Text>₹{selectedRide?.totalPrice?.toFixed(0) || '0'}</Text>
        </View>
        <View>
          <Text>Total Fare</Text>
          <Text>₹{selectedRide?.totalPrice?.toFixed(0) || '0'}</Text>
        </View>
      </View>
      <Text>* Fare may vary based on distance, traffic, and tolls.</Text>
    </View>
  );

  const BookingProgressCard = () => (
    <View>
      <View>
        <ActivityIndicator size="large" />
        <Text>Finding Your Driver</Text>
        <Text>{bookingStatusMessage}</Text>
      </View>
      <View>
        <View>
          <Text>Searching for drivers</Text>
        </View>
        <View>
          <Text>Driver assigned</Text>
        </View>
      </View>
      {rideOtp && (
        <View>
          <Text>Your Ride OTP</Text>
          <Text>{rideOtp}</Text>
        </View>
      )}
      <TouchableOpacity onPress={handleCancelBooking}>
        <Icon name="close-circle-outline" size={20} />
        <Text>Cancel Request</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoadingLocation) {
    return (
      <SafeAreaView>
        <Header />
        <View>
          <ActivityIndicator size="large" />
          <Text>Getting your location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <Header />
      <ScrollView>
        <MapSection />
        <LocationCard />
        {isBookingInProgress ? <BookingProgressCard /> : <RideDetailsCard />}
      </ScrollView>
      {!isBookingInProgress && (
        <View>
          <TouchableOpacity onPress={handleChangePayment}>
            <Icon name={getPaymentIcon()} size={24} />
            <Text>{paymentMethod}</Text>
            <Icon name="chevron-down" size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCreateRide}
            disabled={!selectedRide || !currentLocation || isCreatingRide}
          >
            {isCreatingRide ? (
              <ActivityIndicator size="small" />
            ) : (
              <>
                <Text>Book Ride</Text>
                <Text>₹{selectedRide?.totalPrice?.toFixed(0) || '0'}</Text>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.background.primary,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border.light,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background.secondary,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        textAlign: 'center',
    },

    // Scroll View Styles
    scrollView: {
        flex: 1,
    },
    scrollContainer: {
        paddingBottom: 20,
    },

    // Loading Styles
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },

    // Map Styles
    mapContainer: {
        height: height * 0.35,
        margin: 16,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
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
        marginTop: 8,
        fontSize: 14,
        color: COLORS.text.tertiary,
    },
    customMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Location Card Styles
    locationCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.background.primary,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    routeLine: {
        width: 2,
        height: 32,
        backgroundColor: COLORS.border.medium,
        marginLeft: 11,
        marginVertical: 8,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text.tertiary,
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    locationText: {
        fontSize: 15,
        color: COLORS.text.primary,
        lineHeight: 20,
    },

    // Card Styles
    card: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.background.primary,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
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
        marginLeft: 4,
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.primary,
    },

    // Vehicle Info Styles
    vehicleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.background.secondary,
        borderRadius: 12,
    },
    vehicleText: {
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text.primary,
    },

    // Fare Section Styles
    fareSection: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border.light,
        paddingTop: 16,
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
        paddingVertical: 8,
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
        paddingVertical: 12,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border.light,
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
        fontSize: 12,
        color: COLORS.text.tertiary,
        textAlign: 'center',
        marginTop: 12,
        fontStyle: 'italic',
        lineHeight: 16,
    },

    // Progress Card Styles
    progressCard: {
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.background.primary,
        borderRadius: 16,
        padding: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 2,
        borderColor: COLORS.primaryLight,
    },
    progressHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    progressTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.primary,
        marginTop: 12,
        marginBottom: 8,
    },
    progressMessage: {
        fontSize: 14,
        color: COLORS.text.secondary,
        textAlign: 'center',
    },

    // Status Indicator Styles
    statusIndicator: {
        marginBottom: 20,
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
    statusConnector: {
        width: 2,
        height: 20,
        backgroundColor: COLORS.border.light,
        marginLeft: 5,
        marginVertical: 4,
    },

    // OTP Section Styles
    otpSection: {
        backgroundColor: COLORS.successLight,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.success,
    },
    otpLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.success,
        marginBottom: 4,
    },
    otpValue: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.success,
        letterSpacing: 2,
    },

    // Cancel Button Styles
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.danger,
        backgroundColor: COLORS.dangerLight,
    },
    cancelButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.danger,
    },

    // Footer Styles
    footer: {
        backgroundColor: COLORS.background.primary,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border.light,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },

    // Payment Selector Styles
    paymentSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background.secondary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border.light,
    },
    paymentText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.text.primary,
    },

    // Book Button Styles
    bookButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        minHeight: 56,
    },
    bookButtonDisabled: {
        backgroundColor: COLORS.border.medium,
        elevation: 0,
        shadowOpacity: 0,
    },
    bookButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text.inverse,
        marginBottom: 2,
    },
    bookButtonSubtext: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.text.inverse,
        opacity: 0.9,
    },
});