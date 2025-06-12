import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function RoomList({ rooms }) {
  const [imageError, setImageError] = useState(false);
  // console.log("rooms images", rooms)
  const navigation = useNavigation()
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Rooms</Text>
      <View style={styles.grid}>
        {rooms.map((room) => (
          <TouchableOpacity onPress={() => navigation.navigate('Single-hotels-listing', { id: room?._id })} key={room._id} style={styles.roomCard}>
            <Image
           
              source={
                imageError
                  ? require('./no-image.jpeg') 
                  : { uri: room.main_image?.url }
              }

              style={styles.roomImage}
              onError={(error) => setImageError(true)}
              defaultSource={require('./no-image.jpeg')}  // Lightweight placeholder while loading
              resizeMode="cover"
            />



            <View style={styles.badgeContainer}>
              <View style={styles.ratingBadge}>
                <Icon name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{room.rating_number}</Text>
              </View>
              {room.isPackage && (
                <View style={styles.packageBadge}>
                  <Text style={styles.packageText}>Package</Text>
                </View>
              )}
            </View>

            <View style={styles.content}>
              <Text style={styles.roomType} numberOfLines={1}>
                {room.room_type}
              </Text>

              <View style={styles.tagsRow}>
                {room.has_tag.slice(0, 2).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>
                      {tag.replace('_', ' ')}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.cutPrice}>₹{room.cut_price}</Text>
                <Text style={styles.price}>₹{room.book_price}</Text>
                <Text style={styles.discount}>
                  {room.discount_percentage}% off
                </Text>
              </View>

              <TouchableOpacity onPress={() => navigation.navigate('Single-hotels-listing', { id: room?._id })} style={styles.bookButton}>
                <Text style={styles.bookButtonText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  roomCard: {
    width: CARD_WIDTH,
    marginHorizontal: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  roomImage: {
    width: '100%',
    height: 120,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  ratingText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 2,
    fontWeight: '600',
  },
  packageBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  packageText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    padding: 12,
  },
  roomType: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
  },
  priceContainer: {
    marginBottom: 8,
  },
  cutPrice: {
    fontSize: 12,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.error,
  },
  discount: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  bookButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});