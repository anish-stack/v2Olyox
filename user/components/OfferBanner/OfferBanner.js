import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Text,
  Animated,
  ScrollView,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import axios from 'axios';

const { width } = Dimensions.get('screen');
const BANNER_WIDTH = width - 30;
const BANNER_HEIGHT = BANNER_WIDTH * 0.6;

const OfferBanner = ({refreshing}) => {
  // Fallback banners in case API fails
  const fallbackBanners = [
    {
      id: 1,
      title: "Delicious Food Deals",
      description: "Get the best offers on your favorite meals.",
      image: {
        url: "https://res.cloudinary.com/dglihfwse/image/upload/v1736336797/WhatsApp_Image_2025-01-08_at_17.16.24_cot9nj.jpg"
      }
    },
    {
      id: 2,
      title: "Ride in Style",
      description: "Book rides at amazing discounts.",
      image: {
        url: "https://res.cloudinary.com/dglihfwse/image/upload/v1736336973/9878212_4224776_irocmo.jpg"
      }
    },
    {
      id: 3,
      title: "Shop & Save",
      description: "Exciting offers on top brands.",
      image: {
        url: "https://res.cloudinary.com/dglihfwse/image/upload/v1736337123/24450961_2202_w023_n001_1891b_p1_1891_hdqluf.jpg"
      }
    },
    {
      id: 4,
      title: "Travel the World",
      description: "Find the best travel packages just for you.",
      image: {
        url: "https://res.cloudinary.com/dglihfwse/image/upload/v1736337273/happy-woman-waiting-to-receive-the-package-from-the-delivery-man-mobile-phone-showing-parcel-status-and-location-fast-motorbike-driver-to-deliver-on-time-design-for-banner-illustration-website-vector_qyobml.jpg"
      }
    },
  ];

  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const { data } = await axios.get('https://appapi.olyox.com/api/v1/admin/get_home_banners');
        
        if (data.data && Array.isArray(data.data)) {
          const activeBanners = data.data.filter(item => item.is_active === true);
          
          if (activeBanners.length > 0) {
            setBanners(activeBanners);
            console.log('Banner count:', activeBanners.length);
          } else {
            console.log('No active banners found, using fallbacks');
            setBanners(fallbackBanners);
            console.log('Fallback banner count:', fallbackBanners.length);
          }
        } else {
          console.log('Invalid API response, using fallbacks');
          setBanners(fallbackBanners);
          console.log('Fallback banner count:', fallbackBanners.length);
        }
      } catch (error) {
        console.error('Error fetching banners:', error?.response?.data?.message || error.message);
        setBanners(fallbackBanners);
        setError('Failed to load banners');
        console.log('Fallback banner count:', fallbackBanners.length);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [refreshing]);

  // Auto-scroll effect
  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          x: nextIndex * width,
          animated: true,
        });
      }
      
      setCurrentIndex(nextIndex);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex, banners.length]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleScrollEnd = (event) => {
    const position = event.nativeEvent.contentOffset.x;
    const index = Math.round(position / width);
    setCurrentIndex(index);
  };

  // Manual navigation
  const goToSlide = (index) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * width,
        animated: true,
      });
      setCurrentIndex(index);
    }
  };

  const goToPrevious = () => {
    const prevIndex = (currentIndex - 1 + banners.length) % banners.length;
    goToSlide(prevIndex);
  };

  const goToNext = () => {
    const nextIndex = (currentIndex + 1) % banners.length;
    goToSlide(nextIndex);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5A5F" />
      </View>
    );
  }

  if (error || banners.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Something went wrong</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollViewContent}
      >
        {banners.map((item, index) => (
          <View key={index} style={styles.bannerContainer}>
            <Image 
              source={{ uri: item.image?.url }} 
              style={styles.image} 
              resizeMode="cover"
            />
            {item.title && (
              <View style={styles.textOverlay}>
                <Text style={styles.title}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.description}>{item.description}</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Navigation arrows - only show if more than one banner */}
      {banners.length > 1 && (
        <View style={styles.arrowsContainer}>
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={goToPrevious}
            activeOpacity={0.7}
          >
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.arrowButton} 
            onPress={goToNext}
            activeOpacity={0.7}
          >
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pagination Dots - only show if more than one banner */}
      {banners.length > 1 && (
        <View style={styles.pagination}>
          {banners.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.8, 1.4, 0.8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.5, 1, 0.5],
              extrapolate: 'clamp',
            });

            const backgroundColor = scrollX.interpolate({
              inputRange,
              outputRange: ['#FF5A5F80', '#FF5A5F', '#FF5A5F80'],
              extrapolate: 'clamp',
            });

            return (
              <TouchableOpacity 
                key={index} 
                onPress={() => goToSlide(index)}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.dotContainer,
                    { 
                      transform: [{ scale }],
                      opacity,
                      backgroundColor,
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    position: 'relative',
  },
  loadingContainer: {
    height: BANNER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  errorContainer: {
    height: BANNER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
  },
  errorText: {
    color: '#FF5A5F',
    fontSize: 16,
    fontWeight: '500',
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  bannerContainer: {
    width: width,
    paddingHorizontal: 15,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  image: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#f0f0f0', // Placeholder color while loading
  },
  textOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  description: {
    color: 'white',
    fontSize: 13,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dotContainer: {
    width: 8,
    height: 8,
    marginHorizontal: 4,
    borderRadius: 4,
  },
  arrowsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    top: '50%',
    transform: [{ translateY: -15 }],
    paddingHorizontal: 5,
    pointerEvents: 'box-none',
  },
  arrowButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
  arrowText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF5A5F',
    lineHeight: 24,
  },
});

export default OfferBanner;