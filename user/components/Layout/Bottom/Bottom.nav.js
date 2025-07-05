import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    Platform,
    Dimensions,
    Animated
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../../../constants/colors';
import { useFood } from '../../../context/Food_Context/Food_context';
import { useGuest } from '../../../context/GuestLoginContext';
import { find_me } from '../../../utils/helpers';

const { width } = Dimensions.get('window');

const BottomNav = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { isGuest } = useGuest();
    const { cart } = useFood();

    const [currentRide, setCurrentRide] = useState(null);
    const [selectedTab, setSelectedTab] = useState(0);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Initialize ride data
    const fetchRideData = async () => {
        try {
            const data = await find_me();
            setCurrentRide(data?.user?.currentRide || null);
        } catch (error) {
            console.error('Error fetching ride data:', error);
        }
    };

    useEffect(() => {
        // Call once immediately
        fetchRideData();

        // Set up interval
        const interval = setInterval(() => {
            fetchRideData();
        }, 5000); // every 5 seconds

        // Cleanup on unmount
        return () => clearInterval(interval);
    }, []);



    // Base navigation tabs
    const baseTabs = [
        { name: 'Home', icon: '🏠', route: 'Home' },
        { name: 'Orders', icon: '🍕', route: 'Order_Process' },
        { name: 'Cart', icon: '🛒', route: 'Checkout', badge: cart.length },
        { name: isGuest ? 'Login' : 'Profile', icon: '👤', route: isGuest ? 'Onboarding' : 'Profile' }
    ];


    const tabs = currentRide ? [
        ...baseTabs.slice(0, 2),
        { name: 'Ride', icon: '🚗', route: 'RideStarted', isRide: true },
        ...baseTabs.slice(2)
    ] : baseTabs;

    const tabWidth = width / tabs.length;

    const handleTabPress = (index, tab) => {
        // Animate tab selection
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: index * tabWidth,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => {
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }).start();
        });

        setSelectedTab(index);

        // Handle navigation
        if (tab.route === 'Checkout') {
            handleCheckout();
        } else if (tab.route === 'RideStarted' && currentRide) {
            navigation.navigate('RideStarted', {
                driver: currentRide,
                ride: currentRide
            });
        } else {
            navigation.navigate(tab.route);
        }
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        const total = cart.reduce((sum, item) => sum + item.food_price * item.quantity, 0);
        const restaurantId = cart[0]?.restaurant_id?._id;

        navigation.navigate('Checkout', {
            data: {
                items: cart,
                total_amount: total,
                restaurant: restaurantId,
            }
        });
    };

    const renderTab = (tab, index) => {
        const isActive = route.name.toLowerCase() === tab.route.toLowerCase();
        const isRideTab = tab.isRide;

        return (
            <TouchableOpacity
                key={index}
                style={[styles.tab, isRideTab && styles.rideTab]}
                onPress={() => handleTabPress(index, tab)}
                activeOpacity={0.8}
            >
                <Animated.View
                    style={[
                        styles.tabContent,
                        isActive && styles.activeTab,
                        isRideTab && styles.rideTabContent,
                        { transform: [{ scale: isActive ? scaleAnim : 1 }] }
                    ]}
                >
                    <Text style={[
                        styles.tabIcon,
                        isRideTab && styles.rideIcon
                    ]}>
                        {tab.icon}
                    </Text>

                    <Text style={[
                        styles.tabLabel,
                        isActive && styles.activeLabel,
                        isRideTab && styles.rideLabel
                    ]}>
                        {tab.name}
                    </Text>

                    {/* Badge for cart count */}
                    {tab.badge > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{tab.badge}</Text>
                        </View>
                    )}

                    {/* Active indicator */}
                    {isActive && (
                        <View style={[
                            styles.activeIndicator,
                            isRideTab && styles.rideIndicator
                        ]} />
                    )}
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Animated slider */}
            <Animated.View
                style={[
                    styles.slider,
                    {
                        width: tabWidth * 0.6,
                        transform: [{ translateX: slideAnim }],
                        marginLeft: tabWidth * 0.2,
                    }
                ]}
            />

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {tabs.map((tab, index) => renderTab(tab, index))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 10,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 15,
    },
    slider: {
        position: 'absolute',
        top: 8,
        height: 3,
        backgroundColor: COLORS.error,
        borderRadius: 2,
        zIndex: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingTop: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    rideTab: {
        flex: 1.1, // Slightly wider for ride tab
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        minHeight: 50,
        position: 'relative',
    },
    activeTab: {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
    },
    rideTabContent: {
        backgroundColor: 'rgba(255, 125, 0, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 125, 0, 0.3)',
    },
    tabIcon: {
        fontSize: 18,
        marginBottom: 4,
    },
    rideIcon: {
        fontSize: 20,
    },
    tabLabel: {
        fontSize: 11,
        color: '#666',
        fontWeight: '500',
        textAlign: 'center',
    },
    activeLabel: {
        color: COLORS.error,
        fontWeight: '600',
    },
    rideLabel: {
        color: '#FF7D00',
        fontWeight: '700',
    },
    badge: {
        position: 'absolute',
        top: 2,
        right: 8,
        backgroundColor: '#FF4757',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    activeIndicator: {
        position: 'absolute',
        bottom: 2,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.error,
    },
    rideIndicator: {
        backgroundColor: '#FF7D00',
    },
});

export default BottomNav;