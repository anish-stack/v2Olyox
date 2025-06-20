import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Animated,
    Image,
    Dimensions,
    ActivityIndicator,
    Share,
    Alert,
    Modal,
    StatusBar,
    Platform,
    Linking,
    Clipboard,
    RefreshControl
} from 'react-native';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { tokenCache } from '../Auth/cache';
import { find_me } from '../utils/helpers';
import { MaterialIcons, Ionicons, Feather, AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

import EditModal from './EditModel';

const { width, height } = Dimensions.get('window');
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Enhanced Delete Confirmation Modal Component
const DeleteConfirmationModal = ({ visible, onClose, onConfirm, userName }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(0.8));

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 0.8,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <Animated.View
                style={[
                    styles.modalOverlay,
                    { opacity: fadeAnim }
                ]}
            >
                <Animated.View
                    style={[
                        styles.deleteModalContainer,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: fadeAnim
                        }
                    ]}
                >
                    <LinearGradient
                        colors={['#DC2626', '#B91C1C']}
                        style={styles.deleteModalHeader}
                    >
                        <Ionicons name="warning" size={50} color="#fff" />
                        <Text style={styles.deleteModalTitle}>Wait! Don't Leave Olyox!</Text>
                    </LinearGradient>

                    <View style={styles.deleteModalContent}>
                        <Text style={styles.deleteModalMessage}>
                            Hey {userName}! 👋
                        </Text>
                        <Text style={styles.deleteModalSubMessage}>
                            It hurts to see you go from the Olyox family. Your account holds the key to effortless bookings — don’t lose that connection!
                        </Text>


                        <View style={styles.benefitsList}>
                            <View style={styles.benefitItem}>
                                <Ionicons name="car-sport" size={20} color="#DC2626" />
                                <Text style={styles.benefitText}>Quick cab bookings & ride history</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="business" size={20} color="#DC2626" />
                                <Text style={styles.benefitText}>Hotel reservations & travel memories</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="restaurant" size={20} color="#DC2626" />
                                <Text style={styles.benefitText}>Food & tiffin delivery preferences</Text>
                            </View>
                            <View style={styles.benefitItem}>
                                <Ionicons name="gift" size={20} color="#DC2626" />
                                <Text style={styles.benefitText}>Loyalty rewards & exclusive offers</Text>
                            </View>

                        </View>


                    </View>

                    <View style={styles.deleteModalActions}>
                        <TouchableOpacity
                            style={styles.stayButton}
                            onPress={onClose}
                        >
                            <LinearGradient
                                colors={['#DC2626', '#B91C1C']}
                                style={styles.stayButtonGradient}
                            >
                                <Ionicons name="heart" size={20} color="#fff" />
                                <Text style={styles.stayButtonText}>Stay With Olyox</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.confirmDeleteButton}
                            onPress={onConfirm}
                        >
                            <Text style={styles.confirmDeleteText}>Delete Anyway</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};



