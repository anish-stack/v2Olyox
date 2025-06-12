import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  AppState,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  TouchableOpacity,
  Text,
  Animated,
  SafeAreaView,
  StatusBar,
  ToastAndroid,
  Modal,
  ScrollView
} from 'react-native';
import { Audio } from 'expo-av';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSocket } from '../context/SocketContext';
import { useLocation } from '../context/LocationContext';
import axios from 'axios';
import { decode } from '@mapbox/polyline';
import LottieView from 'lottie-react-native';
import { useRideStatus } from '../context/CheckRideHaveOrNot.context';

const { width, height } = Dimensions.get('window');
const RIDE_REQUEST_TIMEOUT = 120000;

// Enhanced map style
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#f8f9fa" }]
  },
  {
    "elementType": "labels.icon",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#ffffff" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#f3f4f6" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#dbeafe" }]
  },
  {
    "featureType": "poi",
    "stylers": [{ "visibility": "off" }]
  }
];

// Enhanced toast utility
const showToast = (message, type = 'info') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert(
      type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info',
      message
    );
  }
};

// Enhanced Button Component
const Button = ({ onPress, title, variant = 'primary', loading = false, disabled = false, icon, style }) => {
  const buttonStyle = [
    styles.button,
    variant === 'primary' ? styles.primaryButton :
      variant === 'secondary' ? styles.secondaryButton : styles.dangerButton,
    disabled && styles.disabledButton,
    style
  ];

  const textStyle = [
    styles.buttonText,
    variant === 'primary' ? styles.primaryButtonText :
      variant === 'secondary' ? styles.secondaryButtonText : styles.dangerButtonText
  ];

  const iconColor = variant === 'primary' ? '#fff' :
    variant === 'secondary' ? '#6b7280' : '#ef4444';

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <View style={styles.buttonContent}>
          {icon && (
            <MaterialCommunityIcons
              name={icon}
              size={18}
              color={iconColor}
              style={styles.buttonIcon}
            />
          )}
          <Text style={textStyle}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Enhanced Circular Timer with progress ring
const CircularTimer = ({ timeLeft, total }) => {
  const progress = timeLeft / total;
  const animatedValue = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const size = 90;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <View style={styles.timerContainer}>
      <View style={[styles.timerCircle, { width: size, height: size }]}>
        {/* Background circle */}
        <View
          style={[
            styles.progressRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: '#f3f4f6',
            }
          ]}
        />
        {/* Progress circle */}
        <Animated.View
          style={[
            styles.progressRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: progress > 0.3 ? '#10b981' : progress > 0.1 ? '#f59e0b' : '#ef4444',
              borderTopColor: 'transparent',
              borderRightColor: 'transparent',
              transform: [{
                rotate: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg']
                })
              }]
            }
          ]}
        />
        <View style={styles.timerTextContainer}>
          <Text style={[
            styles.timerText,
            { color: progress > 0.3 ? '#10b981' : progress > 0.1 ? '#f59e0b' : '#ef4444' }
          ]}>
            {Math.ceil(timeLeft / 1000)}
          </Text>
          <Text style={styles.timerUnit}>sec</Text>
        </View>
      </View>
    </View>
  );
};

// Enhanced Status Indicator
const StatusIndicator = ({ online, connected }) => (
  <View style={styles.statusIndicator}>
    <View style={[
      styles.statusDot,
      { backgroundColor: online ? (connected ? '#10b981' : '#f59e0b') : '#ef4444' }
    ]} />
    <Text style={styles.statusText}>
      {online ? (connected ? 'Online & Ready' : 'Connecting...') : 'Offline'}
    </Text>
  </View>
);

// Enhanced Location Component
const LocationRow = ({ type, address, isLast = false }) => (
  <View style={styles.locationRow}>
    <View style={styles.locationIcon}>
      <View style={[
        styles.locationDot,
        type === 'pickup' ? styles.pickupDot : styles.dropDot
      ]} />
      {!isLast && <View style={styles.locationLine} />}
    </View>
    <View style={styles.locationContent}>
      <Text style={styles.locationLabel}>
        {type === 'pickup' ? 'PICKUP LOCATION' : 'DROP-OFF LOCATION'}
      </Text>
      <Text style={styles.locationText} numberOfLines={3}>
        {address}
      </Text>
    </View>
  </View>
);

