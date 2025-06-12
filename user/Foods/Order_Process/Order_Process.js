import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    Platform,
    Dimensions,
    Image,
    Animated,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRoute,useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { OrderStatusBar } from './OrderStatusBar';
import { OrderItems } from './OrderItems';
import { BillDetails } from './BillDetails';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_MAPS_APIKEY = 'AIzaSyBvyzqhO8Tq3SvpKLjW7I5RonYAtfOVIn8';
const { width, height } = Dimensions.get('window');

const OrderStatusScreen = ({ status, onBackPress }) => {
    const getStatusContent = () => {
        switch (status) {
            case 'Cancelled':
                return {
                    icon: 'close-circle',
                    title: 'Order Cancelled',
                    message: 'Sorry! Your order has been cancelled.',
                    color: '#FF5252'
                };
            case 'Delivered':
                return {
                    icon: 'check-circle',
                    title: 'Order Delivered',
                    message: 'Yay! Your order has been delivered.',
                    color: '#4CAF50'
                };
            default:
                return null;
        }
    };

    const content = getStatusContent();

    return (
        <SafeAreaView style={styles.statusScreenContainer}>
            <View style={styles.statusHeader}>
                <TouchableOpacity onPress={onBackPress} style={styles.headerButton}>
                    <Icon name="arrow-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Status</Text>
                <View style={styles.headerButton} />
            </View>

            <View style={styles.statusContent}>
                <Icon name={content.icon} size={80} color={content.color} />
                <Text style={[styles.statusTitle, { color: content.color }]}>
                    {content.title}
                </Text>
                <Text style={styles.statusMessage}>{content.message}</Text>

                <View style={styles.orderSummaryCard}>
                    <Text style={styles.summaryTitle}>Order Summary</Text>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Order ID</Text>
                        <Text style={styles.summaryValue}>#{orderId}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Status</Text>
                        <Text style={[styles.summaryValue, { color: content.color }]}>{status}</Text>
                    </View>
                    {status === 'Cancelled' && (
                        <TouchableOpacity style={styles.reorderButton}>
                            <Text style={styles.reorderButtonText}>Reorder Items</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
};
const OrderTracking = () => {
    const route = useRoute();
    const { order_id } = route.params || {};
    const [orderId, setOrderId] = useState('');
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showOptions, setShowOptions] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const navigation = useNavigation()

    useEffect(() => {
        findOrderId();
    }, []);

    useEffect(() => {
        if (orderId) {
            findOrderDetails();
        }
    }, [orderId]);

    useEffect(() => {
        if (order) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }).start();
        }
    }, [order]);

    const findOrderId = async () => {
        try {
            if (!order_id) {
                const ongoingOrder = JSON.parse(await SecureStore.getItemAsync('ongoing_order'));

                setOrderId(ongoingOrder);
            } else {
                setOrderId(order_id);
            }
        } catch (err) {
            setError('Failed to retrieve order ID');
            console.error('Error finding order ID:', err);
        }
    };

    const findOrderDetails = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(
                `https://appapi.olyox.com/api/v1/tiffin/get_order_by_id/${orderId}`
            );
            if (response.data.success) {
                setOrder(response.data.order);

                setSuccess('Order details retrieved successfully');
            } else {
                setError('Failed to fetch order details');
            }
        } catch (err) {
            setError('Error fetching order details');
            console.error('Error fetching order details:', err);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        if (order?.status === 'Cancelled' || order?.status === 'Delivered') {
            return (
                <OrderStatusScreen
                    status={order.status}
                    onBackPress={() => navigation.goBack()}
                />
            );
        }
    }, [orderId]);


    const reloadOrderDetails = () => {
        navigation.goBack()
    };

    const handleMenuOptionSelect = (option) => {
        switch (option) {
            case 'help':
                console.log('Help with order');
                break;
            case 'cancel':
                console.log('Cancel order');
                break;
            case 'rate':
                console.log('Rate restaurant');
                break;
            default:
                console.log('Invalid option');
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#4CAF50" />
                <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centerContainer}>
                <Icon name="alert-circle" size={50} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.centerContainer}>
                <Icon name="file-search" size={50} color="#FFA000" />
                <Text style={styles.noOrderText}>No order details found</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={reloadOrderDetails} style={styles.headerButton}>
                    <Icon name="arrow-left" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Tracking</Text>
                <TouchableOpacity
                    style={styles.headerButton}
                    onPress={() => setShowOptions(true)}
                >
                    <Icon name="dots-vertical" size={24} color="#333" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Order Status */}
                <Animated.View style={[styles.statusContainer, { opacity: fadeAnim }]}>
                    <OrderStatusBar currentStatus={order.status} />
                    <Text style={styles.estimatedTime}>Estimated Delivery: 35-40 mins</Text>
                </Animated.View>
                {order.status === "Out for Delivery" ? (
                    <View
                        style={{
                            backgroundColor: "#f8f9fa",
                            padding: 12,
                            borderRadius: 8,
                            marginVertical: 10,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 16,
                                fontWeight: "bold",
                                color: "#333",
                                marginBottom: 5,
                            }}
                        >
                            Delivery Rider Details 🚴‍♂️
                        </Text>
                        <Text style={{ fontSize: 14, color: "#555" }}>
                            Name: <Text style={{ fontWeight: "bold" }}>{order?.deliveryBoyName}</Text>
                        </Text>
                        <Text style={{ fontSize: 14, color: "#555" }}>
                            Phone:{" "}
                            <Text style={{ fontWeight: "bold", color: "#007bff" }}>
                                {order?.deliveryBoyPhone}
                            </Text>
                        </Text>
                        <Text style={{ fontSize: 14, color: "#555" }}>
                            Bike Number: <Text style={{ fontWeight: "bold" }}>{order?.deliveryBoyBikeNumber}</Text>
                        </Text>
                    </View>
                ) : null}


                {/* Map View */}
                <View style={styles.mapContainer}>
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={{
                            latitude: order.user_current_location.coordinates[1],
                            longitude: order.user_current_location.coordinates[0],
                            latitudeDelta: 0.0122,
                            longitudeDelta: 0.0121,
                        }}
                    >
                        <Marker
                            coordinate={{
                                latitude: order.user_current_location.coordinates[1],
                                longitude: order.user_current_location.coordinates[0],
                            }}
                            title="Your Location"
                        >
                            <Icon name="map-marker-account" size={35} color="#FC8019" />
                        </Marker>
                        <Marker
                            coordinate={{
                                latitude: order.restaurant.geo_location.coordinates[1],
                                longitude: order.restaurant.geo_location.coordinates[0],
                            }}
                            title={order.restaurant.restaurant_name}
                        >
                            <Icon name="store" size={35} color="#FC8019" />
                        </Marker>
                        <MapViewDirections
                            origin={{
                                latitude: order.restaurant.geo_location.coordinates[1],
                                longitude: order.restaurant.geo_location.coordinates[0],
                            }}
                            destination={{
                                latitude: order.user_current_location.coordinates[1],
                                longitude: order.user_current_location.coordinates[0],
                            }}
                            apikey={GOOGLE_MAPS_APIKEY}
                            strokeWidth={3}
                            strokeColor="#FC8019"
                            optimizeWaypoints={true}
                        />
                    </MapView>
                </View>

                {/* Restaurant Details */}
                <View style={styles.restaurantCard}>
                    <View style={styles.restaurantHeader}>
                        <Icon name="store" size={24} color="#FC8019" />
                        <View style={styles.restaurantInfo}>
                            <Text style={styles.restaurantName}>{order.restaurant.restaurant_name}</Text>
                            <Text style={styles.restaurantAddress}>
                                {order.restaurant.restaurant_address.street}, {order.restaurant.restaurant_address.city}
                            </Text>
                        </View>
                    </View>
                    {/* <View style={styles.orderInfoContainer}>
                        <Text style={styles.orderID}>Order ID: #{order.Order_Id}</Text>
                        <TouchableOpacity
                            style={styles.supportButton}
                            onPress={() => handleOptionPress('help')}
                        >
                            <Icon name="headphones" size={16} color="#FC8019" />
                            <Text style={styles.supportButtonText}>Support</Text>
                        </TouchableOpacity>
                    </View> */}
                </View>

                {/* Order Items */}
                {/* <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Order Details</Text>
                </View> */}
                <OrderItems items={order.items} />


                <BillDetails order={order} />

                {/* Delivery Address */}
                <View style={styles.addressCard}>
                    <View style={styles.addressHeader}>
                        <Icon name="map-marker" size={24} color="#FC8019" />
                        <Text style={styles.addressTitle}>Delivery Location</Text>
                    </View>
                    <View style={styles.addressInfo}>
                        <Text style={styles.addressText}>
                            {order.address_details.flatNo}, {order.address_details.street}
                        </Text>
                        {order.address_details.landmark && (
                            <Text style={styles.addressLandmark}>
                                Landmark: {order.address_details.landmark}
                            </Text>
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Custom Options Modal */}
            {/* <Modal
                visible={showOptions}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowOptions(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowOptions(false)}
                >
                    <View style={styles.optionsContainer}>
                        <TouchableOpacity
                            style={styles.optionItem}
                            onPress={() => handleOptionPress('help')}
                        >
                            <Icon name="help-circle" size={20} color="#666" />
                            <Text style={styles.optionText}>Need Help?</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.optionItem}
                            onPress={() => handleOptionPress('cancel')}
                        >
                            <Icon name="close-circle" size={20} color="#666" />
                            <Text style={styles.optionText}>Cancel Order</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal> */}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    container: {
        flex: 1,
        backgroundColor: '#F8F8F8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    headerButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333333',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    mapContainer: {
        height: height * 0.3,
        marginHorizontal: 16,
        marginVertical: 16,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    map: {
        flex: 1,
    },
    statusContainer: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        margin: 16,
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    estimatedTime: {
        fontSize: 14,
        color: '#666666',
        marginTop: 8,
        textAlign: 'center',
    },
    restaurantCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    restaurantHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    restaurantInfo: {
        marginLeft: 12,
        flex: 1,
    },
    restaurantName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333333',
    },
    restaurantAddress: {
        fontSize: 14,
        color: '#666666',
        marginTop: 4,
    },
    orderInfoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    orderID: {
        fontSize: 14,
        color: '#666666',
    },
    supportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 16,
        backgroundColor: '#FEF4EA',
    },
    supportButtonText: {
        marginLeft: 4,
        fontSize: 14,
        color: '#FC8019',
    },
    sectionContainer: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
        marginBottom: 12,
    },
    addressCard: {
        backgroundColor: '#FFFFFF',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    addressTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
        marginLeft: 12,
    },
    addressInfo: {
        marginLeft: 36,
    },
    addressText: {
        fontSize: 14,
        color: '#666666',
        lineHeight: 20,
    },
    addressLandmark: {
        fontSize: 14,
        color: '#666666',
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    optionsContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 8,
        margin: 16,
        marginTop: 60,
        width: 200,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
    },
    optionText: {
        marginLeft: 12,
        fontSize: 14,
        color: '#333333',
    },
    statusScreenContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    statusContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    statusTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
    },
    statusMessage: {
        fontSize: 16,
        color: '#666666',
        textAlign: 'center',
        marginBottom: 30,
    },
    orderSummaryCard: {
        backgroundColor: '#F8F8F8',
        borderRadius: 12,
        padding: 20,
        width: '100%',
        marginTop: 20,
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333333',
        marginBottom: 15,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666666',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
    },
    reorderButton: {
        backgroundColor: '#FC8019',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    reorderButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default OrderTracking;