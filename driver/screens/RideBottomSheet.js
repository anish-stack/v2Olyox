import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Animated,
    ScrollView,
    Linking,
    Platform,
    Alert,
    Image
} from 'react-native';
import { Text, Button, Divider, Card } from 'react-native-paper';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import useSettings from '../hooks/settings.hook';

const { width, height } = Dimensions.get('window');

const RideBottomSheet = React.memo(({
    state,
    updateState,
    rideStarted,
    showOtpModel,
    kmOfRide,
    distanceToPickup,
    timeToPickup,
    pickup_desc,
    drop_desc,
    showCancelModal,
    handleCompleteRide,
    openGoogleMapsDirectionsPickup,
    openGoogleMapsDirections,
    translateY,
    onGestureEvent,
    maxHeight,
    minHeight,
    rideDetails, // Added for payment and user details
}) => {
    const { settings } = useSettings()
    const scrollViewRef = useRef(null);
    const [activeTab, setActiveTab] = useState('ride'); // 'ride', 'payment', 'support'
    const fadeAnim = useRef(new Animated.Value(1)).current;
// console.log('state', state)
// console.log('state', updateState)
    // Extract user and payment details
    const userDetails = useMemo(() => ({
        name: rideDetails?.ride?.found?.name || rideDetails?.ride?.found?.name || 'Customer',
        phone: rideDetails?.ride?.found?.number || rideDetails?.ride?.found?.number || '',
        rating: rideDetails?.ride?.found?.rating || rideDetails?.ride?.found?.rating || 4.5,
        profileImage: rideDetails?.ride?.found?.profileImage?.image || rideDetails?.ride?.found?.profileImage?.image || null,
    }), [rideDetails]);



    const paymentDetails = useMemo(() => {
        const ride = rideDetails?.ride || {};

        return {
            fare: parseFloat(rideDetails?.ride?.driver?.price) || 0,
            baseFare: parseFloat(rideDetails?.ride?.driver?.price) || 0, // Not available in data
            distanceFare: 0, // Not available in data
            timeFare: 0, // Not available in data
            tax: 0, // Not available in data
            discount: 0, // Not available in data
            paymentMethod: 'Cash', // Default assumption
            currency: '₹', // Default
        };
    }, [rideDetails]);

    // Handle phone call
    const handleCallUser = useCallback(() => {
        if (!userDetails.phone) {
            Alert.alert('Error', 'Phone number not available');
            return;
        }

        const phoneUrl = Platform.OS === 'ios'
            ? `tel:01141236767`
            : `tel:01141236767`;

        Linking.canOpenURL(phoneUrl)
            .then((supported) => {
                if (supported) {
                    return Linking.openURL(phoneUrl);
                } else {
                    Alert.alert('Error', 'Phone calls are not supported on this device');
                }
            })
            .catch((err) => console.error('Error opening phone app:', err));
    }, [userDetails.phone]);



    // Tab switching animation
    const switchTab = useCallback((tab) => {
        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 0.3,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();

        setActiveTab(tab);
    }, [fadeAnim]);

    // Render ride content
    const renderRideContent = useMemo(() => (
        <View style={styles.contentContainer}>
            {/* User Info Card */}
                
            <Card style={styles.userCard}>
                <View style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                        {userDetails.profileImage ? (
                            <Image source={{ uri: userDetails.profileImage }} style={styles.avatarImage} />
                        ) : (
                            <MaterialIcons name="person" size={24} color="#666" />
                        )}
                    </View>
                    <View style={styles.userDetails}>
                        <Text style={styles.userName}>{userDetails.name}</Text>
                        <View style={styles.ratingContainer}>
                            <MaterialIcons name="star" size={16} color="#FFD700" />
                            <Text style={styles.ratingText}>{userDetails.rating}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.callButton}
                        onPress={handleCallUser}
                    >
                        <MaterialIcons name="phone" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                </View>
            </Card>

            {/* Location Info */}
            <Card style={styles.locationCard}>
                <View style={styles.locationContainer}>
                    <View style={styles.locationRow}>
                        <View style={styles.locationIconContainer}>
                            <View style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationLabel}>Pickup</Text>
                            <Text style={styles.locationText} numberOfLines={2}>
                                {pickup_desc || 'Pickup Location'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.locationConnector} />

                    <View style={styles.locationRow}>
                        <View style={styles.locationIconContainer}>
                            <View style={[styles.locationDot, { backgroundColor: '#FF3B30' }]} />
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationLabel}>Drop-off</Text>
                            <Text style={styles.locationText} numberOfLines={2}>
                                {drop_desc || 'Drop-off Location'}
                            </Text>
                        </View>
                    </View>
                </View>
            </Card>

            {/* Trip Info */}
            <Card style={styles.tripInfoCard}>
                <View style={styles.tripInfoContainer}>
                    <View style={styles.tripInfoItem}>
                        <MaterialIcons name="directions-car" size={24} color="#FF3B30" />
                        <Text style={styles.tripInfoLabel}>Distance</Text>
                        <Text style={styles.tripInfoValue}>
                            {rideStarted ? `${kmOfRide || '0'} km` : `${distanceToPickup || '0'} km`}
                        </Text>
                    </View>

                    <View style={styles.tripInfoDivider} />

                    <View style={styles.tripInfoItem}>
                        <MaterialIcons name="access-time" size={24} color="#FF3B30" />
                        <Text style={styles.tripInfoLabel}>Time</Text>
                        <Text style={styles.tripInfoValue}>
                            {rideStarted ? 'In Progress' : `${timeToPickup || '0'} min`}
                        </Text>
                    </View>

                    <View style={styles.tripInfoDivider} />

                    <View style={styles.tripInfoItem}>
                        <MaterialIcons name="payment" size={24} color="#FF3B30" />
                        <Text style={styles.tripInfoLabel}>Fare</Text>
                        <Text style={styles.tripInfoValue}>
                            {paymentDetails.currency}{paymentDetails.fare || '0'}
                        </Text>
                    </View>
                </View>
            </Card>

        
        </View>
    ), [
        userDetails,
        pickup_desc,
        drop_desc,
        rideStarted,
        kmOfRide,
        distanceToPickup,
        timeToPickup,
        paymentDetails,
        handleCallUser
    ]);

    // Render payment content
    const renderPaymentContent = useMemo(() => (
        <View style={styles.contentContainer}>
            <Card style={styles.paymentCard}>
                <Text style={styles.paymentTitle}>Fare Breakdown</Text>

                <View style={styles.fareRow}>
                    <Text style={styles.fareLabel}>Base Fare</Text>
                    <Text style={styles.fareValue}>{paymentDetails.currency}{paymentDetails.baseFare}</Text>
                </View>

                <View>
                    <Text>
                        Note:{" "}
                        <Text style={{ color: "#212529", fontSize: 14 }}>
                            Road tax, state tax, and highway tolls are included.{" "}
                        </Text>
                        <Text style={{ color: "#d64444", fontWeight: "600", fontSize: 14 }}>
                            (MCD tolls are not included.)
                        </Text>
                    </Text>
                </View>








                <Divider style={styles.totalDivider} />

                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Fare</Text>
                    <Text style={styles.totalValue}>{paymentDetails.currency}{paymentDetails.fare}</Text>
                </View>

            </Card>
        </View>
    ), [paymentDetails]);

    // Render support content
    const renderSupportContent = useMemo(() => (
        <View style={styles.contentContainer}>
            <Card style={styles.supportCard}>
                <Text style={styles.supportTitle}>Need Help?</Text>
                <Text style={styles.supportSubtitle}>Contact Olyox Support</Text>

                <TouchableOpacity
                    style={styles.supportOption}
                    onPress={() => Linking.openURL(`tel:${settings?.support_number || '01141236789'}`)}
                >
                    <MaterialIcons name="phone" size={24} color="#4CAF50" />
                    <View style={styles.supportOptionText}>
                        <Text style={styles.supportOptionTitle}>Call Support</Text>
                        <Text style={styles.supportOptionSubtitle}>{settings?.support_number}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.supportOption}
                    onPress={() => {
                        const whatsappUrl = `whatsapp://send?phone=${settings?.whatsappNumber || '7217619794'}&text=Hi, I need help with my ride`;
                        Linking.openURL(whatsappUrl).catch(() => {
                            Alert.alert('Error', 'WhatsApp is not installed');
                        });
                    }}
                >
                    <FontAwesome5 name="whatsapp" size={24} color="#25D366" />
                    <View style={styles.supportOptionText}>
                        <Text style={styles.supportOptionTitle}>WhatsApp Support</Text>
                        <Text style={styles.supportOptionSubtitle}>Chat with us instantly</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.supportOption}
                    onPress={() => Linking.openURL('mailto:support@olyox.com?subject=Ride Support Request')}
                >
                    <MaterialIcons name="email" size={24} color="#FF3B30" />
                    <View style={styles.supportOptionText}>
                        <Text style={styles.supportOptionTitle}>Email Support</Text>
                        <Text style={styles.supportOptionSubtitle}>{settings?.adminEmail || 'helpcenter@olyox.com'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#ccc" />
                </TouchableOpacity>

                <View style={styles.emergencyContainer}>
                    <MaterialIcons name="warning" size={20} color="#FF3B30" />
                    <Text style={styles.emergencyText}>For emergencies, call 112</Text>
                </View>
            </Card>
        </View>
    ), []);

    // Main content based on active tab
    const renderContent = useMemo(() => {
        switch (activeTab) {
            case 'payment':
                return renderPaymentContent;
            case 'support':
                return renderSupportContent;
            default:
                return renderRideContent;
        }
    }, [activeTab, renderRideContent, renderPaymentContent, renderSupportContent]);

    return (
        <Animated.View
            style={[
                styles.bottomSheet,
                {
                    transform: [{ translateY }],
                    maxHeight: maxHeight,
                    minHeight: minHeight,
                }
            ]}
        >
            {/* Drag Handle */}
            <View
                style={styles.dragHandle}
                {...onGestureEvent}
            >
                <View style={styles.dragIndicator} />
            </View>

            {/* Header with Status */}
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>
                    {rideStarted ? 'On Trip' : 'Heading to Pickup'}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: rideStarted ? '#FF3B30' : '#4CAF50' }]}>
                    <Text style={styles.statusText}>
                        {rideStarted ? 'Drop-off' : 'Pickup'}
                    </Text>
                </View>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'ride' && styles.activeTab]}
                    onPress={() => switchTab('ride')}
                >
                    <MaterialIcons
                        name="directions-car"
                        size={20}
                        color={activeTab === 'ride' ? '#FF3B30' : '#666'}
                    />
                    <Text style={[styles.tabText, activeTab === 'ride' && styles.activeTabText]}>
                        Ride
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'payment' && styles.activeTab]}
                    onPress={() => switchTab('payment')}
                >
                    <MaterialIcons
                        name="payment"
                        size={20}
                        color={activeTab === 'payment' ? '#FF3B30' : '#666'}
                    />
                    <Text style={[styles.tabText, activeTab === 'payment' && styles.activeTabText]}>
                        Payment
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'support' && styles.activeTab]}
                    onPress={() => switchTab('support')}
                >
                    <MaterialIcons
                        name="support-agent"
                        size={20}
                        color={activeTab === 'support' ? '#FF3B30' : '#666'}
                    />
                    <Text style={[styles.tabText, activeTab === 'support' && styles.activeTabText]}>
                        Support
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    scrollEventThrottle={16}
                >
                    {renderContent}
                </ScrollView>
            </Animated.View>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
                {activeTab === 'ride' && (
                    <>

                    {!rideStarted && (

                        <TouchableOpacity
                            style={styles.directionsButton}
                            onPress={()=>showCancelModal()}
                        >
                            <MaterialIcons name="close" size={20} color="#007AFF" />
                            <Text style={styles.directionsText}>Cancel Ride</Text>
                        </TouchableOpacity>
                    )}

                        {rideStarted ? (
                            <TouchableOpacity
                                style={styles.completeButton}
                                onPress={handleCompleteRide}
                            >
                                <MaterialIcons name="check-circle" size={20} color="#fff" />
                                <Text style={styles.completeButtonText}>Complete Ride</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.otpButton}
                                onPress={() => showOtpModel()}
                            >
                                <MaterialIcons name="vpn-key" size={20} color="#FF3B30" />
                                <Text style={styles.otpButtonText}>Enter OTP</Text>
                            </TouchableOpacity>

                            
                        )}
                    </>
                )}

                {activeTab === 'support' && (
                    <TouchableOpacity
                        style={styles.emergencyButton}
                        onPress={() => Linking.openURL('tel:112')}
                    >
                        <MaterialIcons name="emergency" size={20} color="#fff" />
                        <Text style={styles.emergencyButtonText}>Emergency Call</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 34,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 12,
    },
    dragHandle: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    dragIndicator: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 6,
    },
    activeTab: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666',
    },
    activeTabText: {
        color: '#FF3B30',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    contentContainer: {
        gap: 16,
    },
    userCard: {
        padding: 16,
        borderRadius: 12,
        elevation: 2,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    userDetails: {
        flex: 1,
        marginLeft: 12,
    },
    userName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    ratingText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    callButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0f8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationCard: {
        padding: 16,
        borderRadius: 12,
        elevation: 2,
    },
    locationContainer: {
        gap: 8,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    locationIconContainer: {
        marginRight: 12,
        marginTop: 4,
    },
    locationDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    locationConnector: {
        width: 2,
        height: 20,
        backgroundColor: '#E0E0E0',
        marginLeft: 5,
        marginVertical: 4,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
        fontWeight: '500',
    },
    locationText: {
        fontSize: 16,
        color: '#1a1a1a',
        lineHeight: 22,
        fontWeight: '500',
    },
    tripInfoCard: {
        padding: 16,
        borderRadius: 12,
        elevation: 2,
    },
    tripInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tripInfoItem: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    tripInfoLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    tripInfoValue: {
        fontSize: 16,
        color: '#1a1a1a',
        fontWeight: '600',
    },
    tripInfoDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 16,
    },
    paymentCard: {
        padding: 20,
        borderRadius: 12,
        elevation: 2,
    },
    paymentTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    fareRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    fareLabel: {
        fontSize: 14,
        color: '#666',
    },
    fareValue: {
        fontSize: 14,
        color: '#1a1a1a',
        fontWeight: '500',
    },
    totalDivider: {
        marginVertical: 12,
        backgroundColor: '#E0E0E0',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FF3B30',
    },
    paymentMethodContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        gap: 8,
    },
    paymentMethodText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    supportCard: {
        padding: 20,
        borderRadius: 12,
        elevation: 2,
    },
    supportTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    supportSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    supportOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        gap: 16,
    },
    supportOptionText: {
        flex: 1,
    },
    supportOptionTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1a1a1a',
    },
    supportOptionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    emergencyContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        padding: 12,
        backgroundColor: '#fff5f5',
        borderRadius: 8,
        gap: 8,
    },
    emergencyText: {
        fontSize: 14,
        color: '#FF3B30',
        fontWeight: '500',
    },
    actionContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    directionsButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#007AFF',
        backgroundColor: '#f0f8ff',
        gap: 8,
    },
    directionsText: {
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '600',
    },
    completeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#4CAF50',
        gap: 8,
    },
    completeButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    otpButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FF3B30',
        backgroundColor: '#fff5f5',
        gap: 8,
    },
    otpButtonText: {
        fontSize: 16,
        color: '#FF3B30',
        fontWeight: '600',
    },
    emergencyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FF3B30',
        gap: 8,
    },
    emergencyButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
});

export default RideBottomSheet;

