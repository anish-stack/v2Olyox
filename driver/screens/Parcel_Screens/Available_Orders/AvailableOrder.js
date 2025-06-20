import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, TextInput, StyleSheet, FlatList, Dimensions } from 'react-native';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import * as Location from 'expo-location';
import axios from 'axios';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const API_END_POINT_URL = `http://192.168.1.6:3100/api/v1/parcel`;
const { width } = Dimensions.get('window');

export default function AvailableOrder() {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [location, setLocation] = useState(null);
    const [radius, setRadius] = useState(5000);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation()
    const [errorMsg, setErrorMsg] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [priceFilter, setPriceFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Get current location
    useEffect(() => {
        async function getCurrentLocation() {
            let { status } = await Location.requestForegroundPermissionsAsync();
            console.log("status", status)
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location.coords);
        }

        getCurrentLocation();
    }, []);

    // Fetch orders based on location and radius
    const fetchParcelOrders = useCallback(async () => {
        if (location && location.latitude && location.longitude) {
            setLoading(true);
            try {
                const response = await axios.get(
                    `${API_END_POINT_URL}/get-My-Near-Parcel?lat=${location.latitude}&lng=${location.longitude}&radius=${radius}`
                );
                setOrders(response.data.data || []);
            } catch (error) {
                console.log(error);
                setErrorMsg('Failed to fetch orders');
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        } else {
            console.log("Location not yet available");
        }
    }, [location, radius]);

    useEffect(() => {
        fetchParcelOrders();
    }, [fetchParcelOrders]);

    // Handle refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchParcelOrders();
    }, [fetchParcelOrders]);

    // Filter orders by price
    const filterOrdersByPrice = useCallback((priceType) => {
        setPriceFilter(priceType);
    }, []);

    // Apply filters and search using useMemo
    const processedOrders = useMemo(() => {
        let result = [...orders];

        // Apply search filter
        if (searchQuery) {
            result = result.filter(order =>
                order.locations.pickup.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.locations.dropoff.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order._id.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply price filter
        if (priceFilter !== 'all') {
            if (priceFilter === 'low') {
                result = result.filter(order => order.fares.netFare < 300);
            } else if (priceFilter === 'medium') {
                result = result.filter(order => order.fares.netFare >= 300 && order.fares.netFare <= 600);
            } else if (priceFilter === 'high') {
                result = result.filter(order => order.fares.netFare > 600);
            }
        }

        setFilteredOrders(result);
        return result;
    }, [orders, searchQuery, priceFilter]);

    // Pagination
    const paginatedOrders = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedOrders.slice(startIndex, startIndex + itemsPerPage);
    }, [processedOrders, currentPage]);

    const totalPages = useMemo(() => {
        return Math.ceil(processedOrders.length / itemsPerPage);
    }, [processedOrders]);

    const renderOrderItem = ({ item }) => (
        <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
                <View style={styles.orderIdContainer}>
                    <Text style={styles.orderId}>Order ID: {item.ride_id.substring(item.ride_id.length - 8)}</Text>
                    <View style={[styles.statusBadge,
                    item.status === 'pending' ? styles.pendingBadge :
                        item.status === 'completed' ? styles.completedBadge : styles.otherBadge]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>
                <Text style={styles.distance}>{item.km_of_ride.toFixed(1)} km</Text>
            </View>

            <View style={styles.locationContainer}>
                <View style={styles.locationRow}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="location" size={20} color="#4CAF50" />
                    </View>
                    <Text style={styles.addressText} numberOfLines={2}>{item.locations.pickup.address}</Text>
                </View>

                <View style={styles.verticalLine} />

                <View style={styles.locationRow}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="location" size={20} color="#F44336" />
                    </View>
                    <Text style={styles.addressText} numberOfLines={2}>{item.locations.dropoff.address}</Text>
                </View>
            </View>

            <View style={styles.fareContainer}>
                <View style={styles.fareDetails}>
                    <Text style={styles.fareLabel}>Base Fare:</Text>
                    <Text style={styles.fareValue}>₹{item.fares.baseFare}</Text>
                </View>

                {item.fares.discount > 0 && (
                    <View style={styles.fareDetails}>
                        <Text style={styles.fareLabel}>Discount:</Text>
                        <Text style={styles.discountValue}>-₹{item.fares.discount}</Text>
                    </View>
                )}

                <View style={styles.fareDetails}>
                    <Text style={styles.fareLabel}>Total Fare:</Text>
                    <Text style={styles.totalFare}>₹{item.fares.payableAmount}</Text>
                </View>
            </View>

            <TouchableOpacity
                onPress={() =>
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'ParcelDetails', params: { parcelId: item._id } }],
                    })
                }
                style={styles.viewDetailsButton}
            >
                <Text style={styles.viewDetailsText}>View Details</Text>
                <MaterialIcons name="arrow-forward-ios" size={16} color="#ffffff" />
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.container}>
                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Available Orders</Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                        <Ionicons name="refresh" size={24} color="#007BFF" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by address or order ID"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <View style={styles.filterContainer}>
                    <Text style={styles.filterLabel}>Filter by Price:</Text>
                    <View style={styles.filterButtons}>
                        <TouchableOpacity
                            style={[styles.filterButton, priceFilter === 'all' && styles.activeFilter]}
                            onPress={() => filterOrdersByPrice('all')}>
                            <Text style={[styles.filterButtonText, priceFilter === 'all' && styles.activeFilterText]}>All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterButton, priceFilter === 'low' && styles.activeFilter]}
                            onPress={() => filterOrdersByPrice('low')}>
                            <Text style={[styles.filterButtonText, priceFilter === 'low' && styles.activeFilterText]}>Low</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterButton, priceFilter === 'medium' && styles.activeFilter]}
                            onPress={() => filterOrdersByPrice('medium')}>
                            <Text style={[styles.filterButtonText, priceFilter === 'medium' && styles.activeFilterText]}>Medium</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterButton, priceFilter === 'high' && styles.activeFilter]}
                            onPress={() => filterOrdersByPrice('high')}>
                            <Text style={[styles.filterButtonText, priceFilter === 'high' && styles.activeFilterText]}>High</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.radiusContainer}>
                    <Text style={styles.radiusLabel}>Search Radius: {(radius / 1000).toFixed(1)} km</Text>
                    <View style={styles.radiusButtons}>
                        <TouchableOpacity
                            style={[styles.radiusButton, radius === 2000 && styles.activeRadius]}
                            onPress={() => setRadius(2000)}>
                            <Text style={styles.radiusButtonText}>2 km</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.radiusButton, radius === 5000 && styles.activeRadius]}
                            onPress={() => setRadius(5000)}>
                            <Text style={styles.radiusButtonText}>5 km</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.radiusButton, radius === 10000 && styles.activeRadius]}
                            onPress={() => setRadius(10000)}>
                            <Text style={styles.radiusButtonText}>10 km</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.radiusButton, radius === 20000 && styles.activeRadius]}
                            onPress={() => setRadius(20000)}>
                            <Text style={styles.radiusButtonText}>20 km</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#007BFF" />
                        <Text style={styles.loadingText}>Loading orders...</Text>
                    </View>
                ) : (
                    <>
                        <FlatList
                            data={paginatedOrders}
                            renderItem={renderOrderItem}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.listContainer}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#007BFF"]} />
                            }
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="document-text-outline" size={50} color="#ccc" />
                                    <Text style={styles.emptyText}>No orders available</Text>
                                    <Text style={styles.emptySubText}>Try adjusting your filters or radius</Text>
                                </View>
                            }
                        />

                        {processedOrders.length > 0 && (
                            <View style={styles.paginationContainer}>
                                <TouchableOpacity
                                    style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
                                    onPress={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}>
                                    <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#ccc" : "#007BFF"} />
                                </TouchableOpacity>

                                <Text style={styles.paginationText}>
                                    Page {currentPage} of {totalPages}
                                </Text>

                                <TouchableOpacity
                                    style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
                                    onPress={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}>
                                    <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#ccc" : "#007BFF"} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>
        </SafeAreaView>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    refreshButton: {
        padding: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 46,
        fontSize: 16,
    },
    filterContainer: {
        marginBottom: 16,
    },
    filterLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    filterButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    filterButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    activeFilter: {
        backgroundColor: '#007BFF',
        borderColor: '#007BFF',
    },
    filterButtonText: {
        fontSize: 14,
        color: '#666',
    },
    activeFilterText: {
        color: '#fff',
        fontWeight: '600',
    },
    radiusContainer: {
        marginBottom: 16,
    },
    radiusLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        color: '#333',
    },
    radiusButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    radiusButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    activeRadius: {
        backgroundColor: '#007BFF',
        borderColor: '#007BFF',
    },
    radiusButtonText: {
        fontSize: 14,
        color: '#666',
    },
    listContainer: {
        paddingBottom: 16,
    },
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    orderIdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderId: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    pendingBadge: {
        backgroundColor: '#FFF9C4',
    },
    completedBadge: {
        backgroundColor: '#C8E6C9',
    },
    otherBadge: {
        backgroundColor: '#E1F5FE',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    distance: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    locationContainer: {
        marginBottom: 16,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    iconContainer: {
        width: 30,
        alignItems: 'center',
        marginRight: 8,
    },
    verticalLine: {
        width: 1,
        height: 20,
        backgroundColor: '#ddd',
        marginLeft: 15,
        marginVertical: 4,
    },
    addressText: {
        flex: 1,
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    fareContainer: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    fareDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    fareLabel: {
        fontSize: 14,
        color: '#666',
    },
    fareValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    discountValue: {
        fontSize: 14,
        color: '#4CAF50',
        fontWeight: '500',
    },
    totalFare: {
        fontSize: 16,
        color: '#333',
        fontWeight: 'bold',
    },
    viewDetailsButton: {
        backgroundColor: '#007BFF',
        borderRadius: 8,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewDetailsText: {
        color: '#fff',
        fontWeight: '600',
        marginRight: 4,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#666',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#999',
        marginTop: 8,
    },
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: "center"
    }
})