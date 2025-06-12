import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
  } from 'react-native';
  import React, { useEffect, useState, useCallback } from 'react';
  import * as SecureStore from 'expo-secure-store';
  import axios from 'axios';
  import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
  import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
  
  import { useNavigation } from "@react-navigation/native";

  
  export default function AllRides() {
    const [allRides, setAllRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedRide, setExpandedRide] = useState(null);
    const [searchDates, setSearchDates] = useState({ start: '', end: '' });
    const [activeFilter, setActiveFilter] = useState('all');
    const navigation = useNavigation()
    const fetchAllRides = async () => {
      try {
        const token = await SecureStore.getItemAsync('auth_token_cab');
        if (!token) {
          setError('Authentication token not found');
          return;
        }
  
        const response = await axios.get(
          'https://appapi.olyox.com/api/v1/rider/getMyAllRides',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
  
        setAllRides(response.data.data);
        console.log(response.data.data)
        setError(null);
      } catch (err) {
        console.error('Error fetching rides:', err);
        setError('Failed to fetch rides. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
  
    useEffect(() => {
      fetchAllRides();
    }, []);
  
    const onRefresh = useCallback(() => {
      setRefreshing(true);
      fetchAllRides();
    }, []);
  
    const filterRides = (rides) => {
      let filteredRides = [...rides];
  
      // Apply date range filter if both dates are provided
      if (searchDates.start && searchDates.end) {
        const startDate = new Date(searchDates.start);
        const endDate = new Date(searchDates.end);
        filteredRides = filteredRides.filter((ride) => {
          const rideDate = parseISO(ride.createdAt);
          return rideDate >= startDate && rideDate <= endDate;
        });
      }
  
      // Apply time-based filters
      switch (activeFilter) {
        case 'today':
          return filteredRides.filter((ride) =>
            isToday(parseISO(ride.createdAt))
          );
        case 'tomorrow':
          return filteredRides.filter((ride) =>
            console.log(parseISO(ride.createdAt))
            // isTomorrow(parseISO(ride.createdAt))
          );
        case 'week':
          return filteredRides.filter((ride) =>
            isThisWeek(parseISO(ride.createdAt))
          );
        default:
          return filteredRides;
      }
    };

    const findRideCompleteTime= (startTime,endTime)=>{
      const startTimeObject = new Date(startTime);
      const endTimeObject = new Date(endTime);
      const timeDifference = endTimeObject - startTimeObject; // in milliseconds
      const hours = Math.floor(timeDifference / (1000 * 60 * 60));
      const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDifference % (1000 * 60)) / 100)

      return `${hours}h ${minutes}m ${seconds}s`;

    }
  
    const getStatusColor = (status) => {
      switch (status.toLowerCase()) {
        case 'accepted':
          return '#4CAF50';
        case 'completed':
          return '#2196F3';
        case 'cancelled':
          return '#F44336';
        default:
          return '#757575';
      }
    };
  
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading rides...</Text>
        </View>
      );
    }
  
    const filteredRides = filterRides(allRides);
//   console.log(filteredRides)
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Rides</Text>
        </View>
  
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                activeFilter === 'all' && styles.activeFilter,
              ]}
              onPress={() => setActiveFilter('all')}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === 'all' && styles.activeFilterText,
                ]}
              >
                All Rides
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                activeFilter === 'today' && styles.activeFilter,
              ]}
              onPress={() => setActiveFilter('today')}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === 'today' && styles.activeFilterText,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>
         
            <TouchableOpacity
              style={[
                styles.filterButton,
                activeFilter === 'week' && styles.activeFilter,
              ]}
              onPress={() => setActiveFilter('week')}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === 'week' && styles.activeFilterText,
                ]}
              >
                This Week
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
  
  
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchAllRides}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={styles.ridesList}
          >
            {filteredRides.length === 0 ? (
              <View style={styles.noRidesContainer}>
                <MaterialCommunityIcons
                  name="car-off"
                  size={48}
                  color="#757575"
                />
                <Text style={styles.noRidesText}>No rides found</Text>
              </View>
            ) : (
              filteredRides.map((ride) => (
                <TouchableOpacity
                  key={ride._id}
                  style={styles.rideCard}
                  onPress={() =>
                    setExpandedRide(expandedRide === ride._id ? null : ride._id)
                  }
                >
                  <View style={styles.rideHeader}>
                    <View style={styles.rideInfo}>
                      <Text style={styles.rideDate}>
                        {format(parseISO(ride.createdAt), 'MMM dd, yyyy HH:mm')}
                      </Text>
                      <View style={styles.rideStatusContainer}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(ride.rideStatus) },
                          ]}
                        />
                        <Text style={styles.rideStatus}>
                          {ride.rideStatus.charAt(0).toUpperCase() +
                            ride.rideStatus.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons
                      name={
                        expandedRide === ride._id
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={24}
                      color="#757575"
                    />
                    <TouchableOpacity onPress={()=> navigation.navigate('start',{
                      params:ride
                    })}>
                      <Text>Go</Text>
                    </TouchableOpacity>
                  </View>
  
                  {expandedRide === ride._id && (
                    <View style={styles.expandedContent}>
                      <View style={styles.locationContainer}>
                        <View style={styles.locationItem}>
                          <Ionicons
                            name="location"
                            size={20}
                            color="#4CAF50"
                          />
                          <Text style={styles.locationText}>
                            {ride.pickup_desc}
                          </Text>
                        </View>
                        <View style={styles.locationDivider} />
                        <View style={styles.locationItem}>
                          <Ionicons
                            name="location"
                            size={20}
                            color="#F44336"
                          />
                          <Text style={styles.locationText}>
                            {ride.drop_desc}
                          </Text>
                        </View>
                      </View>
  
                      <View style={styles.rideDetails}>
                        <View style={styles.detailItem}>
                          <MaterialCommunityIcons
                            name="currency-inr"
                            size={20}
                            color="#2196F3"
                          />
                          <Text style={styles.detailText}>
                            {ride.kmOfRide} Total Fare
                          </Text>
                        </View>
                        {ride.is_ride_paid && (

                        <View style={styles.detailItem}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={20}
                            color="#2196F3"
                          />
                          <Text style={styles.detailText}>
                            ETA: {findRideCompleteTime(ride.ride_start_time,ride.ride_end_time)}
                          </Text>
                        </View>
                        )}
                       
                      </View>
  
                      <View style={styles.rideStatus}>
                        <View style={styles.statusItem}>
                          <MaterialCommunityIcons
                            name={ride.is_ride_paid ? 'check-circle' : 'clock-outline'}
                            size={20}
                            color={ride.is_ride_paid ? '#4CAF50' : '#FFC107'}
                          />
                          <Text style={styles.statusText}>
                            {ride.is_ride_paid ? 'Paid' : 'Payment Pending'}
                          </Text>
                        </View>
                        <View style={styles.statusItem}>
                          <MaterialCommunityIcons
                            name={ride.ride_is_started ? 'car' : 'car-off'}
                            size={20}
                            color={ride.ride_is_started ? '#4CAF50' : '#757575'}
                          />
                          <Text style={styles.statusText}>
                            {ride.ride_is_started ? 'Ride Started' : 'Not Started'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F5F5F5',
    },
    header: {
      padding: 16,
      backgroundColor: '#FFB300',
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginTop: 40,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: '#757575',
    },
    filterContainer: {
      padding: 16,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      marginRight: 8,
      elevation: 2,
    },
    activeFilter: {
      backgroundColor: '#FFB300',
    },
    filterText: {
      color: '#757575',
      fontWeight: '500',
    },
    activeFilterText: {
      color: '#FFFFFF',
    },
    searchContainer: {
      padding: 16,
      backgroundColor: '#FFFFFF',
      margin: 16,
      borderRadius: 8,
      elevation: 2,
    },
    dateInputContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dateInput: {
      flex: 1,
      marginHorizontal: 4,
      padding: 8,
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 4,
    },
    ridesList: {
      padding: 16,
    },
    rideCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      elevation: 2,
    },
    rideHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rideInfo: {
      flex: 1,
    },
    rideDate: {
      fontSize: 16,
      fontWeight: '500',
      color: '#212121',
    },
    rideStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    rideStatus: {
      fontSize: 14,
      color: '#757575',
    },
    expandedContent: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#E0E0E0',
      paddingTop: 16,
    },
    locationContainer: {
      marginBottom: 16,
    },
    locationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    locationDivider: {
      height: 1,
      backgroundColor: '#E0E0E0',
      marginVertical: 8,
    },
    locationText: {
      marginLeft: 8,
      flex: 1,
      color: '#212121',
    },
    rideDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailText: {
      marginLeft: 4,
      color: '#212121',
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
    },
    statusText: {
      marginLeft: 4,
      color: '#212121',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    errorText: {
      fontSize: 16,
      color: '#F44336',
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      backgroundColor: '#2196F3',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '500',
    },
    noRidesContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    noRidesText: {
      fontSize: 16,
      color: '#757575',
      marginTop: 8,
    },
  });