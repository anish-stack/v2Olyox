import React from 'react';
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
import { useRide } from '../../../context/RideContext';

const { width } = Dimensions.get('window');
const tabWidth = width / 5;

const BottomNav = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { isGuest } = useGuest();
    const { currentRide } = useRide();
    const [selectedTab, setSelectedTab] = React.useState(0);
    const animatedValue = React.useRef(new Animated.Value(0)).current;
    const { cart } = useFood();
    
    // Define base tabs
    const baseTabs = [
        { name: 'Home', icon: '🏠', route: 'Home' },
        { name: 'Active Order', icon: '🍕', route: 'Order_Process' },
        { name: 'Cart', icon: '🛒', route: 'Checkout', numValue: cart.length || '' },
        { name: isGuest ? 'Login' : 'Profile', icon: '👤', route: isGuest ? 'Onboarding' : 'Profile' },
    ];
    
    // Add Running Ride tab if currentRide exists
    const tabs = currentRide ? [
        ...baseTabs.slice(0, 2),
        { name: 'Running Ride', icon: '🚗', route: 'RideStarted', highlight: true },
        ...baseTabs.slice(2)
    ] : baseTabs;

    const handleCheckout = () => {
        const newTotal = cart.reduce((sum, item) => sum + item.food_price * item.quantity, 0)
        const restaurant_id = cart[0]?.restaurant_id?._id

        const check_out_data_prepare = {
            items: cart,
            total_amount: newTotal,
            restaurant: restaurant_id,
        }
        navigation.navigate("Checkout", { data: check_out_data_prepare || null })
    }

    const handleTabPress = (index, tabRoute) => {
        Animated.sequence([
            Animated.timing(animatedValue, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(animatedValue, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();

        setSelectedTab(index);
        if (tabRoute === 'Checkout') {
            handleCheckout();
        } else if (tabRoute === 'RideStarted' && currentRide) {
            // Navigate to RideStarted with driver and ride data
            navigation.navigate("RideStarted", { driver: currentRide?._id, ride: currentRide });
        } else {
            navigation.navigate(tabRoute);
        }
    };

    const renderTab = (tab, index) => {
        const isActive = route.name.toLowerCase() === tab.route.toLowerCase();
        const isRideTab = tab.name === 'Running Ride';

        const scale = isActive ?
            animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.2, 1],
            }) : 1;

        return (
            <TouchableOpacity
                key={index}
                style={[
                    styles.tabItem,
                    isRideTab && styles.rideTabItem
                ]}
                onPress={() => handleTabPress(index, tab.route)}
                activeOpacity={0.7}
            >
                <Animated.View
                    style={[
                        styles.tabContent,
                        isActive && styles.activeTabContent,
                        isRideTab && styles.rideTabContent,
                        { transform: [{ scale }] }
                    ]}
                >
                    <Text style={[
                        styles.tabIcon,
                        isRideTab && styles.rideTabIcon
                    ]}>
                        {tab.icon}
                    </Text>
                    <Text
                        style={[
                            styles.tabText,
                            isActive && styles.activeTabText,
                            isRideTab && styles.rideTabText,
                            Platform.select({
                                ios: styles.iosText,
                                android: styles.androidText,
                            })
                        ]}
                    >
                        {tab.name}
                    </Text>
                    {tab.numValue && (
                        <Text style={styles.tabNumValue}>{tab.numValue}</Text>
                    )}

                    {isActive && <View style={[
                        styles.activeIndicator,
                        isRideTab && styles.rideActiveIndicator
                    ]} />}
                </Animated.View>
            </TouchableOpacity>
        );
    };

    // Calculate new tab width based on number of tabs
    const dynamicTabWidth = width / tabs.length;

    return (
        <View style={[
            styles.bottomNav,
            Platform.select({
                ios: styles.iosNav,
                android: styles.androidNav,
            })
        ]}>
            {tabs.map((tab, index) => renderTab(tab, index))}
            <Animated.View
                style={[
                    styles.slider,
                    {
                        width: dynamicTabWidth,
                        transform: [{
                            translateX: animatedValue.interpolate({
                                inputRange: [0, 1],
                                outputRange: [selectedTab * dynamicTabWidth, (selectedTab + 1) * dynamicTabWidth],
                            }),
                        }],
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: Platform.OS === 'ios' ? 20 : 12,
        paddingBottom: Platform.OS === 'ios' ? 40 : 12,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
    },
    iosNav: {
        borderTopWidth: 0,
    },
    androidNav: {
        borderTopWidth: 0,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rideTabItem: {
        flex: 1.2, // Make ride tab slightly wider
    },
    tabContent: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        borderRadius: 20,
    },
    rideTabContent: {
        backgroundColor: 'rgba(255, 149, 0, 0.15)', // Orange background for ride tab
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    activeTabContent: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
    },
    tabIcon: {
        fontSize: 13,
        marginBottom: 4,
    },
    rideTabIcon: {
        fontSize: 14,
        marginBottom: 4,
    },
    tabText: {
        fontSize: 10,
        textAlign: 'center',
    },
    rideTabText: {
        color: '#FF7D00', // Orange text for ride tab
        fontWeight: 'bold',
    },
    iosText: {
        fontWeight: '600',
    },
    androidText: {
        fontWeight: 'bold',
    },
    activeTabText: {
        color: COLORS.error,
    },
    activeIndicator: {
        position: 'absolute',
        bottom: -8,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.error,
    },
    rideActiveIndicator: {
        backgroundColor: '#FF7D00', // Orange indicator for ride tab
    },
    tabNumValue: {
        fontSize: 10,
        position: 'absolute',
        top: 0,
        textAlign: 'center',
        width: 15,
        color: '#fff',
        borderRadius: 50,
        height: 15,
        right: -2,
        backgroundColor: '#d54d57'
    },
    slider: {
        position: 'absolute',
        top: 0,
        height: 2,
        backgroundColor: COLORS.error,
    }
});

export default BottomNav;