// Enhanced Trip Stats Component
const TripStats = ({ distance, duration, price, currency, estimatedEarning }) => (
  <View style={styles.tripStatsContainer}>
    <View style={styles.tripStatsRow}>
      <View style={styles.statItem}>
        <MaterialCommunityIcons name="map-marker-distance" size={20} color="#6366f1" />
        <Text style={styles.statLabel}>Distance</Text>
        <Text style={styles.statValue}>{distance} km</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statItem}>
        <MaterialCommunityIcons name="clock-outline" size={20} color="#6366f1" />
        <Text style={styles.statLabel}>Duration</Text>
        <Text style={styles.statValue}>{duration} min</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statItem}>
        <MaterialCommunityIcons name="currency-inr" size={20} color="#6366f1" />
        <Text style={styles.statLabel}>Fare</Text>
        <Text style={styles.statValue}>₹{price}</Text>
      </View>
    </View>

    {/* {estimatedEarning && (
      <View style={styles.earningsContainer}>
        <MaterialCommunityIcons name="wallet" size={16} color="#10b981" />
        <Text style={styles.earningsText}>
          Estimated Earning: ₹{parseFloat(estimatedEarning).toFixed(0)}
        </Text>
      </View>
    )} */}
  </View>
);

// Enhanced Vehicle Info Component
const VehicleInfo = ({ rider }) => (
  <View style={styles.vehicleContainer}>
    <View style={styles.vehicleIcon}>
      <MaterialCommunityIcons name="car" size={24} color="#6366f1" />
    </View>
    <View style={styles.vehicleDetails}>
      <Text style={styles.vehicleName}>{rider.vehicleName}</Text>
      <Text style={styles.vehicleNumber}>{rider.vehicleNumber}</Text>
      <Text style={styles.vehicleType}>{rider.vehicleType}</Text>
    </View>
    {rider.tolls && (
      <View style={styles.tollBadge}>
        <MaterialCommunityIcons name="toll" size={14} color="#f59e0b" />
        <Text style={styles.tollText}>Toll: ₹{rider.tollPrice}</Text>
      </View>
    )}
  </View>
);

// Enhanced Ride Request Modal
const RideRequestModal = ({
  visible,
  rideData,
  timeLeft,
  onAccept,
  onDecline,
  confirmLoading,
  error
}) => {
  const slideAnim = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.6,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  if (!visible || !rideData) return null;

  const rider = rideData.riders?.[0];
  const user = rideData.user;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[styles.modalBackdrop, { opacity: backdropOpacity }]}
        />

        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* Header with Timer */}
            <View style={styles.modalHeader}>
              <CircularTimer timeLeft={timeLeft} total={RIDE_REQUEST_TIMEOUT} />
              <Text style={styles.modalTitle}>New Ride Request</Text>
              {/* <Text style={styles.modalSubtitle}>{rideData.message}</Text> */}
            </View>

            {/* Error Display */}
            {error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* User Info */}
            <View style={styles.userSection}>
              <View style={styles.userAvatar}>
                {user?.profileImage?.image ? (
                  <Image
                    source={{ uri: user.profileImage.image }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'G'}
                  </Text>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.name || 'Guest User'}</Text>
                {/* <Text style={styles.userPhone}>{user?.number || 'No phone'}</Text> */}
                {rider?.rating && (
                  <View style={styles.ratingContainer}>
                    <MaterialCommunityIcons name="star" size={14} color="#f59e0b" />
                    <Text style={styles.ratingText}>{rider.rating}</Text>
                    <Text style={styles.ratingLabel}>rating</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Vehicle Info */}
            {/* {rider && <VehicleInfo rider={rider} />} */}

            {/* Trip Details */}
            <View style={styles.tripSection}>
              {/* Locations */}
              <View style={styles.locationsContainer}>
                <LocationRow
                  type="pickup"
                  address={rideData.pickup_desc}
                />
                <LocationRow
                  type="drop"
                  address={rideData.drop_desc}
                  isLast
                />
              </View>

              {/* Trip Stats */}
              <TripStats
                distance={rideData.distance}
                duration={rideData.trafficDuration || rideData.duration}
                price={rideData.price}
                currency={rideData.currency}
                estimatedEarning={rideData.estimatedEarning}
              />
            </View>

            {/* Additional Info */}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Button
                title="Decline"
                variant="danger"
                onPress={onDecline}
                disabled={confirmLoading}
                icon="close-circle"
                style={styles.declineButton}
              />
              <Button
                title="Accept Ride"
                variant="primary"
                onPress={onAccept}
                loading={confirmLoading}
                disabled={confirmLoading}
                icon="check-circle"
                style={styles.acceptButton}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function RideRequestScreen() {
  // Refs
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const timeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Context
  const { driverLocation } = useLocation();
  const { socket, isSocketReady } = useSocket();
  const { onRide, updateRideStatus } = useRideStatus();

  // State
  const [rideData, setRideData] = useState(null);
  const [riderDetails, setRiderDetails] = useState(null);
  const [sound, setSound] = useState();
  const [timeLeft, setTimeLeft] = useState(RIDE_REQUEST_TIMEOUT);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [region, setRegion] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [showRideModal, setShowRideModal] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Pulse animation for waiting state
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    let intervalId = null;
    let isMounted = true;

    const getAndSendLocation = async (accuracy, timeout) => {
      try {
        const { coords } = await Location.getCurrentPositionAsync({ accuracy, timeout });
        await sendLocationToServer(coords.latitude, coords.longitude);
      } catch (err) {
        console.warn("Location fetch failed:", err.message);
        try {
          const fallback = await Location.getLastKnownPositionAsync();
          if (fallback) {
            await sendLocationToServer(fallback.coords.latitude, fallback.coords.longitude);
          } else {
            isMounted && setError('Unable to get current or last known location');
          }
        } catch (fallbackErr) {
          console.error("Fallback location failed:", fallbackErr);
        }
      }
    };

    const setupLocationTracking = async () => {
      if (!isSocketReady) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable location access.');
        return;
      }

      await getAndSendLocation(Location.Accuracy.High, 10000); // Initial fetch

      intervalId = setInterval(() => {
        getAndSendLocation(Location.Accuracy.Balanced, 5000); // Periodic updates
      }, 30000);
    };

    setupLocationTracking();

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSocketReady]);

  // Enhanced location sending with retry logic
  const sendLocationToServer = async (latitude, longitude, retryCount = 0) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const response = await fetch('https://appapi.olyox.com/webhook/cab-receive-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      setConnectionStatus('connected');
    } catch (error) {
      console.error('Location send error:', error);
      setConnectionStatus('error');

      // Retry logic
      if (retryCount < 3) {
        setTimeout(() => {
          sendLocationToServer(latitude, longitude, retryCount + 1);
        }, 2000 * (retryCount + 1));
      } else {
        setError('Failed to update location on server');
      }
    }
  };

  // Enhanced rider details fetching
  const getRiderDetails = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await axios.get(
        'https://appapi.olyox.com/api/v1/rider/user-details',
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );

      if (response?.data?.partner) {
        setRiderDetails(response.data.partner);
        setError(null);
      } else {
        throw new Error('Invalid rider data received');
      }
    } catch (error) {
      console.error("Rider details error:", error);
      if (error.code === 'ECONNABORTED') {
        setError('Connection timeout. Please check your internet.');
      } else if (error.response?.status === 401) {
        setError('Authentication expired. Please login again.');
      } else {
        setError('Failed to load rider details');
      }
    }
  }, []);

  useEffect(() => {
    getRiderDetails();
  }, []);

  // Enhanced sound management
  const playSound = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('./sound.mp3'),
        { shouldPlay: true, volume: 1.0, isLooping: false }
      );

      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      console.error("Sound error:", error);
      // Don't show error for sound issues as it's not critical
    }
  };

  const stopSound = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      } catch (error) {
        console.error("Stop sound error:", error);
      }
    }
  };

  // Enhanced route coordinates with error handling
  useEffect(() => {
    if (rideData?.polyline) {
      try {
        const coordinates = decode(rideData.polyline).map(([latitude, longitude]) => ({
          latitude,
          longitude
        }));
        setRouteCoordinates(coordinates);

        if (rideData.pickupLocation?.coordinates && rideData.dropLocation?.coordinates) {
          const pickup = rideData.pickupLocation.coordinates;
          const drop = rideData.dropLocation.coordinates;

          const newRegion = {
            latitude: (pickup[1] + drop[1]) / 2,
            longitude: (pickup[0] + drop[0]) / 2,
            latitudeDelta: Math.max(Math.abs(pickup[1] - drop[1]) * 2.5, 0.01),
            longitudeDelta: Math.max(Math.abs(pickup[0] - drop[0]) * 2.5, 0.01),
          };

          setRegion(newRegion);

          if (mapRef.current && mapReady) {
            setTimeout(() => {
              mapRef.current?.animateToRegion(newRegion, 1000);
            }, 500);
          }
        }
      } catch (error) {
        console.error("Polyline decode error:", error);
        setError('Failed to load route information');
      }
    }
  }, [rideData, mapReady]);

  const handleRideRequest = async (data) => {
    try {
      console.log("New ride request:", data);

      // Validate ride data
      const missingFields = [];
      if (!data) {
        throw new Error('No ride data received');
      }
      if ( !data?.requestId) missingFields.push('requestId');
      if (!data.pickup_desc) missingFields.push('pickup_desc');
      if (!data.drop_desc) missingFields.push('drop_desc');

      if (missingFields.length > 0) {
        throw new Error(`Invalid ride request data: missing field(s) → ${missingFields.join(', ')}`);
      }


      setRideData(data);
      setTimeLeft(RIDE_REQUEST_TIMEOUT);
      setShowRideModal(true);
      setError(null);

      await playSound();
      startTimeout();

      // Enhanced notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚗 New Ride Request",
          body: `₹${data.price} • ${data.distance}km • ${data.duration}min`,
          sound: 'default',
          data: { rideId: data.requestId }
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Handle ride request error:", error);
      setError('Failed to process ride request');
    }
  };
  // Enhanced socket events with better error handling
  useEffect(() => {


    const handleRideCancellation = (data) => {
      try {
        if (rideData && data.ride_request_id === rideData.requestId) {
          cleanupRideRequest();
          showToast("Ride was accepted by another driver", "info");
        }
      } catch (error) {
        console.error("Handle cancellation error:", error);
      }
    };

    const handleSocketError = (error) => {
      console.error("Socket error:", error);
      setConnectionStatus('error');
      setError('Connection lost. Reconnecting...');
    };

    const handleConnect = () => {
      setConnectionStatus('connected');
      setError(null);
      if (riderDetails?.id) {
        socket.emit('driver_connected', { driverId: riderDetails.id });
      }
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
      setError('Disconnected from server');
    };

    if (isSocketReady && socket) {
      socket.on("ride_come", handleRideRequest);
      socket.on("ride_cancelled", handleRideCancellation);
      socket.on("error", handleSocketError);
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);

      if (riderDetails?.id) {
        socket.emit('driver_connected', { driverId: riderDetails.id });
      }
    }

    return () => {
      if (socket) {
        socket.off("ride_come");
        socket.off("ride_cancelled");
        socket.off("error");
        socket.off("connect");
        socket.off("disconnect");
      }
    };

  }, [isSocketReady, socket, riderDetails, rideData]);

  useEffect(() => {
    if (!riderDetails?._id) return;

    const pollForRides = async () => {
      console.log('🔄 Polling started');

      try {
        const response = await fetch('https://appapi.olyox.com/api/v1/rides/driver/poll-rides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ driver_id: riderDetails._id }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Request failed: ${response.status} - ${text}`);
        }

        const result = await response.json();

        console.log('📦 Full Ride Data:', JSON.stringify(result, null, 2));

        if (result.success && result.rides?.length > 0) {
          console.log(`🚗 Found ${result.rides.length} new ride(s):`);
          result.rides.forEach((ride, idx) => {
            console.log(`\n🚕 Ride ${idx + 1}:`);
            console.log('🆔 ID:', ride.rideRequestId);
            console.log('📍 Pickup:', ride.pickup_desc);
            console.log('📍 Drop:', ride.drop_desc);
            console.log('🚗 Vehicle:', ride.vehicleType);
            console.log('💰 Price:', ride.price);
            console.log('🔁 Retry Count:', ride.retryCount);
            console.log('🕓 Created At:', ride.createdAt);
            handleRideRequest(ride)
          });
        } else {
          console.log('✅ Polling successful, no new rides.');
        }
      } catch (error) {
        console.error('❌ Polling error:', error.message);
      } finally {
        console.log('✅ Polling ended\n');
      }
    };

    // Start polling every 5 seconds
    const interval = setInterval(pollForRides, 5000);
    pollForRides();

    return () => clearInterval(interval); // Cleanup
  }, [riderDetails]);


  // Timer management
  const startTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    timeoutRef.current = setTimeout(() => {
      handleRejectRide(true);
    }, RIDE_REQUEST_TIMEOUT);

    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  };

  // Enhanced cleanup
  const cleanupRideRequest = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    stopSound();
    setShowRideModal(false);
    setRideData(null);
    setTimeLeft(RIDE_REQUEST_TIMEOUT);
    setConfirmLoading(false);
    setError(null);
  };

  // Enhanced reject handling
  const handleRejectRide = async (isTimeout = false) => {
    try {
      setConfirmLoading(true);

      if (socket && rideData && riderDetails) {
        socket.emit('ride_rejected', {
          ride_id: rideData.requestId,
          driver_id: riderDetails._id,
          reason: isTimeout ? 'timeout' : 'manual'
        });

        showToast(
          isTimeout ? "Request timed out" : "Ride declined",
          "info"
        );
      } else {
        throw new Error('Missing required data for rejection');
      }
    } catch (error) {
      console.error('Reject error:', error);
      showToast("Failed to decline ride", "error");
      setError('Failed to decline ride. Please try again.');
    } finally {
      setConfirmLoading(false);
      cleanupRideRequest();
    }
  };

  // Enhanced accept handling
  const handleAcceptRide = async () => {
    try {
      setConfirmLoading(true);
      setError(null);

      if (!socket || !rideData || !riderDetails) {
        throw new Error('Missing required data for acceptance');
      }

      const matchedRider = rideData.riders?.find(
        (rider) => rider.name === riderDetails.name
      );

      if (!matchedRider) {
        throw new Error('Could not match rider details');
      }

      const acceptanceData = {
        data: {
          rider_id: matchedRider.id,
          ride_request_id: matchedRider.rideRequestId,
          user_id: rideData.user?._id,
          rider_name: matchedRider.name,
          vehicleName: matchedRider.vehicleName,
          vehicleNumber: matchedRider.vehicleNumber,
          vehicleType: matchedRider.vehicleType,
          price: matchedRider.price,
          eta: matchedRider.eta,
          estimatedEarning: rideData.estimatedEarning
        }
      };

      socket.emit('ride_accepted', acceptanceData);

      showToast("Ride accepted successfully!", "success");
      updateRideStatus(true);

    } catch (error) {
      console.error('Accept error:', error);
      showToast("Failed to accept ride", "error");
      setError(error.message || 'Failed to accept ride. Please try again.');
      updateRideStatus(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  // Handle rider confirmation
  useEffect(() => {
    if (socket) {
      socket.on('rider_confirm_message', (data) => {
        try {
          const { rideDetails } = data || {};
          const driver = rideDetails?.driver;
          const temp_ride_id = rideDetails?.temp_ride_id || driver?.on_ride_id;

          if (driver && rideDetails) {
            updateRideStatus(true);
            cleanupRideRequest();

            navigation.dispatch(
              CommonActions.navigate({
                name: 'start',
                params: {
                  screen: 'ride_details',
                  params: { rideDetails, driver, temp_ride_id },
                },
              })
            );
          } else {
            throw new Error('Invalid confirmation data received');
          }
        } catch (err) {
          console.error("Confirmation error:", err);
          setError('Failed to process ride confirmation');
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('rider_confirm_message');
      }
    };
  }, [socket, navigation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRideRequest();
    };
  }, []);

  // Waiting screen when no ride request
  if (!showRideModal) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <View style={styles.waitingContainer}>
          {/* Header */}
          {/* <View style={styles.waitingHeader}>
            <Text style={styles.waitingTitle}>Looking for rides</Text>
            <Text style={styles.waitingSubtitle}>
              You'll be notified when a new request comes in
            </Text>
          </View> */}

          {/* Animation */}
          <View style={styles.animationContainer}>
            <Animated.View style={{
              transform: [{
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1]
                })
              }]
            }}>
              <LottieView
                source={require("./car.json")}
                autoPlay
                loop
                style={styles.waitingAnimation}
              />
            </Animated.View>
          </View>

          {/* Status */}
          <View style={styles.statusContainer}>
            <StatusIndicator
              online={true}
              connected={isSocketReady && connectionStatus === 'connected'}
            />
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Tips */}
          {/* <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>Tips while waiting</Text>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="battery" size={16} color="#10b981" />
                <Text style={styles.tipText}>Keep your phone charged</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="volume-high" size={16} color="#10b981" />
                <Text style={styles.tipText}>Turn up your volume</Text>
              </View>
              <View style={styles.tipItem}>
                <MaterialCommunityIcons name="signal" size={16} color="#10b981" />
                <Text style={styles.tipText}>Stay in good network areas</Text>
              </View>
            </View>
          </View> */}
        </View>
      </SafeAreaView>
    );
  }

  // Main screen with map and ride request modal
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={region || {
            latitude: driverLocation?.latitude || 28.7041,
            longitude: driverLocation?.longitude || 77.1025,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          customMapStyle={mapStyle}
          onMapReady={() => setMapReady(true)}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
        >
          {/* Route */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={4}
              strokeColor="#6366f1"
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Pickup Marker */}
          {rideData?.pickupLocation?.coordinates && (
            <Marker
              coordinate={{
                latitude: rideData.pickupLocation.coordinates[1],
                longitude: rideData.pickupLocation.coordinates[0],
              }}
              title="Pickup Location"
              description={rideData.pickup_desc}
            >
              <View style={styles.markerContainer}>
                <View style={styles.pickupMarker}>
                  <MaterialCommunityIcons name="map-marker" size={24} color="#fff" />
                </View>
              </View>
            </Marker>
          )}

          {/* Drop Marker */}
          {rideData?.dropLocation?.coordinates && (
            <Marker
              coordinate={{
                latitude: rideData.dropLocation.coordinates[1],
                longitude: rideData.dropLocation.coordinates[0],
              }}
              title="Drop-off Location"
              description={rideData.drop_desc}
            >
              <View style={styles.markerContainer}>
                <View style={styles.dropMarker}>
                  <MaterialCommunityIcons name="map-marker" size={24} color="#fff" />
                </View>
              </View>
            </Marker>
          )}
        </MapView>
      </View>

      {/* Ride Request Modal */}
      <RideRequestModal
        visible={showRideModal}
        rideData={rideData}
        timeLeft={timeLeft}
        onAccept={handleAcceptRide}
        onDecline={() => handleRejectRide()}
        confirmLoading={confirmLoading}
        error={error}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Waiting Screen
  waitingContainer: {
    flex: 1,
    // height: '100%',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingHeader: {
    alignItems: 'center',
    // marginBottom: 48,
  },
  waitingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  animationContainer: {
    // marginBottom: 48,
  },
  waitingAnimation: {
    width: 120,
    height: 120,
  },
  statusContainer: {
    marginBottom: 24,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  tipsContainer: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 16,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#166534',
    marginLeft: 12,
    flex: 1,
  },

  // Error Container
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
  },

  // Map
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarker: {
    backgroundColor: '#10b981',
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropMarker: {
    backgroundColor: '#ef4444',
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  // Modal
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 8,
    maxHeight: height * 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
  },
  timerCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressRing: {
    position: 'absolute',
  },
  timerTextContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 26,
    fontWeight: '700',
  },
  timerUnit: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: -2,
  },

  // User Section
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6b7280',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 2,
  },

  // Vehicle Section
  vehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  vehicleIcon: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 8,
    marginRight: 12,
  },
  vehicleDetails: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  vehicleNumber: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  vehicleType: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  tollBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tollText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Trip Section
  tripSection: {
    marginBottom: 20,
  },
  locationsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  locationIcon: {
    width: 20,
    alignItems: 'center',
    marginRight: 16,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pickupDot: {
    backgroundColor: '#10b981',
  },
  dropDot: {
    backgroundColor: '#ef4444',
  },
  locationLine: {
    width: 2,
    height: 32,
    backgroundColor: '#d1d5db',
    marginTop: 6,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },

  // Trip Stats
  tripStatsContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tripStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#d1d5db',
  },
  earningsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  earningsText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginLeft: 6,
  },

  // Additional Info
  additionalInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  dangerButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#6b7280',
  },
  dangerButtonText: {
    color: '#ef4444',
  },
  declineButton: {
    flex: 0.35,
  },
  acceptButton: {
    flex: 0.65,
  },
});