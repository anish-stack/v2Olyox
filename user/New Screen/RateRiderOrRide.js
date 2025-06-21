import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import React, { useState, useRef, useEffect } from 'react';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import axios from 'axios';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'http://192.168.1.6:3100/api/v1/new/ride/rate-your-ride';

export default function RateRiderOrRide() {
  const route = useRoute();
  const navigation = useNavigation();
  const { rideId } = route.params || {};

  const [formData, setFormData] = useState({
    rating: 0,
    feedback: '',
  });
  const [loading, setLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const starAnimations = useRef([...Array(5)].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    // Initial animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animateStar = (index) => {
    Animated.sequence([
      Animated.timing(starAnimations[index], {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(starAnimations[index], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleRating = (value) => {
    setFormData((prev) => ({ ...prev, rating: value }));
    setShowFeedback(true);
    animateStar(value - 1);
  };

  const handleSubmit = async () => {
    if (formData.rating < 1) {
      Alert.alert('⭐ Rating Required', 'Please select a rating to continue.', [
        { text: 'OK', style: 'default' }
      ]);
      return;
    }

    try {
      setLoading(true);
      
      console.log('🚀 Submitting rating...');
      console.log('📊 Request Data:', {
        rideId,
        rating: formData.rating,
        feedback: formData.feedback,
        timestamp: new Date().toISOString(),
      });

      const response = await axios.post(`${API_BASE_URL}/${rideId}`, formData);
      
      console.log('✅ Rating submitted successfully!');
      console.log('📦 API Response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers,
      });
      
      setLoading(false);

      Alert.alert(
        '🎉 Thank You!', 
        'Your rating has been submitted successfully!', 
        [
          {
            text: 'Continue',
            style: 'default',
            onPress: () => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                })
              );
            },
          },
        ]
      );
    } catch (error) {
      setLoading(false);
      
      console.error('❌ Error submitting rating:');
      console.error('🔍 Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data,
        },
      });
      
      Alert.alert(
        '⚠️ Submission Failed', 
        'Unable to submit your rating. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: handleSubmit, style: 'default' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const getRatingText = (rating) => {
    const texts = {
      1: 'Poor',
      2: 'Fair', 
      3: 'Good',
      4: 'Very Good',
      5: 'Excellent'
    };
    return texts[rating] || '';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#B91C1C" />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>Rate Your Ride</Text>
          <Text style={styles.subText}>Ride ID: #{rideId}</Text>
        </View>

        {/* Rating Card */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>How was your experience?</Text>
          
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity
                key={num}
                onPress={() => handleRating(num)}
                style={styles.starButton}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: starAnimations[num - 1] }],
                  }}
                >
                  <FontAwesome
                    name={num <= formData.rating ? 'star' : 'star-o'}
                    size={36}
                    color={num <= formData.rating ? '#FFC107' : '#E5E7EB'}
                    style={styles.star}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>

          {formData.rating > 0 && (
            <Animated.View style={styles.ratingTextContainer}>
              <Text style={styles.ratingText}>
                {getRatingText(formData.rating)}
              </Text>
            </Animated.View>
          )}
        </View>

        {/* Feedback Section */}
        {showFeedback && (
          <Animated.View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>
              Tell us more (Optional)
            </Text>
            <TextInput
              placeholder="Share your experience to help us improve..."
              placeholderTextColor="#9CA3AF"
              value={formData.feedback}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, feedback: text }))}
              style={styles.input}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            formData.rating === 0 && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || formData.rating === 0}
          activeOpacity={0.8}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.loadingText}>Submitting...</Text>
            </View>
          ) : (
            <Text style={styles.submitText}>Submit Rating</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 20,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subText: {
    textAlign: 'center',
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '500',
  },
  ratingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  ratingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 25,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  starButton: {
    padding: 8,
  },
  star: {
    marginHorizontal: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ratingTextContainer: {
    marginTop: 10,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    textAlign: 'center',
  },
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 15,
  },
  input: {
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    padding: 15,
    minHeight: 100,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
});