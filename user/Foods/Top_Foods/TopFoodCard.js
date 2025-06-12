import React, { useState, useMemo } from 'react';
import { 
  View, 
  TouchableOpacity, 
  Text, 
  Image, 
  Platform,
  ActivityIndicator 
} from 'react-native';
import { StyleSheet } from 'react-native';
import { Clock, Star, IndianRupee, Crown, Leaf } from 'lucide-react-native';

const DEFAULT_IMAGE = "https://i.ibb.co/rGcJwG34/Hotel-2.png";
const LOADING_IMAGE = "https://i.ibb.co/rGcJwG34/Hotel-2.png"

export default function TopFoodCard({ restaurant, onPress }) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const imageSource = useMemo(() => ({
    uri: imageLoading ? LOADING_IMAGE : 
         imageError ? DEFAULT_IMAGE : 
         restaurant?.logo?.url && restaurant.logo.url !== "" ? 
         restaurant.logo.url : DEFAULT_IMAGE
  }), [imageLoading, imageError, restaurant?.logo?.url]);

  const isVeg = useMemo(() => 
    restaurant?.restaurant_category?.toLowerCase() === 'veg', 
    [restaurant?.restaurant_category]
  );

  const ratingColor = useMemo(() => {
    const rating = parseFloat(restaurant?.rating || 0);
    if (rating >= 4.5) return '#00B07C';
    if (rating >= 4.0) return '#4CAF50';
    if (rating >= 3.5) return '#FFC043';
    return '#DB7C38';
  }, [restaurant?.rating]);

  const renderPromotionBadge = () => {
    if (restaurant.restaurant_in_top_list) {
      return (
        <View style={styles.promotionBadge}>
          <Crown size={12} color="#FFD700" />
          <Text style={styles.promotionText}>Featured</Text>
        </View>
      );
    }
    if (isVeg) {
      return (
        <View style={[styles.promotionBadge, styles.vegBadge]}>
          <Leaf size={12} color="#00B07C" />
          <Text style={[styles.promotionText, styles.vegText]}>Pure Veg</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.8} 
      onPress={onPress}
    >
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
          onError={() => {
            setImageError(true);
            setImageLoading(false);
          }}
        />
        
        {imageLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#E23744" />
          </View>
        )}

        {renderPromotionBadge()}

        {/* <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.gradient}
        /> */}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.restaurant_name}
          </Text>
          <View style={[styles.ratingContainer, { backgroundColor: ratingColor }]}>
            <Text style={styles.rating}>
              {restaurant.rating || "4.5"}
            </Text>
            <Star size={10} color="#FFF" fill="#FFF" />
          </View>
        </View>

        <View style={styles.tagsRow}>
          <Text style={styles.cuisineText} numberOfLines={1}>
            {restaurant.restaurant_category}
          </Text>
          <View style={styles.dotSeparator} />
          <Text style={styles.cuisineText}>
            ₹{restaurant.priceForTwoPerson || "200"} for two
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.deliveryInfo}>
            <Clock size={12} color="#666666" />
            <Text style={styles.deliveryText}>
              {restaurant.minDeliveryTime || "40"} min
            </Text>
          </View>

          {restaurant.discount && (
            <View style={styles.offerBadge}>
              <Text style={styles.offerText}>
                50% OFF up to ₹100
              </Text>
            </View>
          )}
        </View>
      </View>

      {restaurant.promoted && (
        <View style={styles.promotedBadge}>
          <Text style={styles.promotedText}>PROMOTED</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      }
    }),
  },
  imageContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
    backgroundColor: '#f8f8f8',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248,248,248,0.9)',
  },
  promotionBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  promotionText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: Platform.select({ ios: '600', default: '700' }),
    letterSpacing: 0.3,
  },
  vegBadge: {
    backgroundColor: 'rgba(0,176,124,0.15)',
  },
  vegText: {
    color: '#00B07C',
  },
  content: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: Platform.select({ ios: '600', default: '700' }),
    color: '#1C1C1C',
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  rating: {
    color: '#fff',
    fontSize: 11,
    fontWeight: Platform.select({ ios: '600', default: '700' }),
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  cuisineText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '400',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#666666',
    marginHorizontal: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  offerBadge: {
    backgroundColor: '#FFF3F4',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  offerText: {
    fontSize: 10,
    color: '#E23744',
    fontWeight: Platform.select({ ios: '600', default: '700' }),
  },
  promotedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(28,28,28,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  promotedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});