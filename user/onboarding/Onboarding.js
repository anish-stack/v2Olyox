// OnboardingScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  SafeAreaView,
  StyleSheet,
  Platform,
  Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Font from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';


import { slidesFetch } from './onboarding-slides';
import { initializeSocket } from '../services/socketService';
import { tokenCache } from '../Auth/cache';
import { createUserRegister, verify_otp } from '../utils/helpers';
import PhoneAuthModal from './comp/PhoneAuthModal';
import OtpVerificationModal from './comp/OtpVerificationModal';
import LoadingOverlay from './comp/LoadingOverlay';
import { useGuest } from '../context/GuestLoginContext';



const { width, height } = Dimensions.get('window');


export default function OnboardingScreen() {
  const navigation = useNavigation();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const {handleGuestLogout} = useGuest()

  const [currentIndex, setCurrentIndex] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Auth state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load fonts
  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          'Poppins-Regular': require('./Roboto-VariableFont_wdth,wght.ttf')
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        // Continue without custom fonts if they fail to load
        setFontsLoaded(true);
      }
    };

    loadFonts();
  }, []);

  // Fetch onboarding slides
  useEffect(() => {
    const fetchOnboardingSlides = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await slidesFetch();

        if (data && Array.isArray(data)) {
          setSlides(data);
        } else {
          // Fallback slides if API fails
          setSlides([
            {
              _id: '1',
              title: 'Welcome to RideNow',
              description: 'Your premium ride-sharing experience starts here',
              imageUrl: { image: 'https://cdn-icons-png.flaticon.com/512/4715/4715329.png' }
            },
            {
              _id: '2',
              title: 'Book Your Ride',
              description: 'Fast, reliable and comfortable rides at your fingertips',
              imageUrl: { image: 'https://cdn-icons-png.flaticon.com/512/2087/2087708.png' }
            },
            {
              _id: '3',
              title: 'Track in Real-time',
              description: 'Know exactly where your ride is and when it will arrive',
              imageUrl: { image: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }
            }
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch slides:', error);
        setError('Failed to load onboarding content. Please try again.');
        // Set fallback slides
        setSlides([
          {
            _id: '1',
            title: 'Welcome to RideNow',
            description: 'Your premium ride-sharing experience starts here',
            imageUrl: { image: 'https://cdn-icons-png.flaticon.com/512/4715/4715329.png' }
          },
          {
            _id: '2',
            title: 'Book Your Ride',
            description: 'Fast, reliable and comfortable rides at your fingertips',
            imageUrl: { image: 'https://cdn-icons-png.flaticon.com/512/2087/2087708.png' }
          },
          {
            _id: '3',
            title: 'Track in Real-time',
            description: 'Know exactly where your ride is and when it will arrive',
            imageUrl: { image: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchOnboardingSlides();
  }, []);

  // Handle phone number submission
  const handlePhoneSubmit = async () => {
    // Validate phone number
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber.trim())) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid 10-digit phone number.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = { number: phoneNumber };
      const response = await createUserRegister(formData);

      if (response.status === 201 || response.status === 200) {
        setShowPhoneModal(false);
        setShowOtpModal(true);
      } else {
        Alert.alert(
          'Registration Failed',
          response?.data?.message || 'Something went wrong. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message ||
        'Unable to send OTP at this time. Please try again later.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP verification
  const handleOtpVerify = async () => {
    // Validate OTP
    if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
      Alert.alert(
        "Invalid OTP",
        "Please enter the 6-digit OTP sent to your phone.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = { number: phoneNumber, otp };
      const response = await verify_otp(formData);

      if (response.status === 200 && response.token) {
        // Save authentication token
        try {
          await tokenCache.saveToken('auth_token_db', response.token);

          // Initialize socket if needed
          if (response.User && response.User._id) {
            await initializeSocket({
              userType: "user",
              userId: response.User._id
            });
          }
          handleGuestLogout()
          // Show success message and navigate
          Alert.alert(
            'Success!',
            'You have successfully logged in.',
            [{
              text: 'Continue',
              onPress: () => {
                setShowOtpModal(false);
                setOtp('');
                // Reset navigation stack to prevent going back to onboarding
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }]
                });
              }
            }]
          );
        } catch (storageError) {
          console.error("Error saving authentication:", storageError);
          Alert.alert(
            'Authentication Error',
            'Failed to save your login information. Please try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Verification Failed',
          response?.message || 'Invalid OTP. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.message ||
        'Verification failed. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle slide change
  const handleSlideChange = (event) => {
    const slideIndex = Math.floor(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(slideIndex);
  };

  // Go to next slide
  const goToNextSlide = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true
      });
    } else {
      // On last slide, show auth modal
      setShowPhoneModal(true);
    }
  };

  // Skip to last slide
  const skipToEnd = () => {
    flatListRef.current?.scrollToIndex({
      index: slides.length - 1,
      animated: true
    });
    setShowPhoneModal(true)
  };

  // Render individual slide
  const renderSlide = ({ item, index }) => {
    return (
      <View key={index} style={styles.slideContainer}>
        <View

          style={styles.imageContainer}
        >
          <Image
            source={{ uri: item?.imageUrl?.image }}
            style={styles.slideImage}
            resizeMode="contain"
          />
        </View>

        <View

          style={styles.textContainer}
        >
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </View>
    );
  };

  // Render pagination dots
  const renderPaginationDots = () => {
    return (
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => {
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [10, 20, 10],
            extrapolate: 'clamp'
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp'
          });

          const backgroundColor = scrollX.interpolate({
            inputRange,
            outputRange: ['#ffb0b5', '#ec363f', '#ffb0b5'],
            extrapolate: 'clamp'
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                { width: dotWidth, opacity, backgroundColor }
              ]}
            />
          );
        })}
      </View>
    );
  };

  // Show loading state
  if (loading || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#ec363f" />
        <Text style={styles.loadingText}>Getting things ready...</Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Image
          source={{ uri: 'https://cdn-icons-png.flaticon.com/512/6195/6195678.png' }}
          style={styles.errorImage}
        />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.replace('Onboarding')}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Skip button */}
      {currentIndex < slides.length - 1 && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={skipToEnd}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item._id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleSlideChange }
        )}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Pagination */}
      {renderPaginationDots()}

      {/* Action buttons */}
      <View style={styles.bottomContainer}>
        {currentIndex === slides.length - 1 ? (
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => setShowPhoneModal(true)}
          >
            <LinearGradient
              colors={['#ec363f', '#d61f29']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextSlide}
          >
            <LinearGradient
              colors={['#ec363f', '#d61f29']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Phone Auth Modal */}
      <PhoneAuthModal
        visible={showPhoneModal}
        phoneNumber={phoneNumber}
        onChangePhone={setPhoneNumber}
        onSubmit={handlePhoneSubmit}
        onClose={() => setShowPhoneModal(false)}
        isSubmitting={isSubmitting}
      />

      {/* OTP Verification Modal */}
      <OtpVerificationModal
        visible={showOtpModal}
        otp={otp}
        onChangeOtp={setOtp}
        onVerify={handleOtpVerify}
        onClose={() => {
          setShowOtpModal(false);
          setShowPhoneModal(true);
        }}
        onSubmit={handlePhoneSubmit}
        phoneNumber={phoneNumber}
        isSubmitting={isSubmitting}
      />

      {/* Loading Overlay */}
      <LoadingOverlay visible={isSubmitting} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  errorImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ec363f',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#ec363f',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  slideContainer: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  slideImage: {
    width: width * 0.7,
    height: width * 0.7,
  },
  textContainer: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Poppins-Bold',
  },
  slideDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Poppins-Regular',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  paginationDot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  bottomContainer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  nextButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
  },
  getStartedButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Poppins-Medium',
  },
  getStartedButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Poppins-Medium',
  },
});