const ShareModal = ({ visible, onClose }) => {
    const [fadeAnim] = useState(new Animated.Value(0));

    const APP_STORE_LINK = "https://play.google.com/store/apps/details?id=com.happy_coding.olyox";
    const APPLE_STORE_LINK = "https://apps.apple.com/in/app/olyox-book-cab-hotel-food/id6744582670";
    const APP_NAME = "Olyox";
    const APP_TAGLINE = "Book Cab, Hotels, Food";

    // Get platform-specific app store link
    const getAppStoreLink = () => {
        return Platform.OS === 'ios' ? APPLE_STORE_LINK : APP_STORE_LINK;
    };

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const shareContent = {
        title: `${APP_NAME} - ${APP_TAGLINE}`,
        message: Platform.OS === 'ios'
            ? `🚗🏨🍕 Discover Olyox - Your All-in-One Booking App!\n\n${APP_TAGLINE}\n✅ Book Cabs instantly\n✅ Reserve Hotels\n✅ Order Food & Tiffin\n✅ Send Cargo\n\nDownload now: ${getAppStoreLink()}`
            : `🚗🏨🍕 Discover Olyox - Your All-in-One Booking App!\n\n${APP_TAGLINE}\n✅ Book Cabs instantly\n✅ Reserve Hotels\n✅ Order Food & Tiffin\n✅ Send Cargo\n\nDownload now: ${getAppStoreLink()}`,
        url: getAppStoreLink()
    };

    const shareViaSystem = async () => {
        try {
            const result = await Share.share({
                message: shareContent.message,
                url: Platform.OS === 'ios' ? shareContent.url : undefined,
                title: shareContent.title,
            }, {
                dialogTitle: `Share ${APP_NAME} with friends!`,
                excludedActivityTypes: Platform.OS === 'ios' ? [
                    'com.apple.UIKit.activity.PostToTwitter'
                ] : undefined,
                tintColor: '#DC2626'
            });

            if (result.action === Share.sharedAction) {
                onClose();
            }
        } catch (error) {
            console.error('Error sharing via system:', error);
            Alert.alert('Error', 'Unable to share at this time');
        }
    };

    const shareViaWhatsApp = async () => {
        const message = `🚗🏨🍕 Hey! Check out Olyox - the ultimate booking app!\n\n${APP_TAGLINE}\n\n✅ Instant cab booking\n✅ Hotel reservations\n✅ Food & tiffin delivery\n✅ Cargo services\n\nDownload: ${getAppStoreLink()}`;

        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

        try {
            const supported = await Linking.canOpenURL(whatsappUrl);
            if (supported) {
                await Linking.openURL(whatsappUrl);
                onClose();
            } else {
                Alert.alert(
                    'WhatsApp Not Found',
                    'WhatsApp is not installed on your device',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Install WhatsApp',
                            onPress: () => {
                                const storeUrl = Platform.OS === 'ios'
                                    ? 'https://apps.apple.com/app/whatsapp-messenger/id310633997'
                                    : 'https://play.google.com/store/apps/details?id=com.whatsapp';
                                Linking.openURL(storeUrl);
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('WhatsApp sharing error:', error);
            Alert.alert('Error', 'Unable to open WhatsApp');
        }
    };

    const copyToClipboard = async () => {
        try {
            await Clipboard.setString(getAppStoreLink());
            Alert.alert(
                'Link Copied!',
                `Olyox ${Platform.OS === 'ios' ? 'App Store' : 'Play Store'} link has been copied to your clipboard`,
                [{ text: 'OK', onPress: onClose }]
            );
        } catch (error) {
            console.error('Clipboard error:', error);
            Alert.alert('Error', 'Failed to copy link to clipboard');
        }
    };

    const shareViaSMS = async () => {
        const message = `Check out Olyox - ${APP_TAGLINE}! Download: ${getAppStoreLink()}`;
        const smsUrl = `sms:?body=${encodeURIComponent(message)}`;

        try {
            const supported = await Linking.canOpenURL(smsUrl);
            if (supported) {
                await Linking.openURL(smsUrl);
                onClose();
            } else {
                Alert.alert('Error', 'SMS is not available on this device');
            }
        } catch (error) {
            console.error('SMS sharing error:', error);
            Alert.alert('Error', 'Unable to open messaging app');
        }
    };

    const shareViaEmail = async () => {
        const subject = `Check out ${APP_NAME} - ${APP_TAGLINE}`;
        const body = `Hi!\n\nI wanted to share this amazing app with you - Olyox!\n\n${APP_TAGLINE}\n\n✅ Book Cabs instantly\n✅ Reserve Hotels\n✅ Order Food & Tiffin\n✅ Send Cargo\n\nIt's really convenient and easy to use. You can download it here:\n${getAppStoreLink()}\n\nEnjoy!`;

        const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        try {
            const supported = await Linking.canOpenURL(emailUrl);
            if (supported) {
                await Linking.openURL(emailUrl);
                onClose();
            } else {
                Alert.alert('Error', 'Email is not available on this device');
            }
        } catch (error) {
            console.error('Email sharing error:', error);
            Alert.alert('Error', 'Unable to open email app');
        }
    };

    const shareViaInstagram = async () => {
        const instagramUrl = 'instagram://';

        try {
            const supported = await Linking.canOpenURL(instagramUrl);
            if (supported) {
                // Instagram doesn't support direct text sharing, so we copy to clipboard and open Instagram
                await Clipboard.setString(`Check out Olyox - ${APP_TAGLINE}! Download: ${getAppStoreLink()}`);
                await Linking.openURL(instagramUrl);
                Alert.alert('Link Copied', 'The app link has been copied to your clipboard. You can paste it in your Instagram story or post!');
                onClose();
            } else {
                Alert.alert(
                    'Instagram Not Found',
                    'Instagram is not installed on your device',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Install Instagram',
                            onPress: () => {
                                const storeUrl = Platform.OS === 'ios'
                                    ? 'https://apps.apple.com/app/instagram/id389801252'
                                    : 'https://play.google.com/store/apps/details?id=com.instagram.android';
                                Linking.openURL(storeUrl);
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Instagram sharing error:', error);
            Alert.alert('Error', 'Unable to open Instagram');
        }
    };

    const shareViaFacebook = async () => {
        const facebookUrl = 'fb://';

        try {
            const supported = await Linking.canOpenURL(facebookUrl);
            if (supported) {
                // Facebook app doesn't support direct text sharing, so we copy to clipboard and open Facebook
                await Clipboard.setString(`Check out Olyox - ${APP_TAGLINE}! Download: ${getAppStoreLink()}`);
                await Linking.openURL(facebookUrl);
                Alert.alert('Link Copied', 'The app link has been copied to your clipboard. You can paste it in your Facebook post!');
                onClose();
            } else {
                Alert.alert(
                    'Facebook Not Found',
                    'Facebook is not installed on your device',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Install Facebook',
                            onPress: () => {
                                const storeUrl = Platform.OS === 'ios'
                                    ? 'https://apps.apple.com/app/facebook/id284882215'
                                    : 'https://play.google.com/store/apps/details?id=com.facebook.katana';
                                Linking.openURL(storeUrl);
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Facebook sharing error:', error);
            Alert.alert('Error', 'Unable to open Facebook');
        }
    };

    const shareOptions = [
        {
            name: 'Share App',
            icon: 'share-social',
            color: '#DC2626',
            action: shareViaSystem
        },
        {
            name: 'WhatsApp',
            icon: 'logo-whatsapp',
            color: '#25D366',
            action: shareViaWhatsApp
        },

        {
            name: 'Email',
            icon: 'mail',
            color: '#FF6B35',
            action: shareViaEmail
        },
        {
            name: 'Instagram',
            icon: 'logo-instagram',
            color: '#E4405F',
            action: shareViaInstagram
        },
        {
            name: 'Facebook',
            icon: 'logo-facebook',
            color: '#1877F2',
            action: shareViaFacebook
        },
        {
            name: 'Copy Link',
            icon: 'copy',
            color: '#6B7280',
            action: copyToClipboard
        }
    ];

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>

                <Animated.View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        justifyContent: 'flex-end',
                        opacity: fadeAnim
                    }}
                >
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={onClose}
                    />
                    <View style={{
                        backgroundColor: '#fff',
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        paddingTop: 8,
                        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
                        paddingHorizontal: 20,
                        maxHeight: '80%',
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 16,
                            paddingTop: 12,
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontSize: 24,
                                    fontWeight: '700',
                                    color: '#1F2937',
                                    marginBottom: 4,
                                }}>Share Olyox</Text>
                                <Text style={{
                                    fontSize: 16,
                                    color: '#DC2626',
                                    fontWeight: '500',
                                }}>{APP_TAGLINE}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={{ padding: 8, marginTop: -8, marginRight: -8 }}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{
                            fontSize: 15,
                            color: '#6B7280',
                            textAlign: 'center',
                            marginBottom: 24,
                            lineHeight: 22,
                        }}>
                            Help your friends discover the convenience of Olyox! 🚗🏨🍕📦
                        </Text>

                        <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            marginBottom: 20,
                        }}>
                            {shareOptions.map((option, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={{
                                        width: '48%',
                                        alignItems: 'center',
                                        paddingVertical: 20,
                                        paddingHorizontal: 12,
                                        borderRadius: 16,
                                        backgroundColor: '#F9FAFB',
                                        borderWidth: 1,
                                        borderColor: option.color + '20',
                                        marginBottom: 12,
                                    }}
                                    onPress={option.action}
                                    activeOpacity={0.7}
                                >
                                    <View style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 24,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginBottom: 12,
                                        backgroundColor: option.color,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.1,
                                        shadowRadius: 4,
                                        elevation: 3,
                                    }}>
                                        <Ionicons name={option.icon} size={22} color="#fff" />
                                    </View>
                                    <Text style={{
                                        fontSize: 14,
                                        fontWeight: '600',
                                        color: '#374151',
                                        textAlign: 'center',
                                    }}>{option.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{
                            paddingTop: 16,
                            borderTopWidth: 1,
                            borderTopColor: '#F3F4F6',
                        }}>
                            <Text style={{
                                fontSize: 13,
                                color: '#9CA3AF',
                                textAlign: 'center',
                                fontStyle: 'italic',
                            }}>
                                Olyox - All your booking needs in one place
                            </Text>
                            <Text style={{
                                fontSize: 12,
                                color: '#9CA3AF',
                                textAlign: 'center',
                                marginTop: 4,
                            }}>
                                {Platform.OS === 'ios' ? 'Available on App Store' : 'Available on Google Play'}
                            </Text>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>
        </Modal>
    );
};

export default function OlyoxUserProfile() {
    const navigation = useNavigation();
    const [editModel, setEditModel] = useState(false);
    const [deleteModal, setDeleteModal] = useState(false);
    const [shareModal, setShareModal] = useState(false);
    const [activeTab, setActiveTab] = useState('Orders');
    const [userData, setUserData] = useState(null);
    const [orderData, setOrderData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [image, setImage] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Animation values
    const [headerAnimation] = useState(new Animated.Value(0));
    const [statsAnimation] = useState(new Animated.Value(0));

    useEffect(() => {
        fetchData();
        startAnimations();
    }, []);

    const startAnimations = () => {
        Animated.sequence([
            Animated.timing(headerAnimation, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(statsAnimation, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const fetchData = useCallback(async () => {
        try {
            setRefreshing(true);
            const user = await find_me();
            setUserData(user.user);

            const gmail_token = await tokenCache.getToken('auth_token');
            const db_token = await tokenCache.getToken('auth_token_db');
            const token = db_token || gmail_token;

            const response = await axios.get('http://192.168.1.6:3100/api/v1/user/find-Orders-details', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setOrderData(response.data.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load profile data. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleLogout = useCallback(async () => {
        Alert.alert(
            'Logout from Olyox',
            'Are you sure you want to logout from your Olyox account?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await SecureStore.deleteItemAsync('auth_token');
                            await SecureStore.deleteItemAsync('cached_location');
                            await SecureStore.deleteItemAsync('cached_coords');
                            await SecureStore.deleteItemAsync('auth_token_db');

                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Onboarding' }],
                            });
                        } catch (error) {
                            Alert.alert('Error', 'Failed to logout. Please try again.');
                        }
                    }
                }
            ]
        );
    }, [navigation]);

    const pickImage = useCallback(async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant permission to access the media library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets?.length > 0) {
                setImage(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image. Please try again.');
        }
    }, []);

    const uploadImage = useCallback(async () => {
        if (!image) return;

        try {
            setLoading(true);
            const gmail_token = await tokenCache.getToken('auth_token');
            const db_token = await tokenCache.getToken('auth_token_db');
            const token = db_token || gmail_token;

            const form = new FormData();
            form.append('image', {
                uri: image,
                name: 'profile.jpg',
                type: 'image/jpeg',
            });

            const response = await axios.post('http://192.168.1.6:3100/api/v1/user/update-profile', form, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });

            Alert.alert('Success', 'Profile image updated successfully!');
            fetchData();
            setImage(null);
        } catch (error) {
            console.error('Error uploading image:', error);
            Alert.alert('Error', 'Failed to upload image. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [image, fetchData]);

    const updateDetails = useCallback(async ({ name, email }) => {
        try {
            setLoading(true);
            const gmail_token = await tokenCache.getToken('auth_token');
            const db_token = await tokenCache.getToken('auth_token_db');
            const token = db_token || gmail_token;

            const form = new FormData();
            if (name) form.append('name', name);
            if (email) form.append('email', email);

            if (!name && !email) {
                Alert.alert('No changes detected', 'Please provide a name or email to update.');
                setLoading(false);
                return;
            }

            const response = await axios.post('http://192.168.1.6:3100/api/v1/user/update-profile', form, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });

            Alert.alert('Success', 'Profile updated successfully!');
            fetchData();
            setEditModel(false);
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [fetchData]);

    const deleteAccount = useCallback(async (id) => {
        try {
            setLoading(true);
            const response = await axios.post(`http://192.168.1.6:3100/api/v1/user/delete-my-account/${id}`);
            Alert.alert('Account Deleted', response.data.message);
            await handleLogout();
        } catch (error) {
            console.error('Error deleting account:', error);
            Alert.alert('Error', 'Failed to delete account. Please try again.');
        } finally {
            setLoading(false);
            setDeleteModal(false);
        }
    }, [handleLogout]);

    useEffect(() => {
        if (image) {
            const timer = setTimeout(() => {
                uploadImage();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [image, uploadImage]);

    const tabs = useMemo(() => [
        { name: 'Orders', icon: 'restaurant-menu', count: orderData?.orderCounts?.foodOrders || 0, color: '#DC2626', emoji: '🍕' },
        { name: 'Rides', icon: 'local-taxi', count: orderData?.orderCounts?.rideRequests || 0, color: '#DC2626', emoji: '🚗' },
        { name: 'Hotels', icon: 'hotel', count: orderData?.orderCounts?.hotelBookings || 0, color: '#DC2626', emoji: '🏨' },
        { name: 'Cargo', icon: 'local-shipping', count: orderData?.orderCounts?.cargo || 0, color: '#DC2626', emoji: '📦' },
    ], [orderData]);

    const renderOrderCard = useCallback((order) => (
        <AnimatedTouchableOpacity
            key={order?._id.toString()}
            style={styles.enhancedOrderCard}
            onPress={() => setExpandedOrder(expandedOrder === order._id ? null : order._id)}
        >
            <View style={styles.orderCardContainer}>
                <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>🍕 Order #{order.Order_Id}</Text>
                        <Text style={styles.orderDate}>
                            {new Date(order.order_date).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: order.status === 'Pending' ? '#FEF3C7' : '#DCFCE7' }
                    ]}>
                        <Text style={[
                            styles.statusText,
                            { color: order.status === 'Pending' ? '#92400E' : '#166534' }
                        ]}>
                            {order.status}
                        </Text>
                    </View>
                </View>

                {expandedOrder === order._id && (
                    <Animated.View style={styles.orderDetails}>
                        {order.items.map((item, index) => (
                            <View key={index} style={styles.itemRow}>
                                <Image
                                    source={{ uri: item.foodItem_id.images.url }}
                                    style={styles.foodImage}
                                />
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.foodItem_id.food_name}</Text>
                                    <Text style={styles.itemDesc} numberOfLines={2}>
                                        {item.foodItem_id.description}
                                    </Text>
                                    <View style={styles.quantityPrice}>
                                        <Text style={styles.quantity}>Qty: {item.quantity}</Text>
                                        <Text style={styles.price}>₹{item.price}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                        <View style={styles.deliveryInfo}>
                            <Text style={styles.deliveryAddress}>
                                📍 {order.address_details.flatNo}, {order.address_details.street}
                            </Text>
                            <Text style={styles.totalPrice}>Total: ₹{order.totalPrice}</Text>
                        </View>
                    </Animated.View>
                )}
            </View>
        </AnimatedTouchableOpacity>
    ), [expandedOrder]);

    const renderRideCard = useCallback((ride) => (
        <AnimatedTouchableOpacity
            key={ride?._id.toString()}
            style={styles.enhancedOrderCard}
            onPress={() => setExpandedOrder(expandedOrder === ride._id ? null : ride._id)}
        >
            <View style={styles.orderCardContainer}>
                <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>🚗 {ride.vehicleType} Ride</Text>
                        <Text style={styles.orderDate}>
                            {new Date(ride.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={[styles.statusText, { color: '#166534' }]}>
                            {ride.rideStatus}
                        </Text>
                    </View>
                </View>

                {expandedOrder === ride._id && (
                    <Animated.View style={styles.orderDetails}>
                        <View style={styles.rideDetails}>
                            <View style={styles.locationInfo}>
                                <Ionicons name="location" size={20} color="#DC2626" />
                                <Text style={styles.locationText}>{ride.pickup_desc}</Text>
                            </View>
                            <View style={styles.locationInfo}>
                                <Ionicons name="location" size={20} color="#DC2626" />
                                <Text style={styles.locationText}>{ride.drop_desc}</Text>
                            </View>
                            <View style={styles.rideStats}>
                                <Text style={styles.statItem}>💰 Fare: ₹{ride.kmOfRide}</Text>
                                <Text style={styles.statItem}>⏱️ ETA: {ride.EtaOfRide}</Text>
                            </View>
                            {ride.rideStatus !== "cancelled" && ride.rideStatus !== "completed" && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate("RideStarted", { driver: ride?.rider, ride: ride })}
                                    style={styles.seeRideButton}
                                >
                                    <LinearGradient
                                        colors={['#DC2626', '#B91C1C']}
                                        style={styles.seeRideGradient}
                                    >
                                        <Text style={styles.seeRideText}>Track Ride 🚖</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </View>
                    </Animated.View>
                )}
            </View>
        </AnimatedTouchableOpacity>
    ), [expandedOrder, navigation]);

    const renderHotelCards = useCallback((hotelData) => (
        <AnimatedTouchableOpacity
            key={hotelData?._id.toString()}
            style={styles.enhancedOrderCard}
            onPress={() => setExpandedOrder(expandedOrder === hotelData._id ? null : hotelData._id)}
        >
            <View style={styles.orderCardContainer}>
                <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderId}>🏨 {hotelData?.HotelUserId?.hotel_name}</Text>
                        <Text style={styles.orderDate}>
                            {new Date(hotelData.checkInDate).toLocaleDateString()}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.viewDetailsButton}>
                        <Text style={styles.viewDetailsText}>View Details</Text>
                    </TouchableOpacity>
                </View>

                {expandedOrder === hotelData._id && (
                    <Animated.View style={styles.orderDetails}>
                        <View style={styles.hotelDetails}>
                            <View style={styles.dateInfo}>
                                <Ionicons name="calendar" size={20} color="#DC2626" />
                                <Text style={styles.dateText}>
                                    Check-in: {new Date(hotelData.checkInDate).toLocaleDateString('en-GB')}
                                </Text>
                            </View>
                            <View style={styles.dateInfo}>
                                <Ionicons name="calendar-outline" size={20} color="#DC2626" />
                                <Text style={styles.dateText}>
                                    Check-out: {new Date(hotelData.checkOutDate).toLocaleDateString('en-GB')}
                                </Text>
                            </View>
                            <View style={styles.hotelStats}>
                                <Text style={styles.statItem}>👥 Guests: {hotelData.numberOfGuests}</Text>
                                <Text style={styles.statItem}>💳 {hotelData.paymentMode}</Text>
                                <Text style={styles.statItem}>📋 Status: {hotelData.status}</Text>
                            </View>
                        </View>
                    </Animated.View>
                )}
            </View>
        </AnimatedTouchableOpacity>
    ), [expandedOrder]);

    const renderContent = useCallback(() => {
        switch (activeTab) {
            case 'Orders':
                return orderData?.OrderFood?.length > 0
                    ? orderData.OrderFood.map(order => renderOrderCard(order))
                    : <Text style={styles.emptyStateText}>No food orders found 🍽️</Text>;
            case 'Rides':
                return orderData?.RideData?.length > 0
                    ? orderData.RideData.map(ride => renderRideCard(ride))
                    : <Text style={styles.emptyStateText}>No cab rides found 🚗</Text>;
            case 'Hotels':
                return orderData?.Hotel?.length > 0
                    ? orderData.Hotel.map(hotel => renderHotelCards(hotel))
                    : <Text style={styles.emptyStateText}>No hotel bookings found 🏨</Text>;
            case 'Cargo':
                return <Text style={styles.emptyStateText}>No cargo deliveries found 📦</Text>;
            default:
                return null;
        }
    }, [activeTab, orderData, renderOrderCard, renderRideCard, renderHotelCards]);

    if (loading && !userData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#DC2626" />
                <Text style={styles.loadingText}>Loading your Olyox profile...</Text>
            </View>
        );
    }

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                
                style={styles.container}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
                }
            >
                <Animated.View
                    style={[
                        styles.headerContainer,
                        {
                            opacity: headerAnimation,
                            transform: [{
                                translateY: headerAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-50, 0],
                                })
                            }]
                        }
                    ]}
                >
                    <LinearGradient
                        colors={['#DC2626', '#B91C1C']}
                        style={styles.enhancedHeader}
                    >
                        <View style={styles.headerActions}>
                            <View style={styles.olyoxBranding}>
                                <Text style={styles.olyoxTitle}>OLYOX</Text>
                                <Text style={styles.olyoxTagline}>Book Cab, Hotels, Food And Cargo</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.shareButton}
                                onPress={() => setShareModal(true)}
                            >
                                <Ionicons name="share-social" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileSection}>
                            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                                <Image
                                    source={{
                                        uri: userData?.profileImage?.image || image || 'https://i.ibb.co/4ZhfBryk/image.png'
                                    }}
                                    style={styles.enhancedAvatar}
                                />
                                <View style={styles.cameraButton}>
                                    <Ionicons name="camera" size={20} color="#DC2626" />
                                </View>
                                {image && (
                                    <View style={styles.uploadingIndicator}>
                                        <ActivityIndicator size="small" color="#fff" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.enhancedUserName}>
                                {userData?.name || "Add Your Name"}
                            </Text>
                            <Text style={styles.enhancedContact}>📱 {userData?.number}</Text>
                            <Text style={styles.enhancedEmail}>
                                📧 {userData?.email || "Add Your Email"}
                            </Text>

                            {userData?.isOtpVerify && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={16} color="#DC2626" />
                                    <Text style={styles.verifiedText}>Verified Olyox User</Text>
                                </View>
                            )}

                            <View style={styles.enhancedButtonContainer}>
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.editButton]}
                                    onPress={() => setEditModel(true)}
                                >
                                    <Ionicons name="create-outline" size={18} color="#DC2626" />
                                    <Text style={styles.actionButtonText}>Edit</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.logoutButton]}
                                    onPress={handleLogout}
                                >
                                    <Ionicons name="log-out-outline" size={18} color="#fff" />
                                    <Text style={styles.logoutButtonText}>Logout</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deleteButton]}
                                    onPress={() => setDeleteModal(true)}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#fff" />
                                    <Text style={styles.deleteButtonText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                <Animated.View
                    style={[
                        styles.statsContainer,
                        {
                            opacity: statsAnimation,
                            transform: [{
                                translateY: statsAnimation.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [30, 0],
                                })
                            }]
                        }
                    ]}
                >
                    {tabs.map((tab, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.enhancedStatCard,
                                activeTab === tab.name && styles.activeStatCard
                            ]}
                            onPress={() => setActiveTab(tab.name)}
                        >
                            <View style={[
                                styles.statCardContainer,
                                { backgroundColor: activeTab === tab.name ? '#DC2626' : '#fff' }
                            ]}>
                                <Text style={[
                                    styles.statEmoji,
                                    { fontSize: activeTab === tab.name ? 32 : 28 }
                                ]}>
                                    {tab.emoji}
                                </Text>
                                <Text style={[
                                    styles.statCount,
                                    { color: activeTab === tab.name ? '#fff' : '#1f2937' }
                                ]}>
                                    {tab.count}
                                </Text>
                                <Text style={[
                                    styles.statLabel,
                                    { color: activeTab === tab.name ? '#fff' : '#6b7280' }
                                ]}>
                                    {tab.name}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </Animated.View>

                <View style={styles.content}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{activeTab} History</Text>
                        <View style={styles.sectionIcon}>
                            <Text style={styles.sectionEmoji}>
                                {tabs.find(tab => tab.name === activeTab)?.emoji}
                            </Text>
                        </View>
                    </View>
                    {renderContent()}
                </View>

                {/* Modals */}
                <DeleteConfirmationModal
                    visible={deleteModal}
                    onClose={() => setDeleteModal(false)}
                    onConfirm={() => deleteAccount(userData?._id)}
                    userName={userData?.name || 'User'}
                />

                <ShareModal
                    visible={shareModal}
                    onClose={() => setShareModal(false)}
                />

                <EditModal
                    previousData={userData}
                    visible={editModel}
                    onClose={() => setEditModel(false)}
                    onSubmit={updateDetails}
                />
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
    headerContainer: {
        marginBottom: -30,
    },
    enhancedHeader: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    olyoxBranding: {
        alignItems: 'flex-start',
    },
    olyoxTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 2,
    },
    olyoxTagline: {
        fontSize: 12,
        color: '#FEE2E2',
        fontWeight: '500',
        marginTop: 2,
    },
    shareButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 12,
        borderRadius: 25,
    },
    profileSection: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    enhancedAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#fff',
    },
    cameraButton: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#DC2626',
    },
    uploadingIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    enhancedUserName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    enhancedContact: {
        fontSize: 18,
        color: '#FEE2E2',
        marginBottom: 4,
    },
    enhancedEmail: {
        fontSize: 16,
        color: '#FEE2E2',
        marginBottom: 12,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 20,
    },
    verifiedText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#DC2626',
    },
    enhancedButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 25,
        flex: 1,
        marginHorizontal: 4,
        justifyContent: 'center',
    },
    editButton: {
        backgroundColor: '#fff',
    },
    logoutButton: {
        backgroundColor: 'rgba(220, 38, 38, 0.8)',
    },
    deleteButton: {
        backgroundColor: 'rgba(185, 28, 28, 0.9)',
    },
    actionButtonText: {
        color: '#DC2626',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    logoutButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 15,
        paddingVertical: 20,
        marginTop: 20,
    },
    enhancedStatCard: {
        flex: 1,
        marginHorizontal: 4,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    activeStatCard: {
        transform: [{ scale: 1.05 }],
    },
    statCardContainer: {
        padding: 16,
        alignItems: 'center',
        minHeight: 100,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#DC2626',
    },
    statEmoji: {
        marginBottom: 8,
    },
    statCount: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    content: {
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    sectionIcon: {
        backgroundColor: '#FEE2E2',
        padding: 8,
        borderRadius: 12,
    },
    sectionEmoji: {
        fontSize: 24,
    },
    enhancedOrderCard: {
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    orderCardContainer: {
        backgroundColor: '#fff',
        padding: 20,
        borderLeftWidth: 4,
        borderLeftColor: '#DC2626',
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderInfo: {
        flex: 1,
    },
    orderId: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    orderDate: {
        fontSize: 14,
        color: '#6b7280',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    viewDetailsButton: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    viewDetailsText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    orderDetails: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 20,
    },
    itemRow: {
        flexDirection: 'row',
        marginBottom: 16,
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        padding: 12,
    },
    foodImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    itemInfo: {
        flex: 1,
        marginLeft: 16,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    itemDesc: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 8,
    },
    quantityPrice: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    quantity: {
        fontSize: 14,
        color: '#6b7280',
    },
    price: {
        fontSize: 16,
        fontWeight: '600',
        color: '#DC2626',
    },
    deliveryInfo: {
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 12,
        marginTop: 12,
    },
    deliveryAddress: {
        fontSize: 14,
        color: '#4b5563',
        marginBottom: 8,
    },
    totalPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#DC2626',
    },
    rideDetails: {
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 12,
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
    },
    locationText: {
        marginLeft: 12,
        flex: 1,
        fontSize: 14,
        color: '#4b5563',
    },
    rideStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    statItem: {
        fontSize: 14,
        fontWeight: '500',
        color: '#4b5563',
    },
    seeRideButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    seeRideGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    seeRideText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    hotelDetails: {
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 12,
    },
    dateInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
    },
    dateText: {
        marginLeft: 12,
        fontSize: 14,
        fontWeight: '500',
        color: '#4b5563',
    },
    hotelStats: {
        marginTop: 12,
    },
    emptyStateText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#9ca3af',
        fontStyle: 'italic',
        marginTop: 40,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    deleteModalContainer: {
        backgroundColor: '#fff',
        borderRadius: 20,
        overflow: 'hidden',
        width: '100%',
        maxWidth: 400,
    },
    deleteModalHeader: {
        padding: 30,
        alignItems: 'center',
    },
    deleteModalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 12,
    },
    deleteModalContent: {
        padding: 24,
    },
    deleteModalMessage: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        textAlign: 'center',
        marginBottom: 12,
    },
    deleteModalSubMessage: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    benefitsList: {
        marginBottom: 0,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
    },
    benefitText: {
        marginLeft: 12,
        fontSize: 14,
        color: '#4b5563',
        flex: 1,
    },
    deleteWarning: {
        fontSize: 14,
        color: '#DC2626',
        textAlign: 'center',
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    deleteModalActions: {
        padding: 24,
        paddingTop: 0,
    },
    stayButton: {
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    stayButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    stayButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 8,
    },
    confirmDeleteButton: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmDeleteText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },

    // Share Modal Styles
    shareModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    shareModalContainer: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    shareModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    shareModalTitleContainer: {
        flex: 1,
    },
    shareModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#DC2626',
    },
    shareModalTagline: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
    },
    shareModalSubtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    shareOptionsContainer: {
        paddingHorizontal: 20,
    },
    shareOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
    },
    shareIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    shareOptionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1f2937',
        flex: 1,
    },
    appInfoContainer: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    appInfoText: {
        fontSize: 13,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
    },
});

