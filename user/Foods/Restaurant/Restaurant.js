import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StatusBar,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Phone, MapPin, Star, Clock, Leaf, CircleAlert as AlertCircle, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Food_Card from '../Food_Card/Food_Card';
import SuperFicial from '../../SuperFicial/SuperFicial';
import { useFood } from '../../context/Food_Context/Food_context';

const DEFAULT_IMAGE = "https://i.ibb.co/rGcJwG34/Hotel-2.png";
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 280;

export default function Restaurant() {
  const route = useRoute();
  const { cart } = useFood();
  const navigation = useNavigation();
  const { item } = route.params || {};
  const [details, setDetails] = useState(null);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(
        `http://192.168.1.6:3100/api/v1/tiffin/find_Restaurant_And_Her_foods?restaurant_id=${item}`
      );
      if (data.details) {
        setDetails(data.details);
        setFoods(data.food);
      }
    } catch (err) {
      setError("Unable to fetch restaurant data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const handleCall = useCallback(() => {
    if (details?.restaurant_phone) {
      Linking.openURL(`tel:${details.restaurant_phone}`);
    }
  }, [details?.restaurant_phone]);

  const HeaderComponent = Platform.select({
    ios: BlurView,
    default: View
  });

  const headerProps = Platform.select({
    ios: { intensity: 100, tint: 'light' },
    default: {}
  });

  const restaurantInfo = useMemo(() => ({
    name: details?.restaurant_name || 'Restaurant',
    rating: details?.rating || 'New',
    category: details?.restaurant_category || 'Restaurant',
    isOpen: details?.isWorking || false,
    deliveryTime: details?.minDeliveryTime || '30-40 min',
    priceForTwo: details?.priceForTwoPerson || '500',
    address: details?.restaurant_address?.street 
      ? `${details.restaurant_address.street}, ${details.restaurant_address.city}`
      : 'Address not available'
  }), [details]);

  const renderHeader = () => (
    <HeaderComponent
      style={styles.header}
      {...headerProps}
    >
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={() => navigation.goBack()}
      >
        <ArrowLeft size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {restaurantInfo.name}
      </Text>
      <TouchableOpacity 
        style={styles.headerButton} 
        onPress={handleCall}
      >
        <Phone size={24} color="#000" />
      </TouchableOpacity>
    </HeaderComponent>
  );

  const renderBanner = () => (
    <View style={styles.bannerContainer}>
      <Image
        source={{ uri: imageError ? DEFAULT_IMAGE : details?.logo?.url || DEFAULT_IMAGE }}
        style={styles.bannerImage}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
      />
      {imageLoading && (
        <View style={styles.imageLoadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bannerGradient}
      >
        <View style={styles.bannerContent}>
          <Text style={styles.restaurantName}>{restaurantInfo.name}</Text>
          <View style={styles.bannerInfo}>
            <View style={styles.ratingBadge}>
              <Star size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{restaurantInfo.rating}</Text>
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{restaurantInfo.category}</Text>
            </View>
            {restaurantInfo.isOpen && (
              <View style={styles.openBadge}>
                <Clock size={14} color="#4CAF50" />
                <Text style={styles.openText}>Open Now</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderQuickInfo = () => (
    <View style={styles.quickInfoContainer}>
      <View style={styles.quickInfoItem}>
        <Clock size={20} color="#666" />
        <Text style={styles.quickInfoText}>{restaurantInfo.deliveryTime}</Text>
        <Text style={styles.quickInfoLabel}>Delivery Time</Text>
      </View>
      <View style={styles.quickInfoDivider} />
      <View style={styles.quickInfoItem}>
        <Text style={styles.currencySymbol}>₹</Text>
        <Text style={styles.quickInfoText}>{restaurantInfo.priceForTwo}</Text>
        <Text style={styles.quickInfoLabel}>For Two</Text>
      </View>
      <View style={styles.quickInfoDivider} />
      <View style={styles.quickInfoItem}>
        <Star size={20} color="#666" />
        <Text style={styles.quickInfoText}>{restaurantInfo.rating}</Text>
        <Text style={styles.quickInfoLabel}>Rating</Text>
      </View>
    </View>
  );

  const renderDetails = () => (
    <View style={styles.detailsContainer}>
      {!restaurantInfo.isOpen && (
        <View style={styles.closedBanner}>
          <Clock size={20} color="#fff" />
          <Text style={styles.closedText}>
            Currently Closed • Opens at {details?.openingHours?.split('-')[0]}
          </Text>
        </View>
      )}

      {renderQuickInfo()}

      <View style={styles.addressSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Location & Contact</Text>
          <TouchableOpacity onPress={handleCall} style={styles.callButton}>
            <Phone size={18} color="#fff" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.addressContent}>
          <MapPin size={20} color="#666" />
          <Text style={styles.addressText}>{restaurantInfo.address}</Text>
        </View>
      </View>

      {restaurantInfo.category === "Veg" && (
        <View style={styles.vegBadge}>
          <Leaf size={16} color="#4CAF50" />
          <Text style={styles.vegText}>Pure Vegetarian Restaurant</Text>
        </View>
      )}
    </View>
  );

  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <Text style={styles.menuTitle}>Menu</Text>
      <View style={styles.menuGrid}>
        {foods.map((item) => (
          <Food_Card
            key={item._id}
            isAddAble={restaurantInfo.isOpen}
            item={item}
          />
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E23744" />
        <Text style={styles.loadingText}>Loading restaurant details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={48} color="#E23744" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchFoods}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      {renderHeader()}
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
      >
        {renderBanner()}
        {renderDetails()}
        {renderMenu()}
      </ScrollView>
      <SuperFicial cart={cart} restaurant_id={details} totalAmount={400} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 88 : 100,
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.85)',
      default: '#fff'
    }),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1000,
    ...Platform.select({
      android: {
        elevation: 4,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Platform.select({
      ios: 'rgba(255,255,255,0.9)',
      default: '#fff'
    }),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  bannerContainer: {
    height: BANNER_HEIGHT,
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_HEIGHT,
    justifyContent: 'flex-end',
    padding: 20,
  },
  bannerContent: {
    gap: 12,
  },
  restaurantName: {
    fontSize: 32,
    fontWeight: Platform.select({ ios: '800', default: 'bold' }),
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  openText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  quickInfoContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -30,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  quickInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickInfoDivider: {
    width: 1,
    backgroundColor: '#eee',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  quickInfoText: {
    fontSize: 16,
    fontWeight: Platform.select({ ios: '600', default: 'bold' }),
    color: '#000',
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#666',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 20,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 50,
  },
  closedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  addressSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: Platform.select({ ios: '600', default: 'bold' }),
    color: '#000',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E23744',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  vegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  vegText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  menuContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 16,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: Platform.select({ ios: '700', default: 'bold' }),
    color: '#000',
    marginBottom: 16,
  },
  menuGrid: {
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#E23744',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.select({ ios: '600', default: 'bold' }),
  },
});