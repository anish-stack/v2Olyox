import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../constants/colors';

const amenityIcons = {
  AC: 'air-conditioner',
  freeWifi: 'wifi',
  kitchen: 'kitchen',
  TV: 'television',
  powerBackup: 'power-plug',
  geyser: 'water-boiler',
  parkingFacility: 'parking',
  elevator: 'elevator',
  cctvCameras: 'cctv',
  diningArea: 'table-furniture',
  privateEntrance: 'door',
  reception: 'desk',
  caretaker: 'account-tie',
  security: 'shield-check',
  checkIn24_7: 'clock-24',
  dailyHousekeeping: 'broom',
  fireExtinguisher: 'fire-extinguisher',
  firstAidKit: 'medical-bag',
  buzzerDoorBell: 'bell',
  attachedBathroom: 'shower'
};

export default function HotelAmenities({ amenities }) {
  const [showAll, setShowAll] = useState(false);
  const amenitiesList = Object.entries(amenities).filter(([_, value]) => value);
  const displayedAmenities = showAll ? amenitiesList : amenitiesList.slice(0, 6);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Amenities</Text>
      <View style={styles.grid}>
        {displayedAmenities.map(([key]) => (
          <View key={key} style={styles.amenityItem}>
            <View style={styles.iconContainer}>
              <Icon name={amenityIcons[key]} size={20} color={COLORS.error} />
            </View>
            <Text style={styles.amenityText}>
              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
            </Text>
          </View>
        ))}
      </View>

      {amenitiesList.length > 6 && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setShowAll(!showAll)}
        >
          <Text style={styles.showMoreText}>
            {showAll ? 'Show Less' : 'Show More'}
          </Text>
          <Icon
            name={showAll ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#E41D57"
          />
        </TouchableOpacity>
      )}
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
  amenityItem: {
    width: '33.33%',
    padding: 8,
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE4E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  amenityText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 8,
  },
  showMoreText: {
    color: '#E41D57',
    marginRight: 4,
    fontWeight: '500',
  },
});