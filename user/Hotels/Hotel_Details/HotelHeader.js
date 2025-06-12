import React from 'react';
import { useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

export default function HotelHeader({ hotel }) {
  const [imageError, setImageError] = useState(false)
  return (
    <View style={styles.container}>
      <Image
        source={
          imageError || !hotel?.hotel_main_show_image
            ? require('./no-image.jpeg')
            : { uri: hotel.hotel_main_show_image }
        }
        style={styles.headerImage}
        onError={() => setImageError(true)}
        resizeMode="cover"
      />


      <View style={styles.contentContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.hotelName}>{hotel.hotel_name}</Text>
          <View style={styles.locationBadge}>
            <Icon name="map-marker" size={16} color="#E41D57" />
            <Text style={styles.zone}>{hotel.hotel_zone}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Icon name="map-marker-outline" size={18} color="#666" />
          <Text style={styles.infoText}>{hotel.hotel_address}</Text>
        </View>

        <View style={styles.contactRow}>
          <View style={styles.contactItem}>
            <Icon name="phone" size={18} color="#666" />
            <Text style={styles.infoText}>{hotel.hotel_phone}</Text>
          </View>
          <View style={styles.contactItem}>
            <Icon name="account" size={18} color="#666" />
            <Text style={styles.infoText}>{hotel.hotel_owner}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  headerImage: {
    width: width,
    height: 250,
  },
  contentContainer: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hotelName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  zone: {
    color: '#E41D57',
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});