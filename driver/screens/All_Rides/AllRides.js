import { View, Text, RefreshControl, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import HeaderNew from '../../New Screens/components/Header/HeaderNew'
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';

export default function AllRides() {
  const [allRides, setAllRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRide, setExpandedRide] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const navigation = useNavigation();

  const fetchAllRides = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token_cab');
      if (!token) {
        setError('Authentication token not found');
        return;
      }

      const response = await axios.get(
        'http://192.168.1.6:3100/api/v1/rider/getMyAllRides',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAllRides(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching rides:', err);
      setError('Failed to fetch rides. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAllRides();
  }, []);

  useEffect(() => {
    fetchAllRides();
  }, []);

  // Filter rides based on active filter
  const filteredRides = useMemo(() => {
    if (!allRides.length) return [];

    switch (activeFilter) {
      case 'today':
        return allRides.filter(ride => isToday(parseISO(ride.created_at)));
      case 'week':
        return allRides.filter(ride => isThisWeek(parseISO(ride.created_at)));
      case 'completed':
        return allRides.filter(ride => ride.ride_status === 'completed');
      case 'cancelled':
        return allRides.filter(ride => ride.ride_status === 'cancelled');
      default:
        return allRides;
    }
  }, [allRides, activeFilter]);

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#28a745';
      case 'cancelled': return '#dc3545';
      case 'ongoing': return '#007bff';
      case 'pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return 'check-circle';
      case 'cancelled': return 'cancel';
      case 'ongoing': return 'car';
      case 'pending': return 'clock-outline';
      default: return 'help-circle';
    }
  };

  // Format date for display
  const formatRideDate = (dateString) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd, yyyy');
  };

  // Format time for display
  const formatRideTime = (dateString) => {
    return format(parseISO(dateString), 'hh:mm a');
  };

  // Format address for display
  const formatAddress = (address) => {
    if (!address?.formatted_address) return 'Address not available';
    const parts = address.formatted_address
    return parts
  };

  // Calculate ride duration
  const getRideDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const diff = Math.round((end - start) / (1000 * 60)); // minutes
    return `${diff} min`;
  };

  const toggleRideExpansion = (rideId) => {
    setExpandedRide(expandedRide === rideId ? null : rideId);
  };

  const renderFilterButton = (filter, label, icon) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        activeFilter === filter && styles.activeFilterButton
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <MaterialCommunityIcons
        name={icon}
        size={16}
        color={activeFilter === filter ? '#fff' : '#007bff'}
      />
      <Text style={[
        styles.filterButtonText,
        activeFilter === filter && styles.activeFilterButtonText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderRideCard = ({ item: ride }) => {
    const isExpanded = expandedRide === ride._id;
    
    return (
      <TouchableOpacity
        style={styles.rideCard}
        onPress={() => toggleRideExpansion(ride._id)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.rideHeader}>
          <View style={styles.rideHeaderLeft}>
            <MaterialCommunityIcons
              name={getStatusIcon(ride.ride_status)}
              size={24}
              color={getStatusColor(ride.ride_status)}
            />
            <View style={styles.rideHeaderText}>
              <Text style={styles.rideDate}>{formatRideDate(ride.created_at)}</Text>
              <Text style={styles.rideTime}>{formatRideTime(ride.created_at)}</Text>
            </View>
          </View>
          <View style={styles.rideHeaderRight}>
            <Text style={[styles.rideStatus, { color: getStatusColor(ride.ride_status) }]}>
              {ride.ride_status.toUpperCase()}
            </Text>
            <Text style={styles.rideFare}>₹{ride.pricing?.total_fare || 0}</Text>
          </View>
        </View>

        {/* Route Info */}
        <View style={styles.routeContainer}>
          <View style={styles.routeIndicator}>
            <View style={styles.pickupDot} />
            <View style={styles.routeLine} />
            <View style={styles.dropDot} />
          </View>
          <View style={styles.routeAddresses}>
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>FROM</Text>
              <Text style={styles.addressText} >
                {formatAddress(ride.pickup_address)}
              </Text>
            </View>
            <View style={styles.addressContainer}>
              <Text style={styles.addressLabel}>TO</Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {formatAddress(ride.drop_address)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Info */}
        <View style={styles.quickInfo}>
          <View style={styles.quickInfoItem}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color="#6c757d" />
            <Text style={styles.quickInfoText}>{ride.route_info?.distance || 0} km</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#6c757d" />
            <Text style={styles.quickInfoText}>
              {getRideDuration(ride.ride_started_at, ride.ride_ended_at)}
            </Text>
          </View>
          <View style={styles.quickInfoItem}>
            <MaterialCommunityIcons name="car" size={16} color="#6c757d" />
            <Text style={styles.quickInfoText}>{ride.vehicle_type}</Text>
          </View>
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={styles.expandedDetails}>
            <View style={styles.detailsRow}>
              <Text style={styles.detailLabel}>Payment Method:</Text>
              <Text style={styles.detailValue}>{ride.payment_method}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailLabel}>Payment Status:</Text>
              <Text style={[styles.detailValue, { 
                color: ride.payment_status === 'completed' ? '#28a745' : '#dc3545' 
              }]}>
                {ride.payment_status}
              </Text>
            </View>
            {ride.ride_otp && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailLabel}>OTP:</Text>
                <Text style={styles.detailValue}>{ride.ride_otp}</Text>
              </View>
            )}
            
            {/* Fare Breakdown */}
            {ride.pricing && (
              <View style={styles.fareBreakdown}>
                <Text style={styles.fareBreakdownTitle}>Fare Breakdown</Text>
                <View style={styles.fareItem}>
                  <Text style={styles.fareLabel}>Base Fare</Text>
                  <Text style={styles.fareValue}>₹{ride.pricing.base_fare}</Text>
                </View>
                <View style={styles.fareItem}>
                  <Text style={styles.fareLabel}>Distance Fare</Text>
                  <Text style={styles.fareValue}>₹{ride.pricing.distance_fare}</Text>
                </View>
                <View style={styles.fareItem}>
                  <Text style={styles.fareLabel}>Time Fare</Text>
                  <Text style={styles.fareValue}>₹{ride.pricing.time_fare}</Text>
                </View>
                {ride.pricing.night_charge > 0 && (
                  <View style={styles.fareItem}>
                    <Text style={styles.fareLabel}>Night Charge</Text>
                    <Text style={styles.fareValue}>₹{ride.pricing.night_charge}</Text>
                  </View>
                )}
                <View style={styles.fareItem}>
                  <Text style={styles.fareLabel}>Platform Fee</Text>
                  <Text style={styles.fareValue}>₹{ride.pricing.platform_fee}</Text>
                </View>
                <View style={[styles.fareItem, styles.totalFare]}>
                  <Text style={styles.totalFareLabel}>Total</Text>
                  <Text style={styles.totalFareValue}>₹{ride.pricing.total_fare}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Expand/Collapse Icon */}
        <View style={styles.expandIcon}>
          <MaterialCommunityIcons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#6c757d"
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderNew />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading rides...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <HeaderNew />
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={50} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAllRides}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderNew />
      
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007bff']}
            tintColor="#007bff"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>All Rides</Text>
          <Text style={styles.headerSubtitle}>
            {filteredRides.length} ride{filteredRides.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Filter Buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {renderFilterButton('all', 'All', 'view-list')}
          {renderFilterButton('today', 'Today', 'calendar-today')}
          {renderFilterButton('week', 'This Week', 'calendar-week')}
          {renderFilterButton('completed', 'Completed', 'check-circle')}
          {renderFilterButton('cancelled', 'Cancelled', 'cancel')}
        </ScrollView>

        {/* Rides List */}
        {filteredRides.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="car-off" size={60} color="#6c757d" />
            <Text style={styles.emptyTitle}>No rides found</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'all' 
                ? "You haven't taken any rides yet" 
                : `No rides found for ${activeFilter} filter`}
            </Text>
          </View>
        ) : (
          <View style={styles.ridesContainer}>
            {filteredRides.map((ride) => renderRideCard({ item: ride }))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6c757d',
  },
  filterContainer: {
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007bff',
    backgroundColor: '#fff',
  },
  activeFilterButton: {
    backgroundColor: '#007bff',
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#007bff',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  ridesContainer: {
    gap: 16,
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rideHeaderText: {
    marginLeft: 12,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  rideTime: {
    fontSize: 14,
    color: '#6c757d',
  },
  rideHeaderRight: {
    alignItems: 'flex-end',
  },
  rideStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  rideFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  routeIndicator: {
    alignItems: 'center',
    marginRight: 16,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#28a745',
  },
  routeLine: {
    width: 2,
    height: 40,
    backgroundColor: '#dee2e6',
    marginVertical: 4,
  },
  dropDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dc3545',
  },
  routeAddresses: {
    flex: 1,
    justifyContent: 'space-between',
  },
  addressContainer: {
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
  },
  quickInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickInfoText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6c757d',
  },
  expandedDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  fareBreakdown: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  fareBreakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  fareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
  },
  totalFare: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  totalFareLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  totalFareValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
  },
  expandIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#212529',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
});