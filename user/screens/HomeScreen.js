import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
  useMemo
} from 'react';

import {
  StyleSheet,
  FlatList,
  RefreshControl,
  View,
  Text,
  ActivityIndicator,
  Dimensions,
  Platform,
  TouchableOpacity
} from 'react-native';
import Layout from '../components/Layout/_layout';
import OfferBanner from '../components/OfferBanner/OfferBanner';
import Categories from '../components/Categories/Categories';
import Top_Hotel from '../Hotels/Top_Hotel/Top_Hotel';
import TopFood from '../Foods/Top_Foods/TopFood';
import BookARide from '../components/Book_A_Ride/BookARide';
import Food_Cats from '../Foods/Food_Cats/Food_Cats';
import SkeletonLoader from './SkeletonLoader';
import { useSocket } from '../context/SocketContext';
import { useRideSearching } from '../context/ride_searching';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// Memoized Component Loader
const ComponentLoader = memo(({ text }) => {
  return (
    <View style={styles.componentLoader}>
      <ActivityIndicator size="small" color="#FF6B00" />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );
});

ComponentLoader.displayName = 'ComponentLoader';

// Ride Searching Progress Bar
const RideSearchingBar = memo(({ onNavigateToRide }) => {
  return (
    <View style={styles.rideSearchingContainer}>
      <View style={styles.rideSearchingContent}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.rideSearchingText}>Your ride searching in progress</Text>
        <TouchableOpacity onPress={onNavigateToRide} style={styles.navigationButton}>
          <Text style={styles.navigationButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

RideSearchingBar.displayName = 'RideSearchingBar';

// Memoized component wrappers
const MemoizedOfferBanner = memo(({ componentLoading, onRefresh, refreshing }) => {
  if (componentLoading.offers) {
    return <ComponentLoader text="Loading offers..." />;
  }
  return <OfferBanner onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedCategories = memo(({ componentLoading, onRefresh, refreshing }) => {
  if (componentLoading.categories) {
    return <ComponentLoader text="Loading categories..." />;
  }
  return <Categories onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedBookARide = memo(({ componentLoading, onRefresh, refreshing }) => {
  if (componentLoading.bookRide) {
    return <ComponentLoader text="Loading ride options..." />;
  }
  return <BookARide onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedTopHotel = memo(({ componentLoading, onRefresh, refreshing }) => {
  if (componentLoading.topHotels) {
    return <ComponentLoader text="Loading top hotels..." />;
  }
  return <Top_Hotel onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedFoodCats = memo(({ componentLoading, onRefresh, refreshing }) => {
  if (componentLoading.foodCategories) {
    return <ComponentLoader text="Loading food categories..." />;
  }
  return <Food_Cats onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedTopFood = memo(({ componentLoading, onRefresh, refreshing }) => {
  if (componentLoading.topFoods) {
    return <ComponentLoader text="Loading top foods..." />;
  }
  return <TopFood onRefresh={onRefresh} refreshing={refreshing} />;
});

const HomeScreen = () => {
  const isMounted = useRef(false);
  const flatListRef = useRef(null);

  const { currentRide, rideStatus } = useRideSearching();
  const { userId } = useSocket();

  // State management
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [componentLoading, setComponentLoading] = useState({
    offers: true,
    categories: true,
    bookRide: true,
    topHotels: true,
    foodCategories: true,
    topFoods: true
  });

  // Check if ride searching bar should be shown
  const shouldShowRideSearching = useMemo(() => {
    return currentRide && rideStatus === 'searching';
  }, [currentRide, rideStatus]);

  // Memoized component data for FlatList
  const componentData = useMemo(() => [
    {
      key: 'offers',
      component: MemoizedOfferBanner,
      loadingKey: 'offers'
    },
    {
      key: 'categories',
      component: MemoizedCategories,
      loadingKey: 'categories'
    },
    {
      key: 'bookRide',
      component: MemoizedBookARide,
      loadingKey: 'bookRide'
    },
    {
      key: 'topHotels',
      component: MemoizedTopHotel,
      loadingKey: 'topHotels'
    },
    {
      key: 'foodCategories',
      component: MemoizedFoodCats,
      loadingKey: 'foodCategories'
    },
    {
      key: 'topFoods',
      component: MemoizedTopFood,
      loadingKey: 'topFoods'
    }
  ], []);

  // Load component data function
  const loadComponentData = useCallback(async (component) => {
    try {
      // Simulate API call for the specific component
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

      setComponentLoading(prev => ({
        ...prev,
        [component]: false
      }));
    } catch (error) {
      console.error(`Error loading ${component}:`, error);
    }
  }, []);

  // Initial data fetch
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Reset component loading states during a refresh
      const initialLoadingState = {
        offers: true,
        categories: true,
        bookRide: true,
        topHotels: true,
        foodCategories: true,
        topFoods: true
      };

      setComponentLoading(initialLoadingState);

      // Simulate main data loading
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Start loading individual components with staggered timing
      const componentKeys = Object.keys(initialLoadingState);
      componentKeys.forEach((component, index) => {
        setTimeout(() => {
          loadComponentData(component);
        }, index * 200);
      });

      isMounted.current = true;
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadComponentData]);

  // Fetch data on component mount
  useEffect(() => {
    if (!isMounted.current) {
      fetchData();
    }
  }, [fetchData]);

  // Refresh function
  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchData();
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  // Handle ride navigation
  const handleNavigateToRide = useCallback(() => {
    // Add your navigation logic here
    // Example: navigation.navigate('RideTracking', { rideId: currentRide.id });
    console.log('Navigate to ride:', currentRide);
  }, [currentRide]);

  // Render item function for FlatList
  const renderItem = useCallback(({ item }) => {
    const Component = item.component;
    return (
      <Component
        componentLoading={componentLoading}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    );
  }, [componentLoading, onRefresh, refreshing]);

  // Key extractor
  const keyExtractor = useCallback((item) => item.key, []);

  // FlatList props
  const flatListProps = useMemo(() => ({
    ref: flatListRef,
    data: componentData,
    renderItem: renderItem,
    keyExtractor: keyExtractor,
    showsVerticalScrollIndicator: false,
    scrollEventThrottle: 16,
    initialNumToRender: 3,
    maxToRenderPerBatch: 2,
    windowSize: 5,
    removeClippedSubviews: Platform.OS === 'android',
    updateCellsBatchingPeriod: 100,
    contentContainerStyle: styles.flatListContent,
    refreshControl: (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        colors={['#FF6B00']}
        tintColor={'#FF6B00'}
        title="Pull to refresh"
        titleColor="#666"
      />
    )
  }), [componentData, renderItem, keyExtractor, refreshing, onRefresh]);

  // Show skeleton loader while initial loading
  if (loading) {
    return (
      <Layout>
        <View style={styles.skeletonContainer}>
          <SkeletonLoader />
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <FlatList {...flatListProps} />
      {shouldShowRideSearching && (
        <RideSearchingBar onNavigateToRide={handleNavigateToRide} />
      )}
    </Layout>
  );
};

const styles = StyleSheet.create({
  flatListContent: {
    paddingBottom: 16,
  },
  skeletonContainer: {
    flex: 1,
    paddingBottom: 16,
  },
  componentLoader: {
    padding: isTablet ? 24 : 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    minHeight: isTablet ? 120 : 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  loaderText: {
    marginTop: 8,
    color: '#666',
    fontSize: isTablet ? 16 : 14,
    fontWeight: '500',
  },
  rideSearchingContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  rideSearchingContent: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rideSearchingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  navigationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default memo(HomeScreen);