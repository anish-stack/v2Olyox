import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const { width } = Dimensions.get('window');

const STATUS_COLORS = {
  accepted: '#34C759',
  pending: '#FF9500',
  completed: '#3366FF',
  cancelled: '#FF3B30',
  default: '#8E8E93'
};

export default function ProgressOrder() {
    const route = useRoute()
    const {id} = route.params || {}
  const navigation = useNavigation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await axios.get(`https://appapi.olyox.com/api/v1/rides/inProgressOrder/${id}`);
      if (response.data.success) {
        setOrders(response.data.inProgressOrders);
        setError(null);
      } else {
        setError('Failed to fetch orders');
      }
    } catch (err) {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleViewDetails = (orderId) => {
    navigation.navigate('DeliveryTracking', { parcelId: orderId });
  };

  const OrderCard = ({ order }) => {
    const { locations, fares, name, phone, status, ride_id ,_id } = order;
    const { pickup, dropoff } = locations;
    const { payableAmount } = fares;
    const statusColor = STATUS_COLORS[status] || STATUS_COLORS.default;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleViewDetails(_id)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.rideId}>#{ride_id}</Text>
            <Text style={styles.customerName}>{name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <View style={[styles.dot, styles.pickupDot]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {pickup.address}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <View style={[styles.dot, styles.dropoffDot]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {dropoff.address}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.contactInfo}>
            <Image 
              source={{ uri: 'https://images.pexels.com/photos/1549279/pexels-photo-1549279.jpeg' }}
              style={styles.contactIcon}
            />
            <Text style={styles.phoneText}>{phone}</Text>
          </View>
          <Text style={styles.fareText}>₹{payableAmount}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3366FF" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Image 
          source={{ uri: 'https://images.pexels.com/photos/4439425/pexels-photo-4439425.jpeg' }}
          style={styles.errorImage}
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchOrders}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Image 
          source={{ uri: 'https://images.pexels.com/photos/4439444/pexels-photo-4439444.jpeg' }}
          style={styles.errorImage}
        />
        <Text style={styles.noDataText}>No in-progress orders found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchOrders}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>In-Progress Orders</Text>
        <Text style={styles.orderCount}>{orders.length} Active</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={({ item }) => <OrderCard order={item} />}
        keyExtractor={(item) => item.ride_id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3366FF']}
            tintColor="#3366FF"
            title="Pull to refresh..."
            titleColor="#3366FF"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#3366FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  orderCount: {
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  rideId: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  pickupDot: {
    backgroundColor: '#34C759',
  },
  dropoffDot: {
    backgroundColor: '#FF3B30',
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E5EA',
    marginLeft: 5,
    marginVertical: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  phoneText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  fareText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3366FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorImage: {
    width: width * 0.5,
    height: width * 0.5,
    marginBottom: 24,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3366FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});