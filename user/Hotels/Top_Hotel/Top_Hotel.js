import { View, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { findMyNearHotels } from '../utils/Hotel.data';
import { styles } from './Styles';
import * as Location from 'expo-location';
import HotelCard from './Top_Hotel_cards';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import { useLocation } from '../../context/LocationContext';

export default function Top_Hotel({ show = false, onRefresh, refreshing }) {
  const [showAll, setShowAll] = useState(show);
  const [hotelData, setHotelData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isMounted = useRef(false);

  const { location } = useLocation();

  const fetchCoordinates = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      console.log("📍 Current location fetched:", currentLocation);
      return currentLocation?.coords;
    } catch (err) {
      console.log('Error getting current location:', err);
      setError('Unable to fetch your current location.');
      return null;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isMounted.current) return;
        isMounted.current = true;

        let coords = location?.coords;

        // If no location from context, get current location
        if (!coords) {
          coords = await fetchCoordinates();
        }

        if (!coords) return;

        const { latitude, longitude } = coords;
        console.log("Latitude:", latitude, "Longitude:", longitude);

        const data = await findMyNearHotels(latitude, longitude);
        setHotelData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.log('Error fetching hotels:', err);
        setError('We are facing some issues. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshing]);

  const displayedHotels = showAll ? hotelData : hotelData.slice(0, 4);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trending Hotels</Text>
        <TouchableOpacity style={styles.viewAllButton} onPress={() => setShowAll(!showAll)}>
          <Text style={styles.viewAllText}>{showAll ? 'Show Less' : 'View All'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonLoader />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.cardsContainer}>
            {displayedHotels.map((hotel, index) => (
              <HotelCard key={index} hotel={hotel} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
