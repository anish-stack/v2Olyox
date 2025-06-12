import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clock, CreditCard } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function RideEndModal({ open, close, handleRideEnd, handlePaymentEndRide,data }) {
  const scaleAnim = React.useRef(new Animated.Value(0)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(async () => {
        await handlePaymentEndRide();
        close();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [open]);

  const { rideDuration } = calculateRideDetails(data);

  return (
    <Modal visible={open} transparent animationType="none">
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        <Animated.View 
          style={[
            styles.modalBox,
            {
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['#00aa9b', '#007d73']}
            style={styles.header}
          >
            <View style={styles.checkCircle}>
              <Check color="#007d73" size={32} />
            </View>
          </LinearGradient>

          <View style={styles.content}>
            <Text style={styles.title}>Ride Complete!</Text>
            <Text style={styles.subtitle}>Thank you for riding with us</Text>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Clock size={20} color="#666" />
                <Text style={styles.detailText}>Duration: {rideDuration}</Text>
              </View>

              <View style={styles.detailRow}>
                <CreditCard size={20} color="#666" />
                <Text style={styles.detailText}>
                  Fare: ₹{data?.kmOfRide || 0}
                </Text>
              </View>
            </View>

            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>Rate your experience</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Text key={star} style={styles.star}>★</Text>
                ))}
              </View>
            </View>

            <View style={styles.processingContainer}>
              <View style={styles.processingDot} />
              <Text style={styles.processingText}>Processing payment...</Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const calculateRideDetails = (data) => {
  const createdAt = data?.createdAt ? new Date(data.createdAt) : new Date();
  const now = new Date();

  const durationMs = now - createdAt;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  const rideDuration = `${minutes}m ${seconds}s`;
  const rideStartTime = createdAt.toLocaleString();
  const currentTimeFormatted = now.toLocaleString();

  return {
    rideDuration,
    rideStartTime,
    currentTimeFormatted,
  };
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: width * 0.85,
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailsContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#444',
    marginLeft: 12,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  star: {
    fontSize: 32,
    color: '#ffd700',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  processingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00aa9b',
    opacity: 0.8,
  },
  processingText: {
    fontSize: 14,
    color: '#666',
  },
});