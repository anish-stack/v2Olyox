import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const DEFAULT_IMAGE = "https://i.ibb.co/hR4vMgr3/Hotel-1.png";

export default function HotelCard({ hotel, onPress }) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const navigation = useNavigation();

  const amenities = Object.keys(hotel?.amenities || {}).filter(key => hotel?.amenities[key]);

  const imageSource = {
    uri: imageError ? DEFAULT_IMAGE : hotel?.main_image?.url || DEFAULT_IMAGE
  };

  const RatingBadge = Platform.select({
    ios: BlurView,
    default: View
  });

  const ratingProps = Platform.select({
    ios: { intensity: 80, tint: 'dark' },
    default: {}
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => navigation.navigate('hotels-details', {
        item: hotel?.hotel_user?._id
      })}
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
            <ActivityIndicator size="large" color="#AA0000" />
          </View>
        )}

        <RatingBadge style={styles.ratingBadge} {...ratingProps}>
          <Icon name="star" size={14} color="#FFD700" />
          <Text style={styles.ratingText}>
            {hotel?.rating_number || "4.0"}
          </Text>
        </RatingBadge>

        <View style={styles.priceTag}>
          <Text style={styles.priceText}>₹{hotel?.book_price}</Text>
          <Text style={styles.perNightText}>/night</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {hotel?.hotel_user?.hotel_name || "Luxury Hotel"}
          </Text>
        </View>

        <View style={styles.locationContainer}>
          <Icon name="map-marker" size={16} color="#666666" />
          <Text style={styles.location} numberOfLines={1}>
            {hotel?.hotel_user?.hotel_address || "Location unavailable"}
          </Text>
        </View>



        <TouchableOpacity
          style={styles.bookButton}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,

    marginVertical: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      }
    }),
  },
  imageContainer: {
    height: 200,
    height: 159,
    position: 'relative',
  },
  image: {
    height: '100%',
    width: '100%',
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Platform.select({
      ios: 'transparent',
      default: 'rgba(0, 0, 0, 0.6)',
    }),
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  priceTag: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#AA0000',
  },
  perNightText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 2,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  location: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 4,
    flex: 1,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  amenityBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  amenityText: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'capitalize',
  },
  bookButton: {
    backgroundColor: '#AA0000',
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});