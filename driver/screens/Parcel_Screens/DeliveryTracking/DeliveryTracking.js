import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Linking,
  Dimensions,
  Platform,
  SafeAreaView,
  Animated,
  Vibration
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { useSocket } from '../../../context/SocketContext';
import useUserDetails from '../../../hooks/user/User.hook';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { MaterialIcons, FontAwesome5, Ionicons, Entypo, MaterialCommunityIcons } from '@expo/vector-icons';

const GOOGLE_MAPS_API_KEY = "AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8";
const { width, height } = Dimensions.get('window');
const PICKUP_TIMER_MINUTES = 25;

export default function DeliveryTracking() {
  const route = useRoute();
  const navigation = useNavigation();
  const { parcelId } = route.params;
  const { socket } = useSocket();
  const { userData } = useUserDetails();
  const mapRef = useRef(null);
  const timerAnimation = useRef(new Animated.Value(0)).current;

  const [parcelDetails, setParcelDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [pickupTimer, setPickupTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerInterval, setTimerInterval] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Format timer to MM:SS
  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(pickupTimer / 60);
    const seconds = pickupTimer % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [pickupTimer]);

  // Timer percentage for animation
  const timerPercentage = useMemo(() => {
    return (pickupTimer / (PICKUP_TIMER_MINUTES * 60)) * 100;
  }, [pickupTimer]);


  const startLocationTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for this feature');
        return;
      }


      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      setCurrentLocation({
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      });

      // Subscribe to location updates
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
          timeInterval: 5000,   // Or every 5 seconds
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          setCurrentLocation({ latitude, longitude });

        }
      );

      setLocationSubscription(subscription);
    } catch (err) {
      console.error('Error starting location tracking:', err);
      // Alert.alert('Location Error', 'Failed to track location. Please check your device settings.');
    }
  }, []);



  // Start pickup timer
  const startPickupTimer = useCallback(() => {
    if (timerActive) return;

    setPickupTimer(PICKUP_TIMER_MINUTES * 60); // Convert minutes to seconds
    setTimerActive(true);

    const interval = setInterval(() => {
      setPickupTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          Alert.alert('Timer Expired', 'The free pickup time has expired.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimerInterval(interval);

    // Animate timer
    Animated.timing(timerAnimation, {
      toValue: 100,
      duration: PICKUP_TIMER_MINUTES * 60 * 1000,
      useNativeDriver: false
    }).start();

  }, [timerActive, timerAnimation]);

  // Stop pickup timer
  const stopPickupTimer = useCallback(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setTimerActive(false);
    Animated.timing(timerAnimation).stop();
  }, [timerInterval, timerAnimation]);

  // Log errors with context
  const logError = useCallback((message, extra) => {
    console.error(`[DeliveryTracking] ${message}`, extra);
  }, []);

  // Fetch parcel details
  const handleFetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching parcel details...");
      const { data } = await axios.get(`http://192.168.1.6:3100/api/v1/parcel/get-parcel/${parcelId}`);
      // console.log("Fetched parcel details:", data?.parcelDetails);
      setParcelDetails(data?.parcelDetails);

      // Check if we need to start or stop the timer based on status
      if (data?.parcelDetails?.status === 'Reached at Pickup Location' && !timerActive) {
        startPickupTimer();
      } else if (data?.parcelDetails?.status === 'in_transit' && timerActive) {
        stopPickupTimer();
      }
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || "Unknown error";
      logError("Failed to fetch parcel details", err);
      setError(errMsg);


    } finally {
      setLoading(false);
    }
  }, [parcelId, timerActive, startPickupTimer, stopPickupTimer]);

  // Change parcel status
  const handleChangeStatus = useCallback(async (status) => {
    try {
      setLoadingAction(true);
      await axios.post('http://192.168.1.6:3100/api/v1/parcel/parcel-status-update', {
        parcelId,
        status,
      });

      // Handle status-specific actions
      if (status === 'Reached at Pickup Location') {
        startPickupTimer();
        Vibration.vibrate(500);
        setOtpModalVisible(true);
      } else if (status === 'Reached at drop Location') {
        Vibration.vibrate(500);
        setOtpModalVisible(true);
      } else if (status === 'in_transit') {
        stopPickupTimer();
      }

      await handleFetchDetails();
    } catch (err) {
      logError("Failed to update status", err);
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } finally {
      setLoadingAction(false);
    }
  }, [parcelId, handleFetchDetails, startPickupTimer, stopPickupTimer]);

  // Verify OTP
  const verifyOtp = useCallback(() => {
    if (!enteredOtp) {
      setOtpError('Please enter OTP');
      return;
    }

    if (enteredOtp === parcelDetails?.otp?.toString()) {
      setOtpError('');
      setOtpModalVisible(false);
      setEnteredOtp('');

      // Determine next status based on current status
      const nextStatus = parcelDetails?.status === 'Reached at Pickup Location'
        ? 'in_transit'
        : 'delivered';

      handleChangeStatus(nextStatus);

      // Vibrate on success
      Vibration.vibrate([100, 200, 100]);
    } else {
      setOtpError('Invalid OTP. Please try again.');
      Vibration.vibrate(1000); // Longer vibration for error
    }
  }, [enteredOtp, parcelDetails, handleChangeStatus]);

  // Cancel ride
  const handleCancelRide = useCallback(() => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingAction(true);
              await axios.post('http://192.168.1.6:3100/api/v1/parcel/parcel-status-update', {
                parcelId,
                status: 'cancelled',
              });
              stopPickupTimer();
              Alert.alert('Success', 'Ride cancelled successfully');
              navigation.goBack();
            } catch (err) {
              logError("Failed to cancel ride", err.response.data);
              Alert.alert('Error', 'Failed to cancel ride');
            } finally {
              setLoadingAction(false);
            }
          }
        }
      ]
    );
  }, [parcelId, navigation, stopPickupTimer]);

  // Call customer
  const callCustomer = useCallback(() => {
    const phoneNumber = parcelDetails?.customerId?.number || parcelDetails?.phone;
    if (!phoneNumber) {
      Alert.alert('Error', 'Customer phone number not available');
      return;
    }

    Linking.openURL(`tel:01141236767`);
  }, [parcelDetails]);

  // Call support
  const callSupport = useCallback(() => {
    Linking.openURL('tel:01141236789'); // Replace with actual support number
  }, []);

  // Initialize component
  useEffect(() => {
    handleFetchDetails();
    startLocationTracking();

    // Listen for real-time updates from socket
    if (socket) {
      socket.on('parcel_status_update', (data) => {
        if (data.parcelId === parcelId) {
          handleFetchDetails();
        }
      });
    }

    return () => {
      // Cleanup
      if (socket) {
        socket.off('parcel_status_update');
      }
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [handleFetchDetails, startLocationTracking, parcelId, socket]);

  // Memoized locations
  const pickupLocation = useMemo(() => {
    if (!parcelDetails?.locations?.pickup?.location?.coordinates) return null;
    return {
      latitude: parcelDetails.locations.pickup.location.coordinates[1] || 0,
      longitude: parcelDetails.locations.pickup.location.coordinates[0] || 0,
    };
  }, [parcelDetails]);

  const dropoffLocation = useMemo(() => {
    if (!parcelDetails?.locations?.dropoff?.location?.coordinates) return null;
    return {
      latitude: parcelDetails.locations.dropoff.location.coordinates[1] || 0,
      longitude: parcelDetails.locations.dropoff.location.coordinates[0] || 0,
    };
  }, [parcelDetails]);

  // Current destination based on status
  const currentDestination = useMemo(() => {
    const status = parcelDetails?.status;
    if (!status || !pickupLocation || !dropoffLocation) return null;

    if (status === 'accepted' || status === 'Reached at Pickup Location') {
      return pickupLocation;
    } else {
      return dropoffLocation;
    }
  }, [parcelDetails, pickupLocation, dropoffLocation]);

  // Fit map to show all markers
  const fitToMarkers = useCallback(() => {
    if (mapRef.current && pickupLocation && dropoffLocation) {
      const points = [pickupLocation, dropoffLocation];
      if (currentLocation) points.push(currentLocation);

      mapRef.current.fitToCoordinates(
        points,
        {
          edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
          animated: true,
        }
      );
    }
  }, [pickupLocation, dropoffLocation, currentLocation]);

  // Open location in Google Maps
  const openGoogleMaps = useCallback((location, label) => {
    if (!location) return;

    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&destination_place_id=${label}`;
    Linking.openURL(url).catch(err => {
      Alert.alert('Error', 'Could not open Google Maps');
    });
  }, []);

  // Get color based on status
  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'accepted': return '#FF3B30'; // Bright red
      case 'Reached at Pickup Location': return '#FFCC00'; // Bright yellow
      case 'in_transit': return '#34C759'; // Bright green
      case 'Reached at drop Location': return '#FF9500'; // Orange
      case 'delivered': return '#34C759'; // Bright green
      case 'cancelled': return '#FF3B30'; // Bright red
      default: return '#8E8E93'; // Gray
    }
  }, []);

  // Render status-specific buttons
  const renderStatusButtons = useCallback(() => {
    const status = parcelDetails?.status;

    switch (status) {
      case 'accepted':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#FF3B30' }]}
            onPress={() => handleChangeStatus('Reached at Pickup Location')}
            disabled={loadingAction}
          >
            {loadingAction ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="location-on" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>I've Reached Pickup Location</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'Reached at Pickup Location':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#FFCC00' }]}
            onPress={() => setOtpModalVisible(true)}
            disabled={loadingAction}
          >
            {loadingAction ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="dialpad" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Enter OTP & Pickup Parcel</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'in_transit':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#34C759' }]}
            onPress={() => handleChangeStatus('Reached at drop Location')}
            disabled={loadingAction}
          >
            {loadingAction ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="location-on" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>I've Reached Drop Location</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'Reached at drop Location':
        return (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#FF9500' }]}
            onPress={() => setOtpModalVisible(true)}
            disabled={loadingAction}
          >
            {loadingAction ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="dialpad" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Enter OTP & Complete Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        );

      case 'delivered':
        return (
          <View style={styles.deliveredContainer}>
            <FontAwesome5 name="check-circle" size={24} color="#34C759" />
            <Text style={styles.deliveredText}>Delivery Completed</Text>
          </View>
        );

      case 'cancelled':
        return (
          <View style={styles.cancelledContainer}>
            <MaterialIcons name="cancel" size={24} color="#FF3B30" />
            <Text style={styles.cancelledText}>Delivery Cancelled</Text>
          </View>
        );

      default:
        return null;
    }
  }, [parcelDetails, handleChangeStatus, loadingAction]);

  // Loading screen
  if (loading && !parcelDetails) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={styles.loadingText}>Loading delivery details...</Text>
          <View style={styles.loadingBar}>
            <Animated.View
              style={[
                styles.loadingBarFill,
                { width: `${Math.min(retryCount * 30, 90)}%` }
              ]}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error screen
  if (error && !parcelDetails) {
    return (
      <SafeAreaView style={styles.centered}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="#FF3B30" />
          <Text style={styles.errorText}>{error || 'No Parcel Details Found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleFetchDetails}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Map View */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={
          currentDestination ? {
            ...currentDestination,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          } : null
        }
        onMapReady={fitToMarkers}
        showsUserLocation={true}
        followsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title="Pickup Location"
            pinColor="#FF3B30"
          >
            <View style={styles.markerContainer}>
              <MaterialIcons name="location-on" size={36} color="#FF3B30" />
              <View style={styles.markerLabel}>
                <Text style={styles.markerText}>Pickup</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {dropoffLocation && (
          <Marker
            coordinate={dropoffLocation}
            title="Dropoff Location"
            pinColor="#34C759"
          >
            <View style={styles.markerContainer}>
              <MaterialIcons name="location-on" size={36} color="#34C759" />
              <View style={styles.markerLabel}>
                <Text style={styles.markerText}>Dropoff</Text>
              </View>
            </View>
          </Marker>
        )}

        {/* Driver Location Marker */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Your Location"
          >
            <View style={styles.driverMarker}>
              <MaterialCommunityIcons name="truck-delivery" size={24} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Directions */}
        {currentLocation && currentDestination && (
          <MapViewDirections
            origin={currentLocation}
            destination={currentDestination}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={5}
            strokeColor="#FF3B30"
            lineDashPattern={[0]}
            onReady={result => {
              console.log(`Distance: ${result.distance} km`);
              console.log(`Duration: ${result.duration} min`);
            }}
          />
        )}
      </MapView>

      {/* Header with Menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={styles.headerText}>
            {parcelDetails?.ride_id || 'Delivery'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(parcelDetails?.status) }]}>
            <Text style={styles.statusText}>{parcelDetails?.status || 'Unknown'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(!menuVisible)}
        >
          <Entypo name="dots-three-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Menu Dropdown */}
      {menuVisible && (
        <View style={styles.menuDropdown}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={callCustomer}
          >
            <Ionicons name="call" size={20} color="#FF3B30" />
            <Text style={styles.menuItemText}>Call Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={callSupport}
          >
            <MaterialIcons name="support-agent" size={20} color="#007AFF" />
            <Text style={styles.menuItemText}>Call Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleCancelRide}
          >
            <MaterialIcons name="cancel" size={20} color="#FF3B30" />
            <Text style={styles.menuItemText}>Cancel Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.mapButton}
          onPress={fitToMarkers}
        >
          <MaterialIcons name="fullscreen" size={24} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mapButton}
          onPress={() => openGoogleMaps(currentDestination,
            parcelDetails?.status === 'in_transit' ? "Dropoff" : "Pickup"
          )}
        >
          <MaterialIcons name="directions" size={24} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mapButton}
          onPress={callCustomer}
        >
          <Ionicons name="call" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Pickup Timer (only show when active) */}
      {/* {timerActive && (
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Free Pickup Time:</Text>
          <Text style={styles.timerText}>{formattedTimer}</Text>
          <View style={styles.timerBar}>
            <Animated.View 
              style={[
                styles.timerBarFill, 
                { 
                  width: `${100 - timerPercentage}%`,
                  backgroundColor: timerPercentage < 20 ? '#FF3B30' : 
                                  timerPercentage < 50 ? '#FFCC00' : '#34C759'
                }
              ]} 
            />
          </View>
        </View>
      )} */}

      {/* Details Panel */}
      <View style={styles.detailsContainer}>
        {loading && parcelDetails && (
          <View style={styles.refreshIndicator}>
            <ActivityIndicator size="small" color="#FF3B30" />
          </View>
        )}

        <ScrollView style={styles.detailsScroll}>
          {/* Customer Details */}
          <View style={styles.detailsSection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={20} color="#FF3B30" />
              <Text style={styles.sectionTitle}>Customer Details</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Name:</Text>
                <Text style={styles.value}>{parcelDetails?.customerId?.name || parcelDetails?.name || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Phone:</Text>
                <Text style={styles.value}>{parcelDetails?.customerId?.number || parcelDetails?.phone || 'N/A'}</Text>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={callCustomer}
                >
                  <Ionicons name="call" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Parcel Details */}
          <View style={styles.detailsSection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="inventory-2" size={20} color="#FF3B30" />
              <Text style={styles.sectionTitle}>Parcel Details</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Ride ID:</Text>
                <Text style={styles.value}>{parcelDetails?.ride_id || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Distance:</Text>
                <Text style={styles.value}>{parcelDetails?.km_of_ride?.toFixed(2) || 'N/A'} km</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Amount:</Text>
                <Text style={styles.valueHighlight}>₹{parcelDetails?.fares?.payableAmount || 'N/A'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Payment:</Text>
                <Text style={styles.value}>{parcelDetails?.money_collected_mode || 'Cash'}</Text>
              </View>

            </View>
          </View>

          {/* Location Details */}
          <View style={styles.detailsSection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="location-on" size={20} color="#FF3B30" />
              <Text style={styles.sectionTitle}>Location Details</Text>
            </View>

            <View style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <View style={[styles.locationDot, { backgroundColor: '#FF3B30' }]} />
                <Text style={styles.locationTitle}>Pickup Location</Text>
                <TouchableOpacity
                  style={styles.directionButton}
                  onPress={() => openGoogleMaps(pickupLocation, "Pickup")}
                >
                  <MaterialIcons name="directions" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.locationAddress}>{parcelDetails?.locations?.pickup?.address || 'N/A'}</Text>
            </View>

            <View style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <View style={[styles.locationDot, { backgroundColor: '#34C759' }]} />
                <Text style={styles.locationTitle}>Drop Location</Text>
                <TouchableOpacity
                  style={styles.directionButton}
                  onPress={() => openGoogleMaps(dropoffLocation, "Dropoff")}
                >
                  <MaterialIcons name="directions" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.locationAddress}>{parcelDetails?.locations?.dropoff?.address || 'N/A'}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {renderStatusButtons()}
        </View>
      </View>

      {/* OTP Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={otpModalVisible}
        onRequestClose={() => setOtpModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {parcelDetails?.status === 'Reached at Pickup Location'
                  ? 'Pickup Verification'
                  : 'Delivery Verification'}
              </Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setOtpModalVisible(false);
                  setEnteredOtp('');
                  setOtpError('');
                }}
              >
                <Ionicons name="close" size={24} color="#FF3B30" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {parcelDetails?.status === 'Reached at Pickup Location'
                ? 'Ask customer for the OTP to pickup the parcel'
                : 'Ask customer for the OTP to complete delivery'}
            </Text>

            <View style={styles.otpContainer}>
              <TextInput
                style={styles.otpInput}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                maxLength={4}
                value={enteredOtp}
                onChangeText={setEnteredOtp}
              />

              {loadingAction ? (
                <ActivityIndicator size="small" color="#FF3B30" style={styles.otpLoader} />
              ) : (
                <TouchableOpacity
                  style={styles.otpButton}
                  onPress={verifyOtp}
                  disabled={enteredOtp.length !== 4}
                >
                  <MaterialIcons name="check" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}

            <View style={styles.otpHint}>
              <MaterialIcons name="info-outline" size={16} color="#666" />
              <Text style={styles.otpHintText}>
                OTP is a 4-digit code sent to the customer
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
    marginBottom: 16,
  },
  loadingBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDropdown: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  mapControls: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  mapButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  timerContainer: {
    position: 'absolute',
    top: 140,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  timerLabel: {
    fontSize: 12,
    color: '#666',
  },
  timerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  timerBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  timerBarFill: {
    height: '100%',
  },
  detailsContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.5,
    minHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  refreshIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
  },
  detailsScroll: {
    maxHeight: height * 0.35,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  detailCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 70,
  },
  value: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  valueHighlight: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
  },
  otpValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF3B30',
    letterSpacing: 2,
  },
  callButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  locationAddress: {
    fontSize: 13,
    color: '#555',
    marginLeft: 20,
  },
  directionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  retryButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: -5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  markerText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  otpInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    marginRight: 8,
    textAlign: 'center',
  },
  otpButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpLoader: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpError: {
    color: '#FF3B30',
    marginBottom: 16,
    fontSize: 14,
  },
  otpHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
  },
  otpHintText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  deliveredContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  deliveredText: {
    color: '#34C759',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  cancelledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  cancelledText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});