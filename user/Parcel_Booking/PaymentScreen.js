import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    Image,
    Alert,
    Modal,
    Pressable
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { find_me } from '../utils/helpers';
import { useSocket } from '../context/SocketContext';

const PaymentScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { orderDetails } = route.params || {};
    const { isConnected, socket, userId } = useSocket();

    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCoupon, setSelectedCoupon] = useState(null);
    const [finalAmount, setFinalAmount] = useState(
        orderDetails?.fares?.payableAmount || 0
    );
    const [couponModalVisible, setCouponModalVisible] = useState(false);
    const [addressModalVisible, setAddressModalVisible] = useState(false);

    // Fetch coupons
    useEffect(() => {
        fetchCoupons();
    }, []);

    // Calculate final amount when coupon is selected
    useEffect(() => {
        if (selectedCoupon && orderDetails?.fares) {
            const discount = Math.min(selectedCoupon.discount, orderDetails.fares.payableAmount);
            setFinalAmount(orderDetails.fares.payableAmount - discount);
        } else if (orderDetails?.fares) {
            setFinalAmount(orderDetails.fares.payableAmount);
        }
    }, [selectedCoupon, orderDetails]);

    const fetchCoupons = async () => {
        setLoading(true);
        try {
            const response = await axios.get('https://appapi.olyox.com/api/v1/parcel/parcel-coupon');
            if (response.data.success) {
                setCoupons(response.data.data);
            } else {
                setError('Failed to fetch coupons');
            }
        } catch (err) {
            setError('Network error. Please try again.');
            console.error('Error fetching coupons:', err);
        } finally {
            setLoading(false);
        }
    };

    // Calculate days left for coupon expiration
    const getDaysLeft = (expirationDate) => {
        const today = new Date();
        const expDate = new Date(expirationDate);
        const diffTime = Math.abs(expDate - today);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Filter active coupons and memoize the result
    const activeCoupons = useMemo(() => {
        return coupons.filter(coupon =>
            coupon.isActive && new Date(coupon.expirationDate) > new Date()
        );
    }, [coupons]);

    const applyCoupon = (coupon) => {
        setSelectedCoupon(coupon);
        setCouponModalVisible(false);
        Alert.alert(
            "Coupon Applied",
            `${coupon.code} applied successfully! You saved ₹${coupon.discount}`,
            [{ text: "OK" }]
        );
    };


    const handleSubmitBooking = async () => {
        try {
            Alert.alert(
                "Confirm Booking",
                "Are you sure you want to confirm this parcel booking?",
                [
                    {
                        text: "Cancel",
                        style: "cancel"
                    },
                    {
                        text: "Confirm",
                        onPress: async () => {
                            try {
                                setLoading(true)
                                const user = await find_me();
                                if (user?.user) {
                                    const updatedOrderDetails = {
                                        ...orderDetails,
                                        is_booking_completed: true,
                                        userId: user.user._id,
                                        fares: {
                                            ...orderDetails.fares,
                                            baseFare: orderDetails?.fares?.payableAmount || 50,
                                            couponApplied: selectedCoupon ? true : false,
                                            discount: selectedCoupon ? finalAmount - orderDetails.fares.payableAmount : 0,
                                            payableAmount: finalAmount
                                        }
                                    };

                                    const response = await axios.post(
                                        'https://appapi.olyox.com/api/v1/parcel/book-parcel',
                                        updatedOrderDetails
                                    );

                                    if (response?.data?.success) {

                                        Alert.alert("Success", "Parcel booked successfully!");
                                        // navigation.reset({
                                        //     index: 0,
                                        //     routes: [{ name: 'Booking_Complete_Find_Rider', params: { id: response.booking_id } }],
                                        // })
                                        navigation.navigate('Booking_Complete_Find_Rider', { id: response?.data?.booking_id });
                                    } else {
                                        // Alert.alert("Failed", "Failed to book parcel. Please try again.");
                                    }
                                    setLoading(false)

                                } else {
                                    Alert.alert("Error", "User not found.");
                                }
                                setLoading(false)

                            } catch (err) {
                                console.error("Booking Error:", err).response.data;
                                setLoading(false)

                                Alert.alert("Error", "Something went wrong while booking the parcel.");
                            }
                        }
                    }
                ]
            );
        } catch (err) {
            console.error("Alert Error:", err);
            Alert.alert("Error", "Something went wrong.");
        }
    };


    useEffect(() => {
        let socketInstance = socket();

        const handleParcelConfirm = (response) => {
            console.log("Socket response", response);
            if (response.success) {
                Alert.alert("Success", "Parcel booked successfully!");
                // navigation.reset({
                //     index: 0,
                //     routes: [{ name: 'Booking_Complete_Find_Rider', params: { id: response.parcel } }],
                // })
                navigation.navigate('Booking_Complete_Find_Rider', { id: response.parcel });

            } else {
                // Alert.alert("Failed", "Failed to book parcel. Please try again.");
            }
        };

        socketInstance.on("your_parcel_is_confirm", handleParcelConfirm);

        return () => {
            socketInstance.off("your_parcel_is_confirm", handleParcelConfirm);
        };
    }, []);



    const removeCoupon = () => {
        setSelectedCoupon(null);
        Alert.alert(
            "Coupon Removed",
            "Coupon has been removed successfully",
            [{ text: "OK" }]
        );
    };

    const renderPickupDropDetails = () => (
        <View style={styles.locationContainer}>
            <View style={styles.locationHeader}>
                <Image
                    source={{ uri: orderDetails?.vehicle_info?.image?.url || 'https://res.cloudinary.com/daxbcusb5/image/upload/v1745132956/parcel_vehicles/vehicles/pphtlimv6seosz86micr.jpg' }}
                    style={styles.vehicleImage}
                />
                <View style={styles.locationHeaderText}>
                    <Text style={styles.vehicleTitle}>{orderDetails?.vehicle_info?.title || "Compact 3W"}</Text>
                    <TouchableOpacity onPress={() => setAddressModalVisible(true)}>
                        <Text style={styles.viewAddressText}>View Address Details</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.etaContainer}>
                    <Text style={styles.etaValue}>3</Text>
                    <Text style={styles.etaLabel}>mins away</Text>
                </View>
            </View>

            <View style={styles.loadingTimeContainer}>
                <Ionicons name="time-outline" size={18} color="#555" />
                <Text style={styles.loadingTimeText}>
                    Free 25 mins of loading-unloading time included.
                </Text>
            </View>
        </View>
    );

    const renderCouponButton = () => (
        <TouchableOpacity
            style={styles.couponButton}
            onPress={() => setCouponModalVisible(true)}
        >
            <View style={styles.couponButtonContent}>
                <View style={styles.couponButtonLeft}>
                    <Ionicons name="ticket-outline" size={20} color="#E53935" />
                    <Text style={styles.couponButtonText}>
                        {selectedCoupon ? `${selectedCoupon.code} Applied` : 'Available Coupons'}
                    </Text>
                </View>
                <View style={styles.couponButtonRight}>
                    {selectedCoupon ? (
                        <TouchableOpacity
                            style={styles.removeCouponButton}
                            onPress={removeCoupon}
                        >
                            <Text style={styles.removeCouponText}>REMOVE</Text>
                        </TouchableOpacity>
                    ) : (
                        <Ionicons name="chevron-forward" size={20} color="#E53935" />
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderCouponModal = () => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={couponModalVisible}
            onRequestClose={() => setCouponModalVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Available Coupons</Text>
                        <TouchableOpacity onPress={() => setCouponModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#E53935" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#E53935" />
                            <Text style={styles.loadingText}>Loading coupons...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle-outline" size={24} color="#E53935" />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={fetchCoupons}>
                                <Text style={styles.retryButtonText}>Retry</Text>
                            </TouchableOpacity>
                        </View>
                    ) : activeCoupons.length === 0 ? (
                        <View style={styles.noCouponsContainer}>
                            <Ionicons name="ticket-outline" size={24} color="#888" />
                            <Text style={styles.noCouponsText}>No active coupons available</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.couponsList}>
                            {activeCoupons.map((coupon) => (
                                <TouchableOpacity
                                    key={coupon._id}
                                    style={[
                                        styles.couponCard,
                                        selectedCoupon?._id === coupon._id && styles.selectedCouponCard
                                    ]}
                                    onPress={() => applyCoupon(coupon)}
                                >
                                    <LinearGradient
                                        colors={['#FFFFFF', '#FFF0F0']}
                                        style={styles.couponGradient}
                                    >
                                        <View style={styles.couponLeft}>
                                            <View style={styles.discountBadge}>
                                                <Text style={styles.discountText}>₹{coupon.discount} OFF</Text>
                                            </View>
                                            <Text style={styles.couponCode}>{coupon.code}</Text>
                                            <Text style={styles.expiryText}>
                                                Expires in {getDaysLeft(coupon.expirationDate)} days
                                            </Text>
                                        </View>
                                        <View style={styles.couponDivider} />
                                        <View style={styles.couponRight}>
                                            <TouchableOpacity
                                                style={styles.applyButton}
                                                onPress={() => applyCoupon(coupon)}
                                            >
                                                <Text style={styles.applyButtonText}>
                                                    {selectedCoupon?._id === coupon._id ? 'APPLIED' : 'APPLY'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );

    const renderAddressModal = () => (
        <Modal
            animationType="slide"
            transparent={true}
            visible={addressModalVisible}
            onRequestClose={() => setAddressModalVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Address Details</Text>
                        <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#E53935" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.addressContent}>
                        <View style={styles.addressSection}>
                            <Text style={styles.addressSectionTitle}>Pickup Location</Text>
                            <Text style={styles.addressText}>{orderDetails?.pickup?.address || "Not available"}</Text>
                            {orderDetails?.pickup?.coordinates && (
                                <Text style={styles.coordinatesText}>
                                    Lat: {orderDetails.pickup.coordinates.lat}, Lng: {orderDetails.pickup.coordinates.lng}
                                </Text>
                            )}
                        </View>

                        <View style={styles.addressDivider} />

                        <View style={styles.addressSection}>
                            <Text style={styles.addressSectionTitle}>Dropoff Location</Text>
                            <Text style={styles.addressText}>{orderDetails?.dropoff?.address || "Not available"}</Text>
                            {orderDetails?.dropoff?.coordinates && (
                                <Text style={styles.coordinatesText}>
                                    Lat: {orderDetails.dropoff.coordinates.lat}, Lng: {orderDetails.dropoff.coordinates.lng}
                                </Text>
                            )}
                        </View>

                        <View style={styles.addressDivider} />

                        <View style={styles.addressSection}>
                            <Text style={styles.addressSectionTitle}>Receiver Details</Text>
                            <Text style={styles.receiverName}>Name: {orderDetails?.receiver?.name || "Not available"}</Text>
                            <Text style={styles.receiverPhone}>Phone: {orderDetails?.receiver?.phone || "Not available"}</Text>
                            {orderDetails?.receiver?.apartment && (
                                <Text style={styles.receiverApartment}>Apartment: {orderDetails.receiver.apartment}</Text>
                            )}
                            {orderDetails?.receiver?.savedAs && (
                                <Text style={styles.receiverSavedAs}>Saved as: {orderDetails.receiver.savedAs}</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    const renderFareSummary = () => (
        <View style={styles.fareSummaryContainer}>
            <Text style={styles.sectionTitle}>Fare Summary</Text>
            <View style={styles.fareCard}>
                <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Trip Fare (incl. Toll)</Text>
                    <Text style={styles.fareValue}>₹{orderDetails?.fares?.payableAmount || 0}</Text>
                </View>

                {selectedCoupon && (
                    <View style={styles.fareRow}>
                        <Text style={styles.discountLabel}>Discount ({selectedCoupon.code})</Text>
                        <Text style={styles.discountValue}>-₹{selectedCoupon.discount}</Text>
                    </View>
                )}

                <View style={styles.separator} />

                <View style={styles.fareRow}>
                    <Text style={styles.netFareLabel}>Net Fare</Text>
                    <Text style={styles.netFareValue}>₹{finalAmount}</Text>
                </View>

                <View style={styles.fareRow}>
                    <Text style={styles.amountLabel}>Amount Payable (rounded)</Text>
                    <Text style={styles.amountValue}>₹{Math.round(finalAmount)}</Text>
                </View>
            </View>
        </View>
    );

    const renderPaymentMethod = () => (
        <View style={styles.paymentMethodContainer}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentCard}>
                <View style={styles.paymentOption}>
                    <View style={styles.paymentOptionLeft}>
                        <Ionicons name="cash-outline" size={24} color="#E53935" />
                        <Text style={styles.paymentOptionText}>Cash</Text>
                    </View>
                    <View style={styles.radioButton}>
                        <View style={styles.radioButtonInner} />
                    </View>
                </View>
            </View>
        </View>
    );

    const renderBookingNotes = () => (
        <View style={styles.notesContainer}>
            <Text style={styles.sectionTitle}>Read before Booking</Text>
            <View style={styles.notesCard}>
                <View style={styles.noteItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.noteText}>Fare includes 25 mins free loading/unloading time.</Text>
                </View>
                <View style={styles.noteItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.noteText}>₹ 2.0/min for additional loading/unloading time.</Text>
                </View>
                <View style={styles.noteItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.noteText}>Fare may vary as per market conditions.</Text>
                </View>
                <View style={styles.noteItem}>
                    <Text style={styles.bulletPoint}>•</Text>
                    <Text style={styles.noteText}>Fare may change if route or location changes.</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
                {renderPickupDropDetails()}

                <View style={styles.offersContainer}>
                    <Text style={styles.sectionTitle}>Offers and Discounts</Text>
                    {renderCouponButton()}
                </View>

                {renderFareSummary()}
                {renderPaymentMethod()}
                {renderBookingNotes()}

                <View style={styles.spacer} />
            </ScrollView>

            {renderCouponModal()}
            {renderAddressModal()}

            <View style={styles.footer}>
                <TouchableOpacity onPress={() => handleSubmitBooking()} style={styles.proceedButton}>
                    <LinearGradient
                        colors={['#E53935', '#C62828']}
                        style={styles.gradientButton}
                    >
                        <Text style={styles.proceedButtonText}>Proceed to Booking</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        paddingTop: Platform.OS === 'ios' ? 0 : 16,
    },
    scrollView: {
        flex: 1,
    },
    locationContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        margin: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    vehicleImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    locationHeaderText: {
        flex: 1,
        marginLeft: 12,
    },
    vehicleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 4,
    },
    viewAddressText: {
        fontSize: 13,
        color: '#E53935',
        fontWeight: '600',
    },
    etaContainer: {
        alignItems: 'flex-end',
    },
    etaValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#E53935',
    },
    etaLabel: {
        fontSize: 13,
        color: '#666666',
    },
    loadingTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        borderRadius: 8,
        padding: 12,
        marginTop: 16,
    },
    loadingTimeText: {
        marginLeft: 8,
        fontSize: 13,
        fontWeight: '500',
        color: '#333333',
    },
    offersContainer: {
        margin: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 12,
    },
    couponButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    couponButtonContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    couponButtonLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    couponButtonText: {
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
    },
    couponButtonRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    removeCouponButton: {
        backgroundColor: '#FFEBEE',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
    },
    removeCouponText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#E53935',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333333',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666666',
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    errorText: {
        marginTop: 8,
        fontSize: 14,
        color: '#E53935',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#E53935',
        borderRadius: 4,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '500',
    },
    noCouponsContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    noCouponsText: {
        marginTop: 8,
        fontSize: 14,
        color: '#666666',
    },
    couponsList: {
        padding: 16,
        maxHeight: 400,
    },
    couponCard: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    selectedCouponCard: {
        borderColor: '#E53935',
        borderWidth: 2,
    },
    couponGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    couponLeft: {
        flex: 1,
    },
    discountBadge: {
        backgroundColor: '#E53935',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    discountText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },
    couponCode: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333333',
        marginBottom: 4,
    },
    expiryText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#666666',
    },
    couponDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#EEEEEE',
        marginHorizontal: 16,
    },
    couponRight: {
        justifyContent: 'center',
    },
    applyButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#E53935',
        borderRadius: 4,
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 12,
    },
    addressContent: {
        padding: 16,
        maxHeight: 400,
    },
    addressSection: {
        marginBottom: 16,
    },
    addressSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#E53935',
        marginBottom: 8,
    },
    addressText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 4,
        lineHeight: 20,
    },
    coordinatesText: {
        fontSize: 12,
        color: '#666666',
    },
    addressDivider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        marginVertical: 16,
    },
    receiverName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333333',
        marginBottom: 4,
    },
    receiverPhone: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 4,
    },
    receiverApartment: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
        marginBottom: 4,
    },
    receiverSavedAs: {
        fontSize: 14,
        fontWeight: '500',
        color: '#333333',
    },
    fareSummaryContainer: {
        margin: 16,
        marginTop: 0,
    },
    fareCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    fareRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    fareLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#666666',
    },
    fareValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    discountLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#E53935',
    },
    discountValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#E53935',
    },
    separator: {
        height: 1,
        backgroundColor: '#EEEEEE',
        marginVertical: 12,
    },
    netFareLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    netFareValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    amountLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333333',
    },
    amountValue: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333333',
    },
    paymentMethodContainer: {
        margin: 16,
        marginTop: 0,
    },
    paymentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    paymentOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    paymentOptionText: {
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '600',
        color: '#E53935',
    },
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E53935',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E53935',
    },
    notesContainer: {
        margin: 16,
        marginTop: 0,
    },
    notesCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    noteItem: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    bulletPoint: {
        fontSize: 16,
        color: '#666666',
        marginRight: 8,
    },
    noteText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#666666',
        lineHeight: 18,
    },
    spacer: {
        height: 80,
    },
    footer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40:0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
    },
    proceedButton: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    gradientButton: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    proceedButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default PaymentScreen;