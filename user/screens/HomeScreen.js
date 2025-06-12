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
  Platform
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
import { initializeSocket } from '../services/socketService';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

// Performance tracking utilities
const performanceTracker = {
  renderCount: 0,
  componentRenderCounts: {},
  
  trackRender: (componentName) => {
    performanceTracker.componentRenderCounts[componentName] = 
      (performanceTracker.componentRenderCounts[componentName] || 0) + 1;
    console.count(`📊 ${componentName} render count`);
  },
  
  logStats: () => {
    console.log('📈 Final Render Statistics:', performanceTracker.componentRenderCounts);
  }
};

// Memoized Component Loader
const ComponentLoader = memo(({ text }) => {
  performanceTracker.trackRender('ComponentLoader');
  
  return (
    <View style={styles.componentLoader}>
      <ActivityIndicator size="small" color="#FF6B00" />
      <Text style={styles.loaderText}>{text}</Text>
    </View>
  );
});

ComponentLoader.displayName = 'ComponentLoader';

// Memoized component wrappers to prevent unnecessary re-renders
const MemoizedOfferBanner = memo(({ componentLoading, onRefresh, refreshing }) => {
  performanceTracker.trackRender('OfferBanner');
  
  if (componentLoading.offers) {
    return <ComponentLoader text="Loading offers..." />;
  }
  
  return <OfferBanner onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedCategories = memo(({ componentLoading, onRefresh, refreshing }) => {
  performanceTracker.trackRender('Categories');
  
  if (componentLoading.categories) {
    return <ComponentLoader text="Loading categories..." />;
  }
  
  return <Categories onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedBookARide = memo(({ componentLoading, onRefresh, refreshing }) => {
  performanceTracker.trackRender('BookARide');
  
  if (componentLoading.bookRide) {
    return <ComponentLoader text="Loading ride options..." />;
  }
  
  return <BookARide onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedTopHotel = memo(({ componentLoading, onRefresh, refreshing }) => {
  performanceTracker.trackRender('TopHotel');
  
  if (componentLoading.topHotels) {
    return <ComponentLoader text="Loading top hotels..." />;
  }
  
  return <Top_Hotel onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedFoodCats = memo(({ componentLoading, onRefresh, refreshing }) => {
  performanceTracker.trackRender('FoodCats');
  
  if (componentLoading.foodCategories) {
    return <ComponentLoader text="Loading food categories..." />;
  }
  
  return <Food_Cats onRefresh={onRefresh} refreshing={refreshing} />;
});

const MemoizedTopFood = memo(({ componentLoading, onRefresh, refreshing }) => {
  performanceTracker.trackRender('TopFood');
  
  if (componentLoading.topFoods) {
    return <ComponentLoader text="Loading top foods..." />;
  }
  
  return <TopFood onRefresh={onRefresh} refreshing={refreshing} />;
});

const HomeScreen = () => {
    console.time('🏠 HomeScreen Mount Time');
    
    // Refs
    const isMounted = useRef(false);
    const flatListRef = useRef(null);
    const mountTime = useRef(Date.now());

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
    
    const { userId } = useSocket();

    // Track HomeScreen renders
    performanceTracker.trackRender('HomeScreen');

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

    // Optimized load component data function
    const loadComponentData = useCallback(async (component) => {
        console.time(`⏱️ Loading ${component}`);
        try {
            // Simulate API call for the specific component
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));
            
            setComponentLoading(prev => {
                const newState = { ...prev, [component]: false };
                console.log(`✅ ${component} loaded successfully`);
                return newState;
            });
        } catch (error) {
            console.error(`❌ Error loading ${component}:`, error);
        } finally {
            console.timeEnd(`⏱️ Loading ${component}`);
        }
    }, []);

    // Optimized initial data fetch
    const fetchData = useCallback(async () => {
        console.time('🔄 Data Fetch Time');
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
            console.time('⏱️ Main Data Load');
            await new Promise((resolve) => setTimeout(resolve, 1500));
            console.timeEnd('⏱️ Main Data Load');

            // Start loading individual components with staggered timing for better UX
            const componentKeys = Object.keys(initialLoadingState);
            componentKeys.forEach((component, index) => {
                setTimeout(() => {
                    loadComponentData(component);
                }, index * 200); // Stagger by 200ms each
            });

            isMounted.current = true;
        } catch (error) {
            console.error('❌ Error fetching data:', error);
        } finally {
            setLoading(false);
            console.timeEnd('🔄 Data Fetch Time');
        }
    }, [loadComponentData]);

    // Fetch data on component mount
    useEffect(() => {
        if (!isMounted.current) {
            fetchData();
        }
        
        return () => {
            const totalTime = Date.now() - mountTime.current;
            console.log(`🏠 HomeScreen total lifecycle: ${totalTime}ms`);
            performanceTracker.logStats();
        };
    }, [fetchData]);

    // Optimized refresh function
    const onRefresh = useCallback(async () => {
        console.time('🔄 Refresh Time');
        console.log('🔄 Starting refresh...');
        
        try {
            setRefreshing(true);
            
            // Reset socket if userId exists
            if (userId) {
                console.log('🔌 Reinitializing socket...');
                initializeSocket({ userId: userId });
            }
            
            await fetchData();
            console.log('✅ Refresh completed successfully');
        } catch (error) {
            console.error('❌ Refresh error:', error);
        } finally {
            setRefreshing(false);
            console.timeEnd('🔄 Refresh Time');
        }
    }, [userId, fetchData]);

    // Memoized render item function for FlatList
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

    // Memoized key extractor
    const keyExtractor = useCallback((item) => item.key, []);

    // Memoized FlatList props for optimal performance
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
        console.log('⏳ Showing skeleton loader...');
        return (
            <Layout>
                <View style={styles.skeletonContainer}>
                    <SkeletonLoader />
                </View>
            </Layout>
        );
    }

    console.timeEnd('🏠 HomeScreen Mount Time');
    console.log(`📱 Screen width: ${screenWidth}px`);
    console.log(`📱 Device type: ${isTablet ? 'Tablet' : 'Phone'}`);

    return (
        <Layout>
            <FlatList {...flatListProps} />
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
});

export default memo(HomeScreen